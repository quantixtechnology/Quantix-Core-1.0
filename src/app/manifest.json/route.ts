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
import { getProductCodeForHost } from '@/lib/product-hosts'
import type { AppKey } from '@/lib/app-branding'

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
  // An explicit ?app= names the flavour and WINS over the host's default.
  //
  // THE BUG THIS FIXES: the host checks were evaluated first, so on the Laundry
  // OS host /manifest.json?app=executive returned the Laundry OS manifest. The
  // Delivery PWA linked a manifest describing a different app — and once
  // Laundry OS was installed, Chrome saw that app id already present and never
  // fired beforeinstallprompt, so "Install App" fell back to instructions.
  const appParam = new URL(request.url).searchParams.get('app')
  const isDelivery = appParam === 'delivery'
  // ?app=executive → Laundry Pickup & Delivery Executive PWA ("{Business} Pickup
  // & Delivery", start_url /laundry/executive). Installed alongside the customer
  // app as a separate, fully white-label field-ops app.
  // A `delivery.<tenant>` host IS the dedicated executive app — its manifest is
  // the executive flavor (root start_url) regardless of query params.
  const rawHost = (request.headers.get('host') ?? '').toLowerCase().split(':')[0]
  const isDeliveryHost = rawHost.startsWith('delivery.')
  const isExecutive = appParam ? appParam === 'executive' : isDeliveryHost
  // A `store.<tenant>` host IS the dedicated Store Admin app — its manifest is the
  // store flavor (root start_url) regardless of query params.
  const isStoreHost = rawHost.startsWith('store.')
  const isStore = appParam ? appParam === 'store' : isStoreHost
  // The Laundry OS workspace host (laundry.<base>) IS the unified operations
  // app. It had no flavour here, so it fell through to the customer storefront
  // manifest and installed as "Quantix Store" — a phone-shaped app with the
  // wrong name, wrong colour and a storefront description.
  //
  // ONE host, ONE installed app, no tenant in the URL: the manifest names the
  // product, never a business, because the same installation must serve
  // whichever tenants the person signing in is actually authorized for. The
  // install URL grants nothing; the server decides that after login.
  const isLaundryOsHost = getProductCodeForHost(rawHost, SF_BASE) === 'LAUNDRY'
  const isLaundryOs = appParam ? appParam === 'laundry-os' : isLaundryOsHost

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
      try {
        const biz = await db.business.findUnique({
          where:  { slug: extractedSlug },
          select: { name: true, primaryColor: true, description: true, tagline: true },
        })
        if (biz) {
          // Only a slug backed by a real Business is a tenant. `app.<base>` is
          // not a storefront: claiming it was pointed the icons at
          // /api/core/pwa-icon/app/… , which resolves to nothing, and a
          // manifest whose icons 404 is not installable at all.
          slug        = extractedSlug
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

  // APPLICATION icons, one set per installed app.
  //
  // The website logo and a launcher icon are different assets: reusing one for
  // all four apps is exactly why the installed apps looked identical. Each app
  // resolves its own icon, falling back to the business logo and then to a
  // generated default carrying that app's accent and glyph.
  //
  // Off a tenant host there is no business to brand, so the static mark stands.
  const appIcons = (app: AppKey) =>
    slug
      ? { i192: `/api/core/app-icon/${slug}/${app}/192.png`, i512: `/api/core/app-icon/${slug}/${app}/512.png` }
      : { i192: '/quantix-logo.png', i512: '/quantix-logo.png' }
  const iconSet = (app: AppKey) => {
    const { i192, i512 } = appIcons(app)
    return [
      { src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' as const },
      { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' as const },
      { src: i512, sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
    ]
  }

  // Icons are shared between flavors (tenant logo); name/start_url/identity
  // differ so Android/iOS/desktop treat the Delivery PWA as a separate app
  // that can be installed alongside the customer storefront.
  // On a dedicated delivery.<tenant> host the app lives at the ROOT; on the shared
  // workspace host it lives under /laundry/executive.
  const execStart = isDeliveryHost ? '/?source=pwa' : '/laundry/executive?source=pwa'
  const execScope = isDeliveryHost ? '/' : '/laundry/executive'
  // On a dedicated store.<tenant> host the Store Admin app lives at the ROOT; on
  // the shared workspace host it lives under /laundry/store.
  // Installed-app label: ROLE FIRST, business second.
  //
  // Android puts short_name on the launcher and truncates it, so
  // "{Business} Admin" and "{Business} Delivery" both rendered as
  // "Laundry & Dry…" — two icons with the same visible name. Leading with the
  // role keeps them apart however hard the label is cut.
  //
  // With no tenant resolved there is no business to name, so the role stands
  // alone rather than being glued to a generic placeholder.
  const appLabel = (role: 'Admin' | 'Delivery') => (slug ? `${role} ${name}` : role)

  const storeStart = isStoreHost ? '/?source=pwa' : '/laundry/store?source=pwa'
  const storeScope = isStoreHost ? '/' : '/laundry/store'
  const manifest = isLaundryOs
    ? {
        id:               '/',
        name:             'Laundry OS',
        short_name:       'Laundry OS',
        description:      'Unified laundry operations — store, processing and administration',
        start_url:        '/?source=pwa',
        display:          'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#ffffff',
        // Product identity, not tenant identity — one installed app for every
        // business the operator is authorized for.
        theme_color:      '#2563EB',
        // An operations console runs on a desk or a tablet stand; pinning it to
        // portrait is what makes an installed desktop app feel broken.
        orientation:      'any',
        lang:             'en-IN',
        scope:            '/',
        categories:       ['business', 'productivity'],
        icons: [
          { src: '/quantix-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/quantix-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/quantix-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        prefer_related_applications: false,
      }
    : isStore
    ? {
        id:               isStoreHost ? '/' : '/laundry/store',
        // ROLE FIRST. Android shows short_name on the launcher and truncates it,
        // so "{Business} Admin" and "{Business} Delivery" both collapsed to the
        // same visible label — two identical icons. Leading with the role keeps
        // them apart even when the tail is cut: "Admin Laundry &…".
        name:             appLabel('Admin'),
        short_name:       appLabel('Admin'),
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
        icons: iconSet('store'),
        prefer_related_applications: false,
      }
    : isExecutive
    ? {
        id:               isDeliveryHost ? '/' : '/laundry/executive',
        // Role first, for the same reason as the Admin app above.
        name:             appLabel('Delivery'),
        short_name:       appLabel('Delivery'),
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
        icons: iconSet('delivery'),
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
        // Chrome requires a 192 and a 512 PNG; 'maskable' enables Android's
        // adaptive icon, which needs safe-zone padding — the icon route pads
        // with sharp's 'contain' fit, satisfying it.
        icons: iconSet('customer'),
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
