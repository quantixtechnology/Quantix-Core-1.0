import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildLicence, OPT_IN_MODULES } from '@/lib/laundry-licensing'
import { defaultNavigationConfig } from '@/lib/laundry-nav-config'
import { isValidScreenKey } from '@/lib/laundry-rbac-registry'

// ============================================================================
// A module enabled in Business Features has to be able to reach the sidebar.
//
// CRM was enabled for a tenant, licensed, present in defaultNavigationConfig()
// with all seven screens, mapped in SCREEN_PAGE_MAP, registered in RBAC — and
// still absent from that tenant's navigation.
//
// Because the sidebar reads the tenant's PERSISTED sections, and
// ensureNavigationConfig writes the defaults exactly once, when the navigation
// row is first created. Every module added to the defaults afterwards reached
// new businesses only. A section that was never written cannot be filtered
// into existence, whatever Business Features says.
//
// Each earlier module papered over this with a migration of its own — one to
// move Delivery Executives, one to add Hardware Manager. That does not scale,
// and it is exactly why CRM was missed.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const NAV_CONFIG = read('src/lib/laundry-nav-config.ts')
const NAV_ROUTE  = read('src/app/api/laundry/navigation/route.ts')
const CRM_LIB    = read('src/lib/laundry-crm.ts')

const CRM_SCREENS = [
  'crm.dashboard', 'crm.leads', 'crm.opportunity',
  'crm.activities', 'crm.pipeline', 'crm.reports', 'crm.settings',
]

describe('1 · CRM disabled → nothing of it is offered', () => {
  it('CRM is opt-in, so an unconfigured tenant has it off', () => {
    expect(OPT_IN_MODULES.has('crm')).toBe(true)
    expect(buildLicence({}).isModuleEnabled('crm')).toBe(false)
  })

  it('every CRM screen is disabled with it', () => {
    const licence = buildLicence({})
    for (const s of CRM_SCREENS) expect(licence.isScreenEnabled(s)).toBe(false)
  })

  it('the navigation endpoint drops a section left with no licensed items', () => {
    // Absent, not merely empty.
    expect(NAV_ROUTE).toContain('.map((sec) => ({ ...sec, items: sec.items.filter((i) => licence.isScreenEnabled(i.screenKey)) }))')
    expect(NAV_ROUTE).toContain('.filter((sec) => sec.items.length > 0)')
  })
})

describe('2 & 3 · CRM enabled → the section and all seven screens', () => {
  it('enabling the module enables every screen under it', () => {
    const licence = buildLicence({ crm: true })
    expect(licence.isModuleEnabled('crm')).toBe(true)
    for (const s of CRM_SCREENS) expect(licence.isScreenEnabled(s)).toBe(true)
  })

  it('the legacy uppercase entitlement key still counts', () => {
    // Tenants were entitled through LaundryBusinessFeature "CRM" before the
    // licensing engine existed; that must not silently stop working.
    expect(buildLicence({ crm: true }).isModuleEnabled('CRM')).toBe(true)
  })

  it('the default navigation carries CRM with exactly those seven', () => {
    const crm = defaultNavigationConfig().find((s) => s.name === 'CRM')
    expect(crm).toBeTruthy()
    expect(crm!.active).toBe(true)
    expect(crm!.items.map((i) => i.screenKey).sort()).toEqual([...CRM_SCREENS].sort())
  })

  it('all seven are real registered screens, not invented keys', () => {
    for (const s of CRM_SCREENS) expect(isValidScreenKey(s)).toBe(true)
  })
})

describe('4 · CRM enabled with only some screens', () => {
  it('a screen switched off individually stays off', () => {
    const licence = buildLicence({ crm: true, 'crm.leads': false, 'crm.reports': false })
    expect(licence.isScreenEnabled('crm.dashboard')).toBe(true)
    expect(licence.isScreenEnabled('crm.leads')).toBe(false)
    expect(licence.isScreenEnabled('crm.reports')).toBe(false)
  })

  it('enabledScreens reflects exactly the selection', () => {
    const enabled = buildLicence({ crm: true, 'crm.leads': false }).enabledScreens()
    expect(enabled.has('crm.dashboard')).toBe(true)
    expect(enabled.has('crm.leads')).toBe(false)
  })
})

describe('5 · a hidden sidebar is not the security mechanism', () => {
  it('the CRM guard asks the licence, not the navigation', () => {
    expect(CRM_LIB).toContain('licence.isModuleEnabled("crm")')
    expect(CRM_LIB).toContain('if (!access.enabled) throw new CrmAccessError(403')
  })

  it('every CRM API route goes through that guard', () => {
    // Counted rather than asserted one by one, so a new route cannot be added
    // without one.
    const { readdirSync } = require('fs') as typeof import('fs')
    const dir = join(ROOT, 'src/app/api/laundry/crm')
    const routes = readdirSync(dir).filter((d) => {
      try { readFileSync(join(dir, d, 'route.ts'), 'utf8'); return true } catch { return false }
    })
    expect(routes.length).toBeGreaterThanOrEqual(7)
    for (const r of routes) {
      const src = readFileSync(join(dir, r, 'route.ts'), 'utf8')
      expect(src).toMatch(/requireCrmBusiness|resolveCrmAccess/)
    }
  })
})

describe('8 · a tenant seeded before the module existed still gets it', () => {
  // The actual defect. Everything else was already right.
  it('an existing tenant is reconciled against the defaults', () => {
    expect(NAV_CONFIG).toContain('async function ensureDefaultSections(navigationId: string, licence: Licence)')
    const existing = NAV_CONFIG.slice(NAV_CONFIG.indexOf('if (existing) {'), NAV_CONFIG.indexOf('await db.$transaction'))
    expect(existing).toContain('await ensureDefaultSections(existing.id, licence)')
  })

  it('it is driven by the defaults, not by a list of module names', () => {
    // The next module must not need its own migration.
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function ensureDefaultSections'), NAV_CONFIG.indexOf('async function activateLicensedSections'))
    expect(fn).toContain('const defaults = defaultNavigationConfig()')
    expect(fn).not.toContain('"CRM"')
    expect(fn).not.toContain("'CRM'")
  })

  it('it lands where the defaults put it, not on the end', () => {
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function ensureDefaultSections'), NAV_CONFIG.indexOf('async function activateLicensedSections'))
    expect(fn).toContain('const prev = existingSections.find((e) => e.name === defaults[k].name)')
    expect(fn).toContain('insertAt = prev.order + 1')
  })

  it('CRM sits after Processing Center and before Marketing in the defaults', () => {
    const names = defaultNavigationConfig().map((s) => s.name)
    expect(names).toContain('CRM')
    expect(names.indexOf('CRM')).toBeGreaterThan(names.indexOf('Processing Center'))
    expect(names.indexOf('CRM')).toBeLessThan(names.indexOf('Marketing'))
  })
})

describe('6 & 7 · nothing a tenant arranged is disturbed', () => {
  // Comments stripped: the next function's doc block sits inside this slice and
  // quotes the very flags these assertions look for.
  const fn = NAV_CONFIG
    .slice(NAV_CONFIG.indexOf('async function ensureDefaultSections'), NAV_CONFIG.indexOf('async function activateLicensedSections'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  it('a section the tenant already has is left completely alone', () => {
    expect(fn).toContain('if (haveSection.has(sec.name)) continue')
  })

  it('a section whose screens they hold elsewhere is not re-added', () => {
    // They moved the items; that is a customization, not an absence.
    expect(fn).toContain('if (sec.items.some((it) => haveScreen.has(it.screenKey))) continue')
  })

  it('items are never injected into a section that already exists', () => {
    // An item missing from a section they arranged is plausibly one they removed.
    expect(fn).not.toContain('sectionId: existing')
    expect(fn).toContain('sectionId: created.id')
  })

  it('nothing is renamed, hidden or deleted', () => {
    expect(fn).not.toContain('delete')
    expect(fn).not.toContain('hidden: true')
    expect(fn).not.toContain('active: false')
  })

  it('the only write to existing rows is the order shift that makes room', () => {
    expect(fn).toContain('await db.laundryNavSection.updateMany({')
    expect(fn).toContain('data: { order: { increment: 1 } },')
  })

  it('the earlier one-off migrations still run', () => {
    // Those move and insert ITEMS, which section-level reconciliation does not
    // do; removing them would undo work already shipped.
    const existing = NAV_CONFIG.slice(NAV_CONFIG.indexOf('if (existing) {'), NAV_CONFIG.indexOf('await db.$transaction'))
    expect(existing).toContain('migrateDeliveryExecutivesToOperations(existing.id)')
    expect(existing).toContain('ensureHardwareManagerNavItem(existing.id)')
  })

  it('non-CRM modules keep their defaults untouched', () => {
    const names = defaultNavigationConfig().map((s) => s.name)
    for (const n of ['Operations', 'Store Workflow', 'Processing Center', 'Administration']) {
      expect(names).toContain(n)
    }
  })
})

describe('9 · no tenant is named anywhere in the fix', () => {
  it('nothing is special-cased', () => {
    for (const src of [NAV_CONFIG, NAV_ROUTE, CRM_LIB]) {
      expect(src.toLowerCase()).not.toContain('vastrasudha')
    }
  })

  it('visibility does not depend on catalog data', () => {
    const fn = NAV_CONFIG.slice(NAV_CONFIG.indexOf('async function ensureDefaultSections'), NAV_CONFIG.indexOf('async function activateLicensedSections'))
    for (const unrelated of ['garment', 'category', 'service', 'pricing']) {
      expect(fn.toLowerCase()).not.toContain(unrelated)
    }
  })
})
