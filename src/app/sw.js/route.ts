// GET /sw.js — Serves the Quantix Service Worker with the correct MIME type.
//
// WHY THIS EXISTS:
// Next.js standalone mode does not reliably serve files from public/ with the
// correct Content-Type. When the browser requests /sw.js and gets text/html
// (the SPA shell), the SW registration fails. This App Router route handler
// guarantees the correct Content-Type: application/javascript regardless of
// how the static file layer behaves.
//
// App Router route handlers always take precedence over public/ files.

import { readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const SW_CONTENT = `
// Quantix Service Worker — served via App Router route handler
// Cache name includes build ID injected from CacheBuster via postMessage.

let CACHE_NAME = 'quantix-sw-pending'

const STATIC_RE = [
  /\\/_next\\/static\\//,
  /\\/quantix-logo\\.png$/,
  /\\/logo\\.svg$/,
]

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('quantix-sw-') && k !== CACHE_NAME)
          .map((k) => { console.log('[SW] Deleting stale cache:', k); return caches.delete(k) })
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BUILD_ID') {
    CACHE_NAME = 'quantix-sw-' + event.data.buildId
    console.log('[SW] Cache name set to:', CACHE_NAME)
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('quantix-sw-') && k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return
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
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)))
  }
})
`.trim()

export async function GET() {
  // Try to read from public/sw.js first (has the canonical content)
  let content = SW_CONTENT
  try {
    content = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')
  } catch {
    // Fall back to inline content above
  }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
