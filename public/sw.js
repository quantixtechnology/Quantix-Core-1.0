// Quantix Service Worker — production caching strategy
//
// Caching tiers:
//   CACHE_FIRST  — content-hashed Next.js bundles, icons, manifest
//   SWR          — business images, product photos (stale-while-revalidate)
//   NET_FIRST    — HTML pages (always fresh markup; cache as offline fallback)
//   BYPASS       — auth, checkout, orders, payments (never cached)
//
// Cache name is versioned per deploy via SET_BUILD_ID message from CacheBuster.

let CACHE_NAME  = 'quantix-sw-pending'
let IMAGE_CACHE = 'quantix-img-pending'

const MAX_IMAGE_ENTRIES = 150
const MAX_IMAGE_AGE_MS  = 7 * 24 * 60 * 60 * 1000 // 7 days (unused but documented)

// ── Patterns ─────────────────────────────────────────────────────────────

// Always bypass — sensitive paths never touch the cache
const BYPASS_RE = [
  /\/api\/core\/storefront\/auth\//,
  /\/api\/core\/storefront\/checkout/,
  /\/api\/core\/storefront\/orders/,
  /\/api\/core\/storefront\/payment/,
  /\/api\/core\/storefront\/cart/,
  /\/api\/v1\/auth\//,
  /\/api\/v1\/orders/,
  /\/api\/v1\/cart/,
  /\/api\/debug\//,
]

// Cache-first (content-hashed or versioned — safe to cache forever)
const STATIC_RE = [
  /\/_next\/static\//,
  /\/manifest\.json/,
  /\/(quantix-logo|logo|placeholder-[a-z]+)\.(png|svg|webp|ico)(\?|$)/,
]

// Stale-while-revalidate — images that change infrequently
const IMAGE_RE = [
  /\/uploads\//,
  /\/_next\/image/,
  /\.(jpg|jpeg|png|webp|avif)(\?|$)/,
]

// ── Lifecycle ─────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) =>
            (k.startsWith('quantix-sw-')  && k !== CACHE_NAME) ||
            (k.startsWith('quantix-img-') && k !== IMAGE_CACHE)
          )
          .map((k) => {
            console.log('[SW] Evicting stale cache:', k)
            return caches.delete(k)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// ── Message: receive buildId from CacheBuster ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SET_BUILD_ID') return
  const id = event.data.buildId
  CACHE_NAME  = `quantix-sw-${id}`
  IMAGE_CACHE = `quantix-img-${id}`
  console.log('[SW] Cache names set:', CACHE_NAME, IMAGE_CACHE)

  caches.keys().then((keys) =>
    Promise.all(
      keys
        .filter((k) =>
          (k.startsWith('quantix-sw-')  && k !== CACHE_NAME) ||
          (k.startsWith('quantix-img-') && k !== IMAGE_CACHE)
        )
        .map((k) => caches.delete(k))
    )
  )
})

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin GETs
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Hard bypass — auth / checkout / payment APIs never touch the cache
  if (BYPASS_RE.some((re) => re.test(url.pathname))) return

  // 1. Cache-first: hashed static bundles, icons, manifest
  if (STATIC_RE.some((re) => re.test(url.pathname + url.search))) {
    event.respondWith(cacheFirst(request, CACHE_NAME))
    return
  }

  // 2. Stale-while-revalidate: images (products, logos, banners)
  if (IMAGE_RE.some((re) => re.test(url.pathname + url.search))) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }

  // 3. Network-first: HTML pages — always fresh; cached as offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, CACHE_NAME))
    return
  }

  // 4. Network-first: storefront read APIs (products, categories, banners)
  if (
    url.pathname.startsWith('/api/core/storefront/') ||
    url.pathname.startsWith('/api/v1/')
  ) {
    event.respondWith(networkFirst(request, CACHE_NAME))
    return
  }
})

// ── Strategy helpers ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && cacheName !== 'quantix-sw-pending') {
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok && cacheName !== 'quantix-sw-pending') {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached ?? new Response('Offline — check your connection', {
      status: 503, statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(request)

  const revalidate = fetch(request).then(async (response) => {
    if (response.ok && cacheName !== 'quantix-img-pending') {
      await cache.put(request, response.clone())
      await trimCache(cache, MAX_IMAGE_ENTRIES)
    }
    return response
  }).catch(() => null)

  // Return stale immediately; revalidate in background
  return cached ?? (await revalidate) ?? new Response('', { status: 404 })
}

async function trimCache(cache, maxEntries) {
  try {
    const keys = await cache.keys()
    if (keys.length <= maxEntries) return
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)))
  } catch { /* non-fatal */ }
}
