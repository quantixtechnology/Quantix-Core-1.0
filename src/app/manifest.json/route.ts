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
  // ── App flavor ─────────────────────────────────────────────────────────────
  // ?app=delivery → Delivery PWA manifest ("{Business} Delivery", start_url
  // /delivery). The DeliveryLayout swaps the <link rel="manifest"> href to
  // this URL so agents install the workforce app, not the storefront.
  const isDelivery = new URL(request.url).searchParams.get('app') === 'delivery'
  // ?app=executive → Laundry Pickup & Delivery Executive PWA ("{Business} Pickup
  // & Delivery", start_url /laundry/executive). Installed alongside the customer
  // app as a separate, fully white-label field-ops app.
  // A `delivery.<tenant>` host IS the dedicated executive app — its manifest is
  // the executive flavor (root start_url) regardless of query params.
  const rawHost = (request.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const isDeliveryHost = rawHost.startsWith('delivery.')
  const isExecutive = isDeliveryHost || new URL(request.url).searchParams.get('app') === 'executive'
  // A `store.<tenant>` host IS the dedicated Store Admin app — its manifest is the
  // store flavor (root start_url) regardless of query params.
  const isStoreHost = rawHost.startsWith('store.')
  const isStore = isStoreHost || new URL(request.url).searchParams.get('app') === 'store'

  // ── Resolve tenant from Host header (strip the app prefix) ─────────────────
  const host = isDeliveryHost ? rawHost.slice('delivery.'.length) : isStoreHost ? rawHost.slice('store.'.length) : rawHost

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

  // Icons are shared between flavors (tenant logo); name/start_url/identity
  // differ so Android/iOS/desktop treat the Delivery PWA as a separate app
  // that can be installed alongside the customer storefront.
  // On a dedicated delivery.<tenant> host the app lives at the ROOT; on the shared
  // workspace host it lives under /laundry/executive.
  const execStart = isDeliveryHost ? '/?source=pwa' : '/laundry/executive?source=pwa'
  const execScope = isDeliveryHost ? '/' : '/laundry/executive'
  // On a dedicated store.<tenant> host the Store Admin app lives at the ROOT; on
  // the shared workspace host it lives under /laundry/store.
  const storeStart = isStoreHost ? '/?source=pwa' : '/laundry/store?source=pwa'
  const storeScope = isStoreHost ? '/' : '/laundry/store'
  const manifest = isStore
    ? {
        id:               isStoreHost ? '/' : '/laundry/store',
        name:             `${name} Admin App`,
        short_name:       shortName(name),
        description:      'Store operations — orders, audit, payment, dispatch',
        start_url:        storeStart,
        display:          'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#ffffff',
        theme_color:      theme,
        orientation:      'portrait-primary',
        lang:             'en-IN',
        scope:            storeScope,
        categories:       ['business', 'productivity'],
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        prefer_related_applications: false,
      }
    : isExecutive
    ? {
        id:               isDeliveryHost ? '/' : '/laundry/executive',
        name:             `${name} Delivery App`,
        short_name:       shortName(name),
        description:      'Pickup & delivery field operations',
        start_url:        execStart,
        display:          'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#ffffff',
        theme_color:      theme,
        orientation:      'portrait-primary',
        lang:             'en-IN',
        scope:            execScope,
        categories:       ['business', 'productivity'],
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        prefer_related_applications: false,
      }
    : isDelivery
    ? {
        id:               '/delivery',
        name:             `${name} Delivery App`,
        short_name:       'Delivery',
        description:      'Delivery workforce application',
        start_url:        '/delivery?source=pwa',
        display:          'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#ffffff',
        theme_color:      theme,
        orientation:      'portrait-primary',
        lang:             'en-IN',
        scope:            '/',
        categories:       ['business', 'productivity'],
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name:        'My Deliveries',
            short_name:  'Deliveries',
            description: 'View assigned delivery orders',
            url:         '/delivery?source=pwa',
            icons:       [{ src: icon192, sizes: '192x192', type: 'image/png' }],
          },
        ],
        prefer_related_applications: false,
      }
    : {
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
