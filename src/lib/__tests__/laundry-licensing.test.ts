import { describe, it, expect } from 'vitest'
import {
  buildLicence, normalizeRows, licensableCatalog, applyModuleToggle, applyScreenToggle,
  rowsForSelection, moduleOf, OPT_IN_MODULES, DEFAULT_LICENCE, FEATURE_NOT_ENABLED,
  licensableGroups, groupState, toggleGroup, toggleScreen, hasAnySelection,
  NO_MODULES_SELECTED, selectionFromLicence, LEGACY_ALIASES,
} from '@/lib/laundry-licensing'
import { SCREEN_MODULES } from '@/lib/laundry-rbac-registry'

// ============================================================================
// Licensing decides what a tenant can reach, and four systems read it — the
// sidebar, the Navigation Manager, Roles & Permissions and the API guards. The
// dangerous failures are at the edges: an unconfigured tenant going dark, or an
// opt-in module switching itself on for everyone.
// ============================================================================

const rows = (o: Record<string, boolean>) =>
  buildLicence(normalizeRows(Object.entries(o).map(([featureKey, enabled]) => ({ featureKey, enabled }))))

describe('the catalog derives from the RBAC registry', () => {
  it('covers every registered module, so a new one is licensable without extra wiring', () => {
    expect(licensableCatalog().map((m) => m.key).sort()).toEqual(SCREEN_MODULES.map((m) => m.key).sort())
  })

  it('covers every screen of every module', () => {
    const total = SCREEN_MODULES.reduce((n, m) => n + m.screens.length, 0)
    expect(licensableCatalog().reduce((n, m) => n + m.screens.length, 0)).toBe(total)
  })

  it('splits a screen key into its module', () => {
    expect(moduleOf('crm.leads')).toBe('crm')
    expect(moduleOf('laundry.orders')).toBe('laundry')
  })
})

// Every tenant in production predates licensing and has no rows at all.
describe('an unconfigured tenant', () => {
  const licence = DEFAULT_LICENCE()

  it('keeps every non-opt-in module enabled, so nothing goes dark on deploy', () => {
    for (const m of licensableCatalog()) {
      if (m.optIn) continue
      expect(licence.isModuleEnabled(m.key)).toBe(true)
    }
  })

  it('keeps laundry screens reachable', () => {
    expect(licence.isScreenEnabled('laundry.orders')).toBe(true)
    expect(licence.isScreenEnabled('processing.washing')).toBe(true)
  })

  // CRM shipped as an opt-in entitlement; defaulting it on would hand it to
  // every tenant who never bought it.
  it('leaves CRM off, preserving its opt-in entitlement', () => {
    expect(OPT_IN_MODULES.has('crm')).toBe(true)
    expect(licence.isModuleEnabled('crm')).toBe(false)
    expect(licence.isScreenEnabled('crm.leads')).toBe(false)
  })
})

describe('precedence', () => {
  it('a module row governs its screens', () => {
    const l = rows({ marketing: false })
    expect(l.isModuleEnabled('marketing')).toBe(false)
    expect(l.isScreenEnabled('marketing.dashboard')).toBe(false)
  })

  it('a screen row overrides its module', () => {
    const l = rows({ marketing: true, 'marketing.dashboard': false })
    expect(l.isModuleEnabled('marketing')).toBe(true)
    expect(l.isScreenEnabled('marketing.dashboard')).toBe(false)
  })

  it('an individual screen can be licensed inside a module that is otherwise off', () => {
    const l = rows({ crm: false, 'crm.leads': true })
    expect(l.isScreenEnabled('crm.leads')).toBe(true)
    expect(l.isScreenEnabled('crm.reports')).toBe(false)
  })

  it('an explicit row beats the opt-in default', () => {
    expect(rows({ crm: true }).isModuleEnabled('crm')).toBe(true)
  })
})

// The legacy entitlement was written as "CRM"; the module catalog uses "crm".
describe('the legacy CRM key keeps working', () => {
  it('matches the uppercase row', () => {
    expect(rows({ CRM: true }).isModuleEnabled('crm')).toBe(true)
    expect(rows({ CRM: false }).isModuleEnabled('crm')).toBe(false)
  })

  it('enables CRM screens through it', () => {
    expect(rows({ CRM: true }).isScreenEnabled('crm.leads')).toBe(true)
  })
})

describe('parent and child selection', () => {
  it('toggling a module carries every child with it', () => {
    const next = applyModuleToggle({}, 'marketing', false)
    const l = buildLicence(next)
    for (const s of licensableCatalog().find((m) => m.key === 'marketing')!.screens) {
      expect(l.isScreenEnabled(s.screenKey)).toBe(false)
    }
  })

  // Otherwise un-ticking a module leaves child rows that quietly re-enable it.
  it('turning a module off clears child rows rather than leaving them stale', () => {
    const on = applyModuleToggle({}, 'crm', true)
    const off = applyModuleToggle(on, 'crm', false)
    expect(Object.entries(off).filter(([, v]) => v)).toHaveLength(0)
  })

  it('enabling one child implies its module, so the two cannot contradict', () => {
    const next = applyScreenToggle({ crm: false }, 'crm.leads', true)
    const l = buildLicence(next)
    expect(l.isModuleEnabled('crm')).toBe(true)
    expect(l.isScreenEnabled('crm.leads')).toBe(true)
  })

  it('disabling one child leaves its siblings alone', () => {
    const next = applyScreenToggle(applyModuleToggle({}, 'crm', true), 'crm.leads', false)
    const l = buildLicence(next)
    expect(l.isScreenEnabled('crm.leads')).toBe(false)
    expect(l.isScreenEnabled('crm.reports')).toBe(true)
  })
})

describe('saving a selection', () => {
  it('writes every catalog key, so no unseen row decides access later', () => {
    const out = rowsForSelection(new Set(['crm.leads']))
    // Every module + every screen, plus the legacy uppercase alias for the two
    // modules that have one, kept in step so the pair cannot disagree.
    const expected = licensableCatalog().reduce((n, m) => n + m.screens.length + 1, 0)
      + Object.keys(LEGACY_ALIASES).length
    expect(out).toHaveLength(expected)
  })

  it('writes the legacy alias with the same value as its canonical row', () => {
    const out = rowsForSelection(new Set(['crm.leads']))
    expect(out.find((r) => r.featureKey === 'crm')?.enabled).toBe(true)
    expect(out.find((r) => r.featureKey === 'CRM')?.enabled).toBe(true)
    expect(out.find((r) => r.featureKey === 'marketing')?.enabled).toBe(false)
    expect(out.find((r) => r.featureKey === 'MARKETING')?.enabled).toBe(false)
  })

  it('marks a module enabled when any child is selected', () => {
    const out = rowsForSelection(new Set(['crm.leads']))
    expect(out.find((r) => r.featureKey === 'crm')?.enabled).toBe(true)
    expect(out.find((r) => r.featureKey === 'crm.leads')?.enabled).toBe(true)
    expect(out.find((r) => r.featureKey === 'crm.reports')?.enabled).toBe(false)
  })

  it('marks a module disabled when nothing under it is selected', () => {
    const out = rowsForSelection(new Set(['laundry.orders']))
    expect(out.find((r) => r.featureKey === 'marketing')?.enabled).toBe(false)
  })

  it('round-trips through the licence unchanged', () => {
    const selection = new Set(['crm.leads', 'laundry.orders'])
    const l = buildLicence(normalizeRows(rowsForSelection(selection)))
    expect(l.isScreenEnabled('crm.leads')).toBe(true)
    expect(l.isScreenEnabled('laundry.orders')).toBe(true)
    expect(l.isScreenEnabled('marketing.dashboard')).toBe(false)
  })
})

// Disabling is a licence change, never a data change: the rows describe access
// and nothing else, so re-enabling restores the module with its history.
describe('re-enabling', () => {
  it('restores exactly what was disabled', () => {
    const off = applyModuleToggle({}, 'marketing', false)
    const on = applyModuleToggle(off, 'marketing', true)
    const l = buildLicence(on)
    for (const s of licensableCatalog().find((m) => m.key === 'marketing')!.screens) {
      expect(l.isScreenEnabled(s.screenKey)).toBe(true)
    }
  })

  it('enabledScreens reflects the current licence', () => {
    const l = rows({ crm: true, marketing: false })
    const screens = l.enabledScreens()
    expect(screens.has('crm.leads')).toBe(true)
    expect(screens.has('marketing.dashboard')).toBe(false)
    expect(l.enabledModules().has('marketing')).toBe(false)
  })
})

describe('the refusal message', () => {
  it('is the wording the API returns', () => {
    expect(FEATURE_NOT_ENABLED).toBe('Feature Not Enabled')
  })
})

// ── Display grouping + the selector's parent/child rules ────────────────────
describe('display grouping', () => {
  it('splits Laundry into the shop floor and its settings', () => {
    const keys = licensableGroups().map((g) => g.key)
    expect(keys).toContain('laundry:ops')
    expect(keys).toContain('laundry:settings')
    expect(keys).not.toContain('laundry')
  })

  it('puts operational screens on the floor and configuration under settings', () => {
    const g = licensableGroups()
    const ops = g.find((x) => x.key === 'laundry:ops')!.screens.map((s) => s.screenKey)
    const set = g.find((x) => x.key === 'laundry:settings')!.screens.map((s) => s.screenKey)
    expect(ops).toContain('laundry.orders')
    expect(ops).toContain('laundry.new_order')
    expect(set).toContain('laundry.settings')
    expect(set).toContain('laundry.hardware')
    expect(set).toContain('laundry.roles')
  })

  it('loses no screen in the split', () => {
    const grouped = licensableGroups().reduce((n, g) => n + g.screens.length, 0)
    const catalog = licensableCatalog()
      .filter((m) => m.key !== 'customer_app')
      .reduce((n, m) => n + m.screens.length, 0)
    expect(grouped).toBe(catalog)
  })

  it('hides the customer app, which is not administrator-licensable', () => {
    expect(licensableGroups().map((g) => g.key)).not.toContain('customer_app')
  })

  // The future-proofing claim, asserted: every other module is its own group
  // with no per-module UI code anywhere.
  it('gives every other registered module exactly one group', () => {
    const groups = licensableGroups()
    for (const m of licensableCatalog()) {
      if (m.key === 'laundry' || m.key === 'customer_app') continue
      expect(groups.filter((g) => g.key === m.key)).toHaveLength(1)
    }
  })
})

describe('parent / child selection in the selector', () => {
  const crm = () => licensableGroups().find((g) => g.key === 'crm')!

  it('checking a parent selects every child', () => {
    const next = toggleGroup(crm(), new Set(), true)
    expect(crm().screens.every((s) => next.has(s.screenKey))).toBe(true)
    expect(groupState(crm(), next)).toBe('all')
  })

  it('unchecking a parent clears every child', () => {
    const on = toggleGroup(crm(), new Set(), true)
    expect(groupState(crm(), toggleGroup(crm(), on, false))).toBe('none')
  })

  it('is indeterminate when only some children are selected', () => {
    const on = toggleGroup(crm(), new Set(), true)
    const partial = toggleScreen(crm().screens[0].screenKey, on, false)
    expect(groupState(crm(), partial)).toBe('some')
  })

  it('leaves other groups untouched when a parent is toggled', () => {
    const marketing = licensableGroups().find((g) => g.key === 'marketing')!
    const next = toggleGroup(crm(), toggleGroup(marketing, new Set(), true), false)
    expect(groupState(marketing, next)).toBe('all')
  })

  it('refuses a selection with nothing in it', () => {
    expect(hasAnySelection(new Set())).toBe(false)
    expect(hasAnySelection(new Set(['crm.leads']))).toBe(true)
    expect(NO_MODULES_SELECTED).toBe('Select at least one module.')
  })

  it('round-trips a licence into an editable selection', () => {
    const licence = buildLicence(normalizeRows(rowsForSelection(new Set(['crm.leads']))))
    const selection = selectionFromLicence(licence)
    expect(selection.has('crm.leads')).toBe(true)
    expect(groupState(crm(), selection)).toBe('some')
  })
})
