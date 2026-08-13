// GET /api/debug/runtime-layout
// Returns what the server sees as the host and what routing decision would be made.
// Client-side slug detection is not replicated here (that runs in the browser),
// but the Host header tells us whether we're on the admin host or a storefront subdomain.
//
// Public — no auth. TEMP: remove after routing confirmed stable.

import { NextResponse } from 'next/server'
import { platformOnly } from "@/lib/platform-guard"

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'
const PLATFORM_HOSTS = new Set([
  `app.${SF_BASE}`,
  SF_BASE,
  `www.${SF_BASE}`,
])
const RESERVED = new Set(['www', 'app', 'admin', 'api', 'mail'])

export async function GET(req: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(req)
  if (_denied) return _denied
  const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '(unknown)'
  const hostname = host.split(':')[0]

  const isPlatformHost = PLATFORM_HOSTS.has(hostname)

  let storefrontSlug: string | null = null
  if (!isPlatformHost && hostname.endsWith(`.${SF_BASE}`)) {
    const slug = hostname.slice(0, -(SF_BASE.length + 1))
    if (slug && !RESERVED.has(slug)) storefrontSlug = slug
  }

  const layout = isPlatformHost
    ? 'admin (Quantix Core)'
    : storefrontSlug
      ? `storefront — slug: ${storefrontSlug}`
      : 'unknown (non-platform, non-subdomain)'

  return NextResponse.json({
    host,
    hostname,
    isPlatformHost,
    storefrontSlug,
    layout,
    sfBase: SF_BASE,
    platformHosts: [...PLATFORM_HOSTS],
    verdict: isPlatformHost
      ? `✅ Admin host — will render Quantix Core login`
      : storefrontSlug
        ? `✅ Storefront host — slug "${storefrontSlug}" will be validated against DB`
        : `⚠️  Unrecognised host — will fall through to admin layout`,
  })
}
