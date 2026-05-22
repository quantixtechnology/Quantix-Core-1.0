// Quantix Service Worker
// Cache name includes build ID so old caches are auto-deleted on deploy.
// Build ID is injected via postMessage from CacheBuster after registration.

const SW_CHANNEL = 'quantix-sw-channel'

let CACHE_NAME = 'quantix-sw-pending'

// Static asset patterns — content-hashed by Next.js, safe to cache forever
const STATIC_RE = [
  /\/_next\/static\//,
  /\/manifest\.json$/,
  /\/(quantix-logo|logo|icon-)\w*\.(png|svg|webp|ico)$/,
]

// ── Install: skip waiting so new SW activates immediately ──────────────────
self.addEventListener('install', () => {
  self.skipWaiting()
})

// ── Activate: delete every quantix-sw-* cache except the current one ──────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('quantix-sw-') && k !== CACHE_NAME)
          .map((k) => {
            console.log('[SW] Deleting stale cache:', k)
            return caches.delete(k)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// ── Message: receive buildId from CacheBuster ─────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BUILD_ID') {
    const buildId = event.data.buildId
    CACHE_NAME = `quantix-sw-${buildId}`
    console.log('[SW] Cache name set to:', CACHE_NAME)

    // Clean up old caches now that we have the real name
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('quantix-sw-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  }
})

// ── Fetch: network-first for everything; cache static assets as side-effect
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Never intercept API calls, POST/mutations, or cross-origin requests
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.origin !== location.origin
  ) {
    return
  }

  // Cache-first for content-hashed Next.js static bundles
  if (STATIC_RE.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok && CACHE_NAME !== 'quantix-sw-pending') {
            caches.open(CACHE_NAME).then((c) => c.put(request, response.clone()))
          }
          return response
        })
      })
    )
    return
  }

  // Network-first for HTML pages — always get fresh markup
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    )
  }
})
