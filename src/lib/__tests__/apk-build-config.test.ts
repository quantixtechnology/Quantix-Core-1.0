import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { apkBuildConfig, androidPackageId, canonicalHost, PACKAGED_APPS } from '@/lib/apk-build-config'

// ============================================================================
// The builder must not compose a tenant's hosts.
//
// It used to: <slug>.<base>, for every business. That is right only for a
// tenant who never brought a domain of their own, and wrong for everyone who
// did — the APK opened a hostname with no certificate on it, so the app
// installed, launched, and failed on its first request. Nothing in the build
// was broken; it had simply been told the wrong address.
//
// So the address, the label, the Android id, the flavour and the icon all come
// from the tenant's own configuration, through one endpoint, and the script
// invents none of them. A business created tomorrow gets the same treatment
// without anybody touching this file.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const SCRIPT = read('scripts/build-tenant-apks.sh')
const ROUTE  = read('src/app/api/core/apk-build-config/[slug]/route.ts')
const LIB    = read('src/lib/apk-build-config.ts')

const BASE = 'quantixtechnology.in'
const withDomain = { slug: 'vastrasudha', name: 'VASTRASUDHA', domain: { domain: 'vastrasudha.co.in' } }
const slugOnly = { slug: 'laundrydrycleaners', name: 'Laundry & Drycleaners', domain: null }

describe('the canonical host, never a composed one', () => {
  it("a tenant's own domain wins", () => {
    expect(canonicalHost(withDomain, BASE)).toBe('vastrasudha.co.in')
  })

  it('the slug host is the fallback, not the assumption', () => {
    expect(canonicalHost(slugOnly, BASE)).toBe('laundrydrycleaners.quantixtechnology.in')
  })

  it('a tenant with neither yields nothing rather than a guess', () => {
    expect(canonicalHost({ slug: null, domain: null }, BASE)).toBeNull()
    expect(apkBuildConfig({ slug: null, name: 'X', domain: null }, BASE)).toBeNull()
  })

  it('the three apps sit on the prefixes the platform certifies', () => {
    const cfg = apkBuildConfig(withDomain, BASE)!
    expect(cfg.apps.map((a) => a.host)).toEqual([
      'vastrasudha.co.in', 'delivery.vastrasudha.co.in', 'store.vastrasudha.co.in',
    ])
  })

  it('and on the slug host when that is the tenant address', () => {
    const cfg = apkBuildConfig(slugOnly, BASE)!
    expect(cfg.apps.map((a) => a.host)).toEqual([
      'laundrydrycleaners.quantixtechnology.in',
      'delivery.laundrydrycleaners.quantixtechnology.in',
      'store.laundrydrycleaners.quantixtechnology.in',
    ])
  })

  it('every app opens over https', () => {
    for (const a of apkBuildConfig(withDomain, BASE)!.apps) expect(a.url).toMatch(/^https:\/\//)
  })
})

describe('Android application ids', () => {
  it('are valid, deterministic and stable across rebuilds', () => {
    expect(androidPackageId('vastrasudha', 'customer')).toBe('in.quantixtechnology.laundry.customer.vastrasudha')
    expect(androidPackageId('vastrasudha', 'customer')).toBe(androidPackageId('vastrasudha', 'customer'))
    for (const app of PACKAGED_APPS) {
      expect(androidPackageId('vastrasudha', app)).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/)
    }
  })

  it('differ per app, so one tenant\'s three coexist on a phone', () => {
    const ids = PACKAGED_APPS.map((a) => androidPackageId('acme', a))
    expect(new Set(ids).size).toBe(PACKAGED_APPS.length)
  })

  it('differ per tenant, so two businesses coexist too', () => {
    expect(androidPackageId('acme', 'customer')).not.toBe(androidPackageId('beta', 'customer'))
  })

  it('survive a name a person typed', () => {
    // Hyphens, spaces and capitals are not package syntax.
    expect(androidPackageId('My-Laundry Co', 'store')).toBe('in.quantixtechnology.laundry.store.mylaundryco')
  })

  it('never begin a segment with a digit', () => {
    expect(androidPackageId('24seven', 'customer')).toBe('in.quantixtechnology.laundry.customer.t24seven')
    expect(androidPackageId('---', 'customer')).toMatch(/\.t$/)
  })
})

describe('branding and naming follow the tenant', () => {
  it('the label is what the installed PWA calls itself', () => {
    const cfg = apkBuildConfig(withDomain, BASE)!
    expect(cfg.apps.find((a) => a.key === 'customer')!.label).toBe('VASTRASUDHA')
    expect(cfg.apps.find((a) => a.key === 'delivery')!.label).toBe('Delivery VASTRASUDHA')
    expect(cfg.apps.find((a) => a.key === 'store')!.label).toBe('Store Admin VASTRASUDHA')
  })

  it('a different tenant gets its own labels', () => {
    const cfg = apkBuildConfig(slugOnly, BASE)!
    expect(cfg.apps.find((a) => a.key === 'customer')!.label).toBe('Laundry & Drycleaners')
    expect(cfg.apps.find((a) => a.key === 'delivery')!.label).toBe('Delivery Laundry & Drycleaners')
  })

  it('each app carries ITS OWN configured icon', () => {
    const cfg = apkBuildConfig(withDomain, BASE, { customer: 'aaa', delivery: 'bbb', store: 'ccc' })!
    expect(cfg.apps.find((a) => a.key === 'customer')!.iconPath).toBe('/api/core/app-icon/vastrasudha/customer/192.png?v=aaa')
    expect(cfg.apps.find((a) => a.key === 'delivery')!.iconPath).toBe('/api/core/app-icon/vastrasudha/delivery/192.png?v=bbb')
  })

  it('the icon URL is versioned, so a replaced icon reaches a rebuild', () => {
    expect(ROUTE).toContain('appIconVersion(effectiveAppLogo(logos, "customer"))')
    expect(LIB).toContain('?v=${v}')
  })

  it('only the scanning apps declare a camera', () => {
    const cfg = apkBuildConfig(withDomain, BASE)!
    expect(cfg.apps.find((a) => a.key === 'customer')!.flavour).toBe('viewer')
    expect(cfg.apps.find((a) => a.key === 'delivery')!.flavour).toBe('scanner')
    expect(cfg.apps.find((a) => a.key === 'store')!.flavour).toBe('scanner')
  })
})

describe('every tenant, automatically, with no code to change', () => {
  it('a business invented right now is configured like any other', () => {
    const brandNew = { slug: 'tomorrows-laundry', name: "Tomorrow's Laundry", domain: null }
    const cfg = apkBuildConfig(brandNew, BASE)!
    expect(cfg.apps).toHaveLength(3)
    expect(cfg.apps[0].host).toBe('tomorrows-laundry.quantixtechnology.in')
    expect(cfg.apps[0].packageId).toBe('in.quantixtechnology.laundry.customer.tomorrowslaundry')
    expect(cfg.apps[0].label).toBe("Tomorrow's Laundry")
  })

  it('no tenant is named in the config, the route or the script', () => {
    for (const src of [LIB, ROUTE, SCRIPT]) {
      const lower = src.toLowerCase()
      expect(lower).not.toContain('vastrasudha')
      expect(lower).not.toContain('drycleaners')
    }
  })

  it('no domain is hardcoded — the base comes from the environment', () => {
    expect(ROUTE).toContain('process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN')
    expect(LIB).not.toContain('quantixtechnology.in')
  })

  it('Laundry OS is not packaged — it is the platform workspace', () => {
    expect([...PACKAGED_APPS]).toEqual(['customer', 'delivery', 'store'])
    expect([...PACKAGED_APPS]).not.toContain('admin')
  })
})

describe('the script composes nothing', () => {
  it('it reads the configuration instead of building hosts', () => {
    expect(SCRIPT).toContain('CONFIG_URL="$ICON_HOST/api/core/apk-build-config/$SLUG"')
    expect(SCRIPT).not.toContain('$SLUG.$BASE')
    expect(SCRIPT).not.toContain('delivery.$SLUG')
  })

  it('an unreachable or unknown tenant stops the build', () => {
    // Better than packaging an APK against a guess.
    expect(SCRIPT).toContain('Could not read the build configuration')
    expect(SCRIPT).toContain('exit 1')
  })

  it('it passes the platform\'s values straight through to Gradle', () => {
    expect(SCRIPT).toContain('-PquantixAppId="$appId"')
    expect(SCRIPT).toContain('-PquantixAppLabel="$label"')
    expect(SCRIPT).toContain('-PquantixLaunchUrl="$url"')
  })

  it('signing still comes from the environment, never the repo', () => {
    expect(SCRIPT).toContain('QUANTIX_KEYSTORE_PATH')
    expect(SCRIPT).not.toContain('keystore.jks')
  })

  it('the built APK is still verified before it is published', () => {
    expect(SCRIPT).toContain('SIGNATURE DID NOT VERIFY')
    expect(SCRIPT).toContain('APK IS NOT ALIGNED')
  })
})

describe('the endpoint exposes configuration, not machinery', () => {
  it('it reveals nothing a storefront visitor cannot already see', () => {
    expect(ROUTE).not.toContain('KEYSTORE')
    expect(ROUTE).not.toContain('process.cwd()')
    expect(ROUTE).not.toContain('public/apks')
  })

  it('it reads one business, by slug', () => {
    expect(ROUTE).toContain('where: { slug: slug.toLowerCase() },')
    expect(ROUTE).toContain('if (!slug || !/^[a-z0-9-]+$/i.test(slug))')
  })

  it('it is never cached — branding and domains change', () => {
    expect(ROUTE).toContain('"Cache-Control": "no-store"')
  })
})
