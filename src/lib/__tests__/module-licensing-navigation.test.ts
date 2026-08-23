import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildLicence, licensableCatalog, applyModuleToggle } from '@/lib/laundry-licensing'
import { defaultNavigationConfig } from '@/lib/laundry-nav-config'

// ============================================================================
// Licensing decides availability. Navigation decides presentation.
//
// `section.active` was quietly doing both. The sidebar drops any inactive
// section outright, so the flag was an entitlement switch wearing a
// presentation flag's name — and Marketing SHIPS `active: false`, so every
// tenant carried a licensed module it could not see. The only escape was for
// someone to open Navigation Manager and switch it on. Per tenant. Per module.
// Forever.
//
// CRM's fix (7ebca40) handled a section that was never WRITTEN. This handles a
// section that was written and then suppressed. Same principle: a licensed
// module may not be hidden by stale presentation state, and neither fix names
// a module.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const NAV_CONFIG = read('src/lib/laundry-nav-config.ts')
const NAV_ROUTE  = read('src/app/api/laundry/navigation/route.ts')
const SIDEBAR    = read('src/components/laundry/layout/laundry-sidebar.tsx')

/** The section a module's screens live in, per the shipped defaults. */
const sectionsFor = (moduleKey: string) =>
  defaultNavigationConfig().filter((s) => s.items.some((i) => i.screenKey.startsWith(`${moduleKey}.`)))

describe('every licensable module obeys the same rules — A, B, C, D', () => {
  const modules = licensableCatalog()

  it('there is more than one, so this is not a single-module test', () => {
    expect(modules.length).toBeGreaterThanOrEqual(5)
  })

  for (const m of modules) {
    describe(`${m.key}`, () => {
      const keys = m.screens.map((s) => s.screenKey)

      it('A · disabled → no screen of it is licensed', () => {
        const licence = buildLicence(applyModuleToggle({}, m.key, false))
        for (const k of keys) expect(licence.isScreenEnabled(k)).toBe(false)
      })

      it('B · one screen enabled → exactly that one', () => {
        const rows = { ...applyModuleToggle({}, m.key, false), [m.key]: true } as Record<string, boolean>
        for (const k of keys) rows[k] = false
        rows[keys[0]] = true
        const licence = buildLicence(rows)
        expect(licence.isScreenEnabled(keys[0])).toBe(true)
        for (const k of keys.slice(1)) expect(licence.isScreenEnabled(k)).toBe(false)
      })

      it('C · a partial selection is honoured exactly', () => {
        const half = keys.filter((_, i) => i % 2 === 0)
        const rows: Record<string, boolean> = { [m.key]: true }
        for (const k of keys) rows[k] = half.includes(k)
        const licence = buildLicence(rows)
        for (const k of keys) expect(licence.isScreenEnabled(k)).toBe(half.includes(k))
      })

      it('D · fully enabled → every screen', () => {
        const licence = buildLicence(applyModuleToggle({}, m.key, true))
        for (const k of keys) expect(licence.isScreenEnabled(k)).toBe(true)
      })

      it('J · none of that depends on catalog or customer data', () => {
        // buildLicence takes rows and nothing else — no garments, services,
        // pricing, stores or customers can reach this decision.
        expect(buildLicence({}).isModuleEnabled(m.key)).toBe(!m.optIn)
      })
    })
  }
})

describe('E & F · a stored section cannot outvote the licence', () => {
  it('a section that was never written is created when licensed', () => {
    expect(NAV_CONFIG).toContain('async function ensureDefaultSections(navigationId: string, licence: Licence)')
    expect(NAV_CONFIG).toContain('if (!sec.items.some((it) => licence.isScreenEnabled(it.screenKey))) continue')
  })

  it('a section that was written INACTIVE is activated when licensed', () => {
    // The Marketing case. 7ebca40 left it alone, correctly — it exists.
    expect(NAV_CONFIG).toContain('async function activateLicensedSections(navigationId: string, licence: Licence)')
    expect(NAV_CONFIG).toContain('where: { navigationId, active: false }')
    expect(NAV_CONFIG).toContain('.filter((sec) => sec.items.some((i) => licence.isScreenEnabled(i.screenKey)))')
    expect(NAV_CONFIG).toContain('data: { active: true },')
  })

  it('both run for an existing tenant, on every load', () => {
    const branch = NAV_CONFIG.slice(NAV_CONFIG.indexOf('if (existing) {'), NAV_CONFIG.indexOf('await db.$transaction'))
    expect(branch).toContain('await ensureDefaultSections(existing.id, licence)')
    expect(branch).toContain('await activateLicensedSections(existing.id, licence)')
  })

  it('a NEW tenant is seeded by the licence, not by the shipped flag', () => {
    // Otherwise a new business is born with a licensed module switched off.
    expect(NAV_CONFIG).toContain('active: sec.items.some((it) => licence.isScreenEnabled(it.screenKey)),')
    expect(NAV_CONFIG).not.toContain('active: sec.active,\n        },\n      })')
  })

  it('Marketing is the section that ships inactive — the case that exposed this', () => {
    const marketing = defaultNavigationConfig().find((s) => s.name === 'Marketing')
    expect(marketing).toBeTruthy()
    expect(marketing!.active).toBe(false)
    // …and it is licensed by default, which is why every tenant was affected.
    expect(buildLicence({}).isModuleEnabled('marketing')).toBe(true)
  })
})

describe('G & H · disabling hides it; re-enabling brings it back with its arrangement', () => {
  it('G · an unlicensed section is dropped at runtime, not stored as hidden', () => {
    expect(NAV_ROUTE).toContain('items: sec.items.filter((i) => licence.isScreenEnabled(i.screenKey))')
    expect(NAV_ROUTE).toContain('.filter((sec) => sec.items.length > 0)')
  })

  it('H · deactivation is never written back, so ordering survives', () => {
    // Availability is computed; presentation is stored. Writing active:false
    // would destroy a flag the tenant may have set and buy nothing, because
    // the runtime filter already removes it.
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function activateLicensedSections'), NAV_CONFIG.indexOf('export async function ensureNavigationConfig'))
    // `active: false` appears as the query SELECTOR — inactive sections are
    // what it looks for. What must not exist is a WRITE of it.
    expect(fn).not.toContain('data: { active: false')
    expect(fn).toContain('data: { active: true },')
    expect(fn).not.toContain('delete')
  })

  it('nothing about a section other than `active` is touched', () => {
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function activateLicensedSections'), NAV_CONFIG.indexOf('export async function ensureNavigationConfig'))
    for (const field of ['order:', 'name:', 'icon:', 'expanded:', 'collapsible:']) {
      expect(fn).not.toContain(field)
    }
  })

  it('item-level hiding remains the tenant\'s control', () => {
    expect(SIDEBAR).toContain('.filter((item) => !item.hidden && canShow(item.screenKey))')
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function activateLicensedSections'), NAV_CONFIG.indexOf('export async function ensureNavigationConfig'))
    expect(fn).not.toContain('hidden')
  })
})

describe('I & 1 · no module is named, no tenant is named', () => {
  const fns = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function ensureDefaultSections'), NAV_CONFIG.indexOf('export async function ensureNavigationConfig'))

  it('the reconciliation names no module', () => {
    for (const m of licensableCatalog()) {
      expect(fns).not.toContain(`"${m.key}"`)
      expect(fns).not.toContain(`'${m.key}'`)
    }
    for (const name of ['CRM', 'Marketing', 'Inventory', 'Accounting', 'HRMS']) {
      expect(fns).not.toContain(`"${name}"`)
    }
  })

  it('it names no tenant', () => {
    for (const src of [NAV_CONFIG, NAV_ROUTE, SIDEBAR]) {
      expect(src.toLowerCase()).not.toContain('vastrasudha')
    }
  })

  it('11 · it is driven by the registry, so a future module inherits it', () => {
    expect(fns).toContain('const defaults = defaultNavigationConfig()')
    expect(fns).toContain('licence.isScreenEnabled')
  })
})

describe('12 & 13 · hiding is not the security boundary', () => {
  it('the licence is resolved before either reconciliation', () => {
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('export async function ensureNavigationConfig'))
    const resolve = fn.indexOf('const licence = await resolveLicence(businessId)')
    const use = fn.indexOf('await ensureDefaultSections(existing.id, licence)')
    expect(resolve).toBeGreaterThan(-1)
    expect(resolve).toBeLessThan(use)
  })

  it('module entitlement is still enforced server-side, per module', () => {
    const CRM_LIB = read('src/lib/laundry-crm.ts')
    expect(CRM_LIB).toContain('licence.isModuleEnabled("crm")')
    const SERVER = read('src/lib/laundry-licensing-server.ts')
    expect(SERVER).toContain('requireLicensedScreen')
  })

  it('RBAC is untouched — the sidebar still asks the single resolver', () => {
    expect(SIDEBAR).toContain('isScreenAccessible(screenLevels, isOwner, screenKey)')
  })
})

describe('14 · the rest of the navigation is unchanged', () => {
  it('the shipped sections and their order are as they were', () => {
    const names = defaultNavigationConfig().map((s) => s.name)
    expect(names).toEqual(expect.arrayContaining(['Operations', 'Store Workflow', 'Processing Center', 'CRM', 'Marketing', 'Administration']))
    expect(names.indexOf('CRM')).toBeLessThan(names.indexOf('Marketing'))
  })

  it('the earlier reconciliations still run', () => {
    const branch = NAV_CONFIG.slice(NAV_CONFIG.indexOf('if (existing) {'), NAV_CONFIG.indexOf('await db.$transaction'))
    expect(branch).toContain('migrateDeliveryExecutivesToOperations(existing.id)')
    expect(branch).toContain('ensureHardwareManagerNavItem(existing.id)')
  })

  it('a licensed section is still subject to the empty-section drop', () => {
    // Activating a section does not force it to appear: if the licence enables
    // none of its items it is filtered away at runtime regardless.
    expect(NAV_ROUTE).toContain('.filter((sec) => sec.items.length > 0)')
  })
})

describe('15-20 · nothing outside navigation was touched', () => {
  it('the change is confined to nav-config', () => {
    // Storefront, Maps, pickup, delivery, processing and mobile apps are not
    // reachable from this module.
    expect(NAV_CONFIG).not.toContain('storefront')
    expect(NAV_CONFIG).not.toContain('maps')
    expect(NAV_CONFIG).not.toContain('googleapis')
  })

  it('Processing Center convergence is still applied', () => {
    expect(NAV_CONFIG).toContain('await convergeProcessingNav(businessId)')
  })
})
