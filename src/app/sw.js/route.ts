// GET /sw.js — Serves the Quantix Service Worker with the correct MIME type.
//
// WHY THIS EXISTS:
// Next.js standalone mode does not reliably serve files from public/ with the
// correct Content-Type. When the browser requests /sw.js and gets text/html
// (the SPA shell), the SW registration fails. This App Router route handler
// guarantees Content-Type: application/javascript regardless of the static
// file serving layer.
//
// The canonical SW is in public/sw.js — this handler reads it at runtime.
// The inline SW_FALLBACK is only used if public/sw.js is somehow missing
// (should never happen in a proper deployment).
//
// TEMPORARY BYPASS: set NEXT_PUBLIC_DISABLE_SW=true to serve a no-op service
// worker that never intercepts requests. This neuters existing registrations
// without any client-side cache interaction. Remove the flag after incident
// investigation is resolved.

import { readFileSync } from 'fs'
import { join }         from 'path'

export const dynamic = 'force-dynamic'

// Minimal fallback — same logic as public/sw.js but trimmed.
// Replaced at runtime by the full public/sw.js content.
const SW_FALLBACK = `
let CACHE_NAME = 'quantix-sw-pending'
let IMAGE_CACHE = 'quantix-img-pending'
const BYPASS_RE = [/\\/api\\/core\\/storefront\\/auth\\//, /\\/api\\/v1\\/auth\\//]
const STATIC_RE = [/\\/_next\\/static\\//]
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()) })
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SET_BUILD_ID') {
    CACHE_NAME  = 'quantix-sw-' + e.data.buildId
    IMAGE_CACHE = 'quantix-img-' + e.data.buildId
  }
})
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (BYPASS_RE.some((r) => r.test(url.pathname))) return
  if (STATIC_RE.some((r) => r.test(url.pathname))) {
    e.respondWith(caches.match(request).then((c) => c || fetch(request)))
  }
})
`.trim()

export async function GET() {
  // TEMPORARY: serve a no-op SW when the disable flag is set.
  // Existing SW registrations will be replaced with this harmless worker
  // on their next update check, without any caching or fetch interception.
  if (process.env.NEXT_PUBLIC_DISABLE_SW === "true") {
    return new Response('self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()))', {
      status: 200,
      headers: {
        'Content-Type':          'application/javascript; charset=utf-8',
        'Service-Worker-Allowed': '/',
        'Cache-Control':         'no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  let content = SW_FALLBACK
  try {
    content = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')
  } catch { /* use fallback */ }

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type':          'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control':         'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
