import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isCandidateCustomHost, customHostCandidates } from '@/lib/custom-domain'
import { appIconVersion, effectiveAppLogo, parseAppLogos, APP_KEYS } from '@/lib/app-branding'

// ============================================================================
// One mark, every app the tenant installs.
//
// A business uploads its icon once, in Mobile Apps → App Branding, and expects
// to see it on the Customer, Delivery and Store apps. Two things stopped that.
//
// 1. On a customer's OWN domain the manifest had no tenant at all. It found the
//    slug by slicing the hostname against the platform domain, and a custom
//    domain has none in it — so every manifest there fell back to
//    /quantix-logo.png and a generic name. All three apps, not one. The tenant's
//    own branding was correct the whole time; nothing was asking for it.
//
// 2. An app with no icon of its own fell straight to the generated default.
//    Configuring the Customer icon left Delivery and Store unbranded from a
//    single upload, and the only remedy was to upload the same file again.
//
// This is the third place that resolved a tenant by slicing a hostname, after
// the storefront header and the client router. The rule now lives in one
// module and the manifest asks it.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MANIFEST = read('src/app/manifest.json/route.ts')
const BRANDING = read('src/lib/app-branding.ts')
const ICON     = read('src/app/api/core/app-icon/[slug]/[app]/[size]/route.ts')

const SF_BASE = 'quantixtechnology.in'

describe('1-3 · one configured icon reaches every app', () => {
  it('an app with no icon of its own borrows one the tenant DID configure', () => {
    expect(BRANDING).toContain('appLogo: effectiveAppLogo(appLogos, app)')
    expect(BRANDING).toContain('export function effectiveAppLogo(appLogos: Partial<Record<AppKey, string>>, app: AppKey)')
  })

  it('the order is fixed, so the answer never depends on key ordering', () => {
    expect(BRANDING).toContain('for (const key of ["customer", "delivery", "store", "admin"] as const)')
  })

  it('every app key is covered by that order', () => {
    const order = ['customer', 'delivery', 'store', 'admin']
    expect([...APP_KEYS].sort()).toEqual([...order].sort())
  })

  it('customer is preferred — it is the icon a business means by "the app icon"', () => {
    const fn = BRANDING.slice(BRANDING.indexOf('export function effectiveAppLogo'), BRANDING.indexOf('export async function resolveAppBranding'))
    expect(fn.indexOf('"customer"')).toBeLessThan(fn.indexOf('"admin"'))
  })
})

describe('4 · the fallback when the tenant configured nothing', () => {
  it('no uploaded icon anywhere yields null, and the generated mark takes over', () => {
    expect(BRANDING).toContain('return null')
    expect(ICON).toContain('png = await generatedAppIcon({ initial, glyph: def.glyph, accent: def.accent, size })')
  })

  it('the generated mark still carries the tenant, not Quantix', () => {
    // It is the business initial in the app's accent — a default, not another
    // company's logo.
    expect(ICON).toContain('const initial = (brand.businessName || "Q").trim().charAt(0).toUpperCase()')
  })

  it('the website logo is still never used as a launcher tile', () => {
    // A 3:1 lockup has no business inside a square icon.
    const fn = BRANDING.slice(BRANDING.indexOf('export function effectiveAppLogo'), BRANDING.indexOf('export async function resolveAppBranding'))
    expect(fn).not.toContain('sourceLogo')
    expect(fn).not.toContain('biz.logo')
  })
})

describe('5 · a custom domain resolves to ITS tenant and no other', () => {
  it('the manifest resolves a tenant hostname through DomainMapping', () => {
    expect(MANIFEST).toContain('if (!slug && isCandidateCustomHost(host, SF_BASE))')
    expect(MANIFEST).toContain('for (const candidate of customHostCandidates(host))')
    expect(MANIFEST).toContain('db.domainMapping.findFirst({')
    expect(MANIFEST).toContain('where: { domain: candidate },')
  })

  it('the match is exact — never by subdomain', () => {
    // A looser rule is how one tenant would serve another's branding.
    expect(customHostCandidates('shop.acme.com')).toEqual(['shop.acme.com'])
    expect(customHostCandidates('acme.com')).toEqual(['acme.com'])
  })

  it('www is the one alias, because the certificate already covers both', () => {
    expect(customHostCandidates('www.acme.com')).toEqual(['www.acme.com', 'acme.com'])
  })

  it('a hostname that maps to nothing stays generic', () => {
    expect(MANIFEST).toContain("let slug: string | null = null")
    expect(MANIFEST).toContain("icon192 = slug")
  })
})

describe('6 & 7 · the manifest carries the tenant icon at both sizes', () => {
  it('icons come from the per-tenant, per-app route', () => {
    expect(MANIFEST).toContain('/api/core/app-icon/${slug}/${app}/192.png?v=${v}')
    expect(MANIFEST).toContain('/api/core/app-icon/${slug}/${app}/512.png?v=${v}')
  })

  it('the icon route serves exactly those two sizes', () => {
    expect(ICON).toContain('const VALID_SIZES = new Set([192, 512])')
  })

  it('the slug in the path is the ownership boundary', () => {
    expect(ICON).toContain('if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return new Response("Invalid slug.", { status: 400 })')
  })
})

describe('8 · a changed icon reaches an installed app', () => {
  it('the URL is versioned from the icon itself', () => {
    // An unversioned URL is stable while its contents are not: a phone that
    // cached it once keeps the old mark forever.
    expect(appIconVersion('/x/one.png')).not.toBe(appIconVersion('/x/two.png'))
    expect(appIconVersion(null)).toBe('d')
  })

  it('the same icon keeps the same version, so nothing churns', () => {
    expect(appIconVersion('/x/one.png')).toBe(appIconVersion('/x/one.png'))
  })

  it('a BORROWING app versions the icon it actually shows', () => {
    // Versioning appLogos[app] would stamp "d" on delivery here, and replacing
    // the customer icon would never reach an installed delivery app.
    const logos = parseAppLogos(JSON.stringify({ customer: '/x/one.png' }))
    expect(effectiveAppLogo(logos, 'delivery')).toBe('/x/one.png')
    expect(appIconVersion(effectiveAppLogo(logos, 'delivery'))).toBe(appIconVersion('/x/one.png'))
    expect(appIconVersion(effectiveAppLogo(logos, 'delivery'))).not.toBe('d')
  })

  it('the manifest versions that same asset', () => {
    expect(MANIFEST).toContain('const v = appIconVersion(effectiveAppLogo(appLogos, app))')
  })

  it('an app with its OWN icon keeps its own version', () => {
    const logos = parseAppLogos(JSON.stringify({ customer: '/x/one.png', delivery: '/x/two.png' }))
    expect(effectiveAppLogo(logos, 'delivery')).toBe('/x/two.png')
  })

  it('a versioned request may be cached forever; an unversioned one may not', () => {
    expect(ICON).toContain('"public, max-age=31536000, immutable"')
    expect(ICON).toContain('"public, max-age=300, stale-while-revalidate=60"')
  })
})

describe('9 · the three tenant apps agree', () => {
  it('delivery. and store. are stripped, so all three resolve one tenant', () => {
    expect(MANIFEST).toContain("const host = isDeliveryHost ? rawHost.slice('delivery.'.length) : isStoreHost ? rawHost.slice('store.'.length) : rawHost")
  })

  it('each app asks for its own key against the same tenant', () => {
    expect(MANIFEST).toContain("iconSet('customer')")
    expect(MANIFEST).toContain("iconSet('delivery')")
    expect(MANIFEST).toContain("iconSet('store')")
  })
})

describe('the platform keeps its own branding', () => {
  it('a platform host is never treated as a custom domain', () => {
    for (const h of [SF_BASE, `www.${SF_BASE}`, `app.${SF_BASE}`, `laundry.${SF_BASE}`, `acme.${SF_BASE}`]) {
      expect(isCandidateCustomHost(h, SF_BASE)).toBe(false)
    }
  })

  it('Laundry OS still names itself', () => {
    expect(MANIFEST).toContain("name:             'Laundry OS'")
  })

  it('a raw address or localhost resolves nothing', () => {
    for (const h of ['13.205.43.103', 'localhost', '']) {
      expect(isCandidateCustomHost(h, SF_BASE)).toBe(false)
    }
  })
})

describe('10 · no tenant is named, and the platform-domain path is untouched', () => {
  it('the original slug branch still works exactly as before', () => {
    expect(MANIFEST).toContain('const isStorefront = host.endsWith(`.${SF_BASE}`)')
    expect(MANIFEST).toContain('where:  { slug: extractedSlug }')
  })

  it('the custom-domain branch only runs when the slug branch found nothing', () => {
    const slugAt = MANIFEST.indexOf('const isStorefront = host.endsWith')
    const customAt = MANIFEST.indexOf('if (!slug && isCandidateCustomHost')
    expect(slugAt).toBeLessThan(customAt)
  })

  it('nothing is hardcoded to a tenant', () => {
    for (const src of [MANIFEST, BRANDING, ICON]) {
      const lower = src.toLowerCase()
      expect(lower).not.toContain('vastrasudha')
      expect(lower).not.toContain('drycleaners')
    }
  })
})
