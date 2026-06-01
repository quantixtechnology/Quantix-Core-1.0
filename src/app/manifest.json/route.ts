// GET /manifest.json — Dynamic per-tenant PWA Web App Manifest.
//
// Reads the Host header to identify the storefront subdomain, queries the
// Business record for name/color/logo, and returns a fully branded manifest.
// Falls back to generic Quantix defaults for non-storefront hosts.
//
// Cache-Control is intentionally short (5 min) so branding changes propagate
// quickly without requiring a code deploy.

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SF_BASE = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

function shortName(name: string): string {
  if (name.length <= 14) return name
  // Use first two words, cap at 14 chars
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name.slice(0, 14)
  const two = `${words[0]} ${words[1]}`
  return two.length <= 14 ? two : words[0]
}

function iconMimeType(url: string): string {
  const lower = url.toLowerCase()
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'image/png'
}

export async function GET(request: Request) {
  // ── Resolve tenant from Host header ───────────────────────────────────────
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0]

  let name        = 'Quantix Store'
  let theme       = '#10B981'
  let iconSrc     = '/quantix-logo.png'
  let description = 'Your store — delivered fast.'

  const isStorefront = host.endsWith(`.${SF_BASE}`)
  if (isStorefront) {
    const slug = host.slice(0, -(SF_BASE.length + 1))
    if (slug) {
      try {
        const biz = await db.business.findUnique({
          where:  { slug },
          select: { name: true, primaryColor: true, logo: true, description: true, tagline: true },
        })
        if (biz) {
          name        = biz.name
          theme       = biz.primaryColor ?? '#10B981'
          iconSrc     = biz.logo || '/quantix-logo.png'
          description = biz.description || biz.tagline || `${biz.name} — delivered fast.`
        }
      } catch {
        // Non-fatal — serve generic manifest
      }
    }
  }

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
      {
        src:     iconSrc,
        sizes:   '192x192',
        type:    iconMimeType(iconSrc),
        purpose: 'any',
      },
      {
        src:     iconSrc,
        sizes:   '512x512',
        type:    iconMimeType(iconSrc),
        purpose: 'any',
      },
      {
        src:     iconSrc,
        sizes:   '512x512',
        type:    iconMimeType(iconSrc),
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name:        'My Orders',
        short_name:  'Orders',
        description: 'View your order history',
        url:         '/?source=pwa',
        icons:       [{ src: iconSrc, sizes: '96x96' }],
      },
    ],
    prefer_related_applications: false,
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type':          'application/manifest+json; charset=utf-8',
      // 5-minute cache — short enough for branding changes to propagate
      'Cache-Control':         'public, max-age=300, stale-while-revalidate=60',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
