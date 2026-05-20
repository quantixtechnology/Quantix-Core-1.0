// ============================================================================
// Next.js Edge Middleware — Subdomain → Storefront routing
//
// Runs at the edge on every request, BEFORE next.config.ts rewrites.
// Detects slug.quantixtechnology.in and rewrites to /?_storefront=slug
// so the SPA can hydrate in customer mode without showing admin login.
//
// Why middleware instead of next.config.ts rewrites:
//   next.config.ts rewrites are compiled at build time. If the env var
//   NEXT_PUBLIC_STOREFRONT_DOMAIN changes after the build, the rewrite
//   pattern is stale. Middleware reads env at runtime on every request.
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

export function middleware(request: NextRequest) {
  const host    = request.headers.get('host') || ''
  const { pathname } = request.nextUrl

  // Pass through Next.js internals, API routes, and static assets unchanged
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')   ||
    pathname.startsWith('/uploads') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Detect storefront subdomain: arbazchicken.quantixtechnology.in
  // Strip port (host may include :3000 in dev)
  const hostWithoutPort = host.split(':')[0]

  if (hostWithoutPort.endsWith(`.${STOREFRONT_BASE}`)) {
    const slug = hostWithoutPort.slice(0, -(STOREFRONT_BASE.length + 1))

    // Exclude reserved subdomains
    if (slug && !['www', 'app', 'admin', 'api', 'mail'].includes(slug)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('_storefront', slug)
      return NextResponse.rewrite(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on all paths except Next.js static chunks and images
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
