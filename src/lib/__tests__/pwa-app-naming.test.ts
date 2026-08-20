import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Two installed apps, two distinguishable names.
//
// The Delivery and Admin PWAs both put the business name in `short_name`, so
// Android drew two launcher icons reading the same thing:
//
//   Laundry & Drycleaners        Laundry & Drycleaners
//
// Android shows `short_name` on the launcher and truncates it, so the fix is
// not a longer name — it is putting the ROLE FIRST, where the truncation
// cannot reach it:
//
//   Delivery Laundry &…          Admin Laundry &…
//
// A business-first label ("Laundry & Drycleaners Delivery") truncates to the
// identical prefix again, which is the bug.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const MANIFEST = read('src/app/manifest.json/route.ts')
const STORE_LAYOUT = read('src/app/laundry/store/layout.tsx')
const EXEC_LAYOUT = read('src/app/laundry/executive/layout.tsx')

/** The Store Admin manifest block. */
const storeBlock = MANIFEST.slice(MANIFEST.indexOf('    : isStore'), MANIFEST.indexOf('    : isExecutive'))
/** The Executive / Delivery manifest block. */
const execBlock = MANIFEST.slice(MANIFEST.indexOf('    : isExecutive'), MANIFEST.indexOf('    : isDelivery'))

describe('the role comes first', () => {
  it('the Admin PWA is labelled "Admin {Business}"', () => {
    expect(storeBlock).toContain("name:             appLabel('store')")
    expect(storeBlock).toContain("short_name:       appLabel('store')")
  })

  it('the Delivery PWA is labelled "Delivery {Business}"', () => {
    expect(execBlock).toContain("name:             appLabel('delivery')")
    expect(execBlock).toContain("short_name:       appLabel('delivery')")
  })

  it('the label puts the role before the business, never after', () => {
    // Name and icon resolve from the SAME registry, so they cannot drift.
    expect(MANIFEST).toContain('const appLabel = (app: AppKey) => appDisplayName(app, slug ? name : null)')
    // The old business-first forms are gone from both tenant apps.
    expect(storeBlock).not.toContain('${name} Admin')
    expect(execBlock).not.toContain('${name} Delivery')
  })

  it('short_name is no longer the bare business name', () => {
    // This is what made the two launcher entries identical.
    expect(storeBlock).not.toContain('short_name:       shortName(name)')
    expect(execBlock).not.toContain('short_name:       shortName(name)')
  })

  it('the role prefix is never abbreviated away to fit', () => {
    // short_name carries the FULL role + business; truncation is Android's job
    // and it cuts the tail, which is exactly what we want it to cut.
    expect(storeBlock).not.toContain("short_name:       'Admin'")
    expect(execBlock).not.toContain("short_name:       'Delivery'")
  })
})

describe('the business name stays dynamic', () => {
  it('no tenant name is hardcoded in the manifest', () => {
    for (const banned of ['Laundry & Drycleaners', 'Drycleaners', 'VASTRASUDHA', 'Vastrasudha']) {
      expect(MANIFEST).not.toContain(banned)
      expect(STORE_LAYOUT).not.toContain(banned)
      expect(EXEC_LAYOUT).not.toContain(banned)
    }
  })

  it('the name is resolved from the tenant, not invented', () => {
    // The manifest reads the Business row keyed on the host's slug.
    expect(MANIFEST).toContain('db.business.findUnique')
    expect(MANIFEST).toContain('where:  { slug: extractedSlug }')
  })

  it('each layout reuses its existing tenant resolver', () => {
    // No second resolution mechanism was introduced for naming.
    expect(STORE_LAYOUT).toContain('resolveStoreTenant')
    expect(EXEC_LAYOUT).toContain('resolveExecutiveTenant')
  })
})

describe('the flavour is decided by ?app=, not by the host', () => {
  it('an explicit app param wins over the host default', () => {
    // On the Laundry OS host, ?app=executive returned the Laundry OS manifest:
    // the Delivery PWA linked a manifest for a DIFFERENT app, and once Laundry
    // OS was installed Chrome stopped offering to install anything.
    expect(MANIFEST).toContain("const isExecutive = appParam ? appParam === 'executive' : isDeliveryHost")
    expect(MANIFEST).toContain("const isStore = appParam ? appParam === 'store' : isStoreHost")
    expect(MANIFEST).toContain("const isLaundryOs = appParam ? appParam === 'laundry-os' : isLaundryOsHost")
  })

  it('a host with no app param still gets its own flavour', () => {
    // delivery.<tenant> and store.<tenant> ARE their apps, param or not.
    expect(MANIFEST).toContain("const isDeliveryHost = rawHost.startsWith('delivery.')")
    expect(MANIFEST).toContain("const isStoreHost = rawHost.startsWith('store.')")
  })
})

describe('only a real business makes a host a tenant', () => {
  it('the slug is set after the lookup succeeds, never before', () => {
    // `app.<base>` matched the storefront shape, so slug became "app" and the
    // icons pointed at /api/core/pwa-icon/app/… — which resolves to nothing.
    // A manifest whose icons 404 is not installable.
    const idx = MANIFEST.indexOf('slug        = extractedSlug')
    const lookup = MANIFEST.indexOf('where:  { slug: extractedSlug }')
    expect(lookup).toBeGreaterThan(-1)
    expect(idx).toBeGreaterThan(lookup)
    expect(MANIFEST).not.toContain('      slug = extractedSlug\n')
  })
})

describe('an unresolved tenant degrades to the role alone', () => {
  it('the manifest falls back to the bare role', () => {
    // `slug` is null off a tenant host — "Delivery Quantix Store" would be a
    // lie, and "Delivery undefined" would be worse.
    expect(MANIFEST).toContain('appDisplayName(app, slug ? name : null)')
  })

  it('the layouts fall back to the bare role too', () => {
    expect(STORE_LAYOUT).toContain('const appName = t?.name ? `Store ${t.name}` : "Store"')
    expect(EXEC_LAYOUT).toContain('const appName = t?.name ? `Delivery ${t.name}` : "Delivery"')
  })
})

describe('the installed identity is all that changed', () => {
  it('iOS home-screen titles match the launcher label', () => {
    expect(STORE_LAYOUT).toContain('appleWebApp: { capable: true, statusBarStyle: "default", title: appName }')
    expect(EXEC_LAYOUT).toContain('appleWebApp: { capable: true, statusBarStyle: "default", title: appName }')
  })

  it('branding, icons and theme are untouched', () => {
    for (const layout of [STORE_LAYOUT, EXEC_LAYOUT]) {
      expect(layout).toContain('icons: { icon: logo, apple: logo, shortcut: logo }')
      expect(layout).toContain('themeColor: t?.primaryColor')
    }
    // Icons are still tenant-scoped in the manifest — now per application,
    // which is the point: one logo for four apps is what made them identical.
    expect(storeBlock).toContain("icons: iconSet('store')")
    expect(execBlock).toContain("icons: iconSet('delivery')")
    expect(MANIFEST).toContain('`/api/core/app-icon/${slug}/${app}/192.png`')
  })

  it('routes, scope and start_url are unchanged', () => {
    expect(storeBlock).toContain('start_url:        storeStart')
    expect(storeBlock).toContain('scope:            storeScope')
    expect(execBlock).toContain('start_url:        execStart')
    expect(execBlock).toContain('scope:            execScope')
  })

  it('the storefront and Laundry OS apps keep their own names', () => {
    // Only the two tenant field apps were renamed.
    expect(MANIFEST).toContain("name:             'Laundry OS'")
    expect(MANIFEST).toContain("name:             'Laundry OS'")
  })
})
