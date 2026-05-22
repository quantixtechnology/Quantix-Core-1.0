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

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
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

  console.log(`[proxy] host=${host} pathname=${pathname} base=${STOREFRONT_BASE}`)

  // Storefront subdomain detection — skip for API, uploads, static assets, and Next internals
  const SKIP_PATHS = ['/api', '/uploads', '/sw.js', '/manifest.json', '/robots.txt', '/sitemap.xml']
  if (!SKIP_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const hostWithoutPort = host.split(':')[0]

    if (hostWithoutPort.endsWith(`.${STOREFRONT_BASE}`)) {
      const slug = hostWithoutPort.slice(0, -(STOREFRONT_BASE.length + 1))

      if (slug && !['www', 'app', 'admin', 'api', 'mail'].includes(slug)) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        url.searchParams.set('_storefront', slug)
        console.log(`[proxy] REWRITE slug=${slug} → ${url.toString()}`)
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
