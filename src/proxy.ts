// ============================================================================
// Quantix Technology — Next.js Proxy
//
// Next.js 16 uses proxy.ts (replaces middleware.ts).
// This file handles both:
//   1. Subdomain → Storefront routing (slug.quantixtechnology.in → /?_storefront=slug)
//   2. Security headers on all responses
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getProductCodeForHost, getProductEntryRoute, isReservedHostPrefix, SHARED_HOST_PATHS } from '@/lib/product-hosts'

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

// Per-request tracing is opt-in (PROXY_DEBUG=1) to avoid log-spam/cost in prod.
const DEBUG = process.env.PROXY_DEBUG === '1'
const log = (...args: unknown[]) => { if (DEBUG) console.log(...args) }

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Allow SAME-ORIGIN camera + geolocation: the laundry apps need the camera for
  // QR/bag scanning (executive PWA, packing/audit) and geolocation for pickup
  // navigation. `camera=()` (empty allowlist) previously DISABLED the camera for
  // the whole document, so getUserMedia failed regardless of the browser grant.
  // Microphone stays disabled. Cross-origin embeds remain blocked (self only).
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export default function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  log(`[proxy] host=${host} pathname=${pathname} base=${STOREFRONT_BASE}`)

  // Storefront subdomain detection — skip for API, uploads, static assets, and Next internals
  const SKIP_PATHS = ['/api', '/uploads', '/sw.js', '/manifest.json', '/robots.txt', '/sitemap.xml', '/.well-known']
  if (!SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const hostWithoutPort = host.split(':')[0]

    // 0) Dedicated Laundry Executive PWA host: delivery.<tenant>.<base> (and, on
    // a custom domain, delivery.<customdomain>). The whole subdomain IS the
    // executive app — serve /laundry/executive at the root so the URL stays
    // clean (delivery.<tenant>/…) and the app resolves the tenant from the host.
    // API / sw.js / manifest.json are in SKIP_PATHS and pass straight through.
    if (hostWithoutPort.startsWith('delivery.')) {
      const url = request.nextUrl.clone()
      if (!pathname.startsWith('/laundry/executive')) url.pathname = '/laundry/executive'
      url.searchParams.set('_exec', '1')
      log(`[proxy] EXECUTIVE host=${hostWithoutPort} → ${url.toString()}`)
      return withSecurityHeaders(NextResponse.rewrite(url))
    }

    // 1) Product workspace host (commerce.*, laundry.*, …) — handled BEFORE
    // storefront so a product subdomain is never mistaken for a tenant slug.
    const productCode = getProductCodeForHost(hostWithoutPort, STOREFRONT_BASE)
    if (productCode) {
      const productSeg = `/${productCode.toLowerCase()}` // e.g. /commerce
      const segments = pathname.split('/').filter(Boolean)
      // Pass through unchanged when:
      //   - already inside the product's own route tree (deep links), or
      //   - a shared cross-host app route (/reset-password, /change-password, …).
      const isDeepLink = pathname === productSeg || pathname.startsWith(`${productSeg}/`)
      const isSharedPath = SHARED_HOST_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
      if (isDeepLink || isSharedPath) {
        return withSecurityHeaders(NextResponse.next())
      }
      // Otherwise rewrite to the product's real entry route. Only a single bare
      // segment is treated as a businessId (workspace URLs are
      // <product>.<base>/<businessId>); deeper unknown paths just land on the
      // entry route. The rewrite target is never itself a product host, so this
      // cannot re-enter the product branch (no rewrite loop).
      const url = request.nextUrl.clone()
      url.pathname = getProductEntryRoute(productCode)
      if (segments.length === 1) url.searchParams.set('businessId', segments[0])
      url.searchParams.set('_product', productCode)
      log(`[proxy] PRODUCT host=${hostWithoutPort} product=${productCode} → ${url.toString()}`)
      return withSecurityHeaders(NextResponse.rewrite(url))
    }

    // 2) Tenant storefront subdomain.
    if (hostWithoutPort.endsWith(`.${STOREFRONT_BASE}`)) {
      const slug = hostWithoutPort.slice(0, -(STOREFRONT_BASE.length + 1))

      if (slug && !isReservedHostPrefix(slug)) {
        const url = request.nextUrl.clone()
        // Public pages keep their path; all other storefront paths rewrite to /
        const PUBLIC_PATHS = ['/delete-account', '/reset-password']
        if (!PUBLIC_PATHS.includes(pathname)) {
          url.pathname = '/'
        }
        url.searchParams.set('_storefront', slug)
        // /delivery on a storefront host is the Delivery PWA entry point
        // (login + agent dashboard). The flag survives the rewrite so the
        // SPA can boot straight into delivery mode instead of the storefront.
        if (pathname === '/delivery' || pathname.startsWith('/delivery/')) {
          url.searchParams.set('_delivery', '1')
        }
        log(`[proxy] REWRITE slug=${slug} → ${url.toString()}`)
        return withSecurityHeaders(NextResponse.rewrite(url))
      }
    }
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
