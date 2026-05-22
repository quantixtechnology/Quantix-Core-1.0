// Next.js middleware — must live at the project root (or src/middleware.ts).
// Handles subdomain → storefront routing and security headers.
//
// app.quantixtechnology.in  → passes through to admin SPA (no rewrite)
// foo.quantixtechnology.in  → rewrites to /?_storefront=foo (storefront SPA)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

// Subdomains that are never storefronts — they load the Quantix Core admin app.
const ADMIN_SUBDOMAINS = new Set(['app', 'www', 'admin', 'api', 'mail'])

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // Skip API routes, uploads, and Next.js internals — they handle themselves.
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next()
  }

  const hostWithoutPort = host.split(':')[0]

  if (hostWithoutPort.endsWith(`.${STOREFRONT_BASE}`)) {
    const slug = hostWithoutPort.slice(0, -(STOREFRONT_BASE.length + 1))

    if (slug && !ADMIN_SUBDOMAINS.has(slug)) {
      // e.g. freshmart.quantixtechnology.in → /?_storefront=freshmart
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('_storefront', slug)
      // Pass slug via header so SSR can read it without a query-string roundtrip
      const response = NextResponse.rewrite(url)
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v)
      return response
    }

    // app.quantixtechnology.in (or any other admin subdomain) — pass through
    // with a header the client can read to skip storefront detection entirely.
    const response = NextResponse.next()
    response.headers.set('x-quantix-host', 'admin')
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v)
    return response
  }

  // Non-subdomain requests (localhost, IP, custom domain)
  const response = NextResponse.next()
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
