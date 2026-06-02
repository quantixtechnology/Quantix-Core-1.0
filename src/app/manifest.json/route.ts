// GET /manifest.json — Dynamic per-tenant PWA Web App Manifest.
//
// Reads the Host header to identify the storefront subdomain, queries the
// Business record for name/color/logo, and returns a fully branded manifest.
// Falls back to generic Quantix defaults for non-storefront hosts.
//
// Icons:
//   All icons point to /api/core/pwa-icon/[slug]/[size].png which uses sharp
//   to resize the business logo to the exact declared pixel dimensions.
//   This guarantees Chrome's PWA installability checker is satisfied —
//   pointing at an arbitrary uploaded logo (wrong size, SVG, JPEG) causes
//   silent installability failures and suppresses beforeinstallprompt.
//
// Cache-Control is intentionally short (5 min) so branding changes propagate
// quickly without requiring a code deploy.

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

function shortName(name: string): string {
  if (name.length <= 14) return name
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 14)
  const two = `${words[0]} ${words[1]}`
  return two.length <= 14 ? two : words[0]
}

export async function GET(request: Request) {
  // ── Resolve tenant from Host header ───────────────────────────────────────
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0]

  let name        = 'Quantix Store'
  let theme       = '#10B981'
  let description = 'Your store — delivered fast.'
  let slug: string | null = null

  const isStorefront = host.endsWith(`.${SF_BASE}`)
  if (isStorefront) {
    const extractedSlug = host.slice(0, -(SF_BASE.length + 1))
    if (extractedSlug) {
      slug = extractedSlug
      try {
        const biz = await db.business.findUnique({
          where:  { slug },
          select: { name: true, primaryColor: true, description: true, tagline: true },
        })
        if (biz) {
          name        = biz.name
          theme       = biz.primaryColor ?? '#10B981'
          description = biz.description || biz.tagline || `${biz.name} — delivered fast.`
        }
      } catch {
        // Non-fatal — serve generic manifest
      }
    }
  }

  // ── Icon URLs ──────────────────────────────────────────────────────────────
  // For storefront tenants: use the icon generation route which resizes the
  // business logo to the exact declared sizes via sharp.
  // For non-storefront (admin, etc.): use the static fallback PNG.
  const icon192 = slug
    ? `/api/core/pwa-icon/${slug}/192.png`
    : '/quantix-logo.png'
  const icon512 = slug
    ? `/api/core/pwa-icon/${slug}/512.png`
    : '/quantix-logo.png'

  const manifest = {
    id:               '/',
    name,
    short_name:       shortName(name),
    description,
    start_url:        '/?source=pwa',
    display:          'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#ffffff',
    theme_color:      theme,
    orientation:      'portrait-primary',
    lang:             'en-IN',
    scope:            '/',
    categories:       ['shopping', 'lifestyle'],
    icons: [
      // Chrome requires at least one 192×192 and one 512×512 PNG icon.
      // The 'maskable' purpose enables adaptive icons on Android — the image
      // must have safe-zone padding. The pwa-icon route adds white padding
      // via sharp's 'contain' fit, which satisfies the maskable requirement.
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name:        'My Orders',
        short_name:  'Orders',
        description: 'View your order history',
        url:         '/?source=pwa',
        icons:       [{ src: icon192, sizes: '192x192', type: 'image/png' }],
      },
    ],
    prefer_related_applications: false,
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type':           'application/manifest+json; charset=utf-8',
      'Cache-Control':          'public, max-age=300, stale-while-revalidate=60',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
