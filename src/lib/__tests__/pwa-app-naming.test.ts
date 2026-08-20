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
    expect(storeBlock).toContain("name:             appLabel('Admin')")
    expect(storeBlock).toContain("short_name:       appLabel('Admin')")
  })

  it('the Delivery PWA is labelled "Delivery {Business}"', () => {
    expect(execBlock).toContain("name:             appLabel('Delivery')")
    expect(execBlock).toContain("short_name:       appLabel('Delivery')")
  })

  it('the label puts the role before the business, never after', () => {
    expect(MANIFEST).toContain('const appLabel = (role: \'Admin\' | \'Delivery\') => (slug ? `${role} ${name}` : role)')
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
    expect(MANIFEST).toContain('where:  { slug }')
  })

  it('each layout reuses its existing tenant resolver', () => {
    // No second resolution mechanism was introduced for naming.
    expect(STORE_LAYOUT).toContain('resolveStoreTenant')
    expect(EXEC_LAYOUT).toContain('resolveExecutiveTenant')
  })
})

describe('an unresolved tenant degrades to the role alone', () => {
  it('the manifest falls back to the bare role', () => {
    // `slug` is null off a tenant host — "Delivery Quantix Store" would be a
    // lie, and "Delivery undefined" would be worse.
    expect(MANIFEST).toContain('(slug ? `${role} ${name}` : role)')
  })

  it('the layouts fall back to the bare role too', () => {
    expect(STORE_LAYOUT).toContain('const appName = t?.name ? `Admin ${t.name}` : "Admin"')
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
    // Icons still come from the tenant logo in the manifest as well.
    expect(storeBlock).toContain('src: icon192')
    expect(execBlock).toContain('src: icon192')
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
    expect(MANIFEST).toContain('short_name:       shortName(name)') // storefront default
  })
})
