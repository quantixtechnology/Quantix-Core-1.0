// Feature licensing — which modules and screens a tenant has bought.
//
// ONE source of truth. The sidebar, the Navigation Manager, Roles &
// Permissions and the API guards all resolve through this file, so a module
// cannot be visible in one place and gone in another, and adding a module
// never means teaching four systems about it.
//
// The catalog is DERIVED from SCREEN_MODULES rather than restated here. That
// registry already lists every module and screen for RBAC, so a new module —
// Inventory, Accounting, HRMS, Franchise — becomes licensable the moment it is
// registered there. No new navigation or permission logic.
//
// ── Storage ────────────────────────────────────────────────────────────────
// LaundryBusinessFeature rows, keyed either by module ("crm") or by an
// individual screen ("crm.leads"). Absence means "not configured", which is
// deliberately NOT the same as "off" — see the defaults below.
//
// ── Precedence ─────────────────────────────────────────────────────────────
//   1. an explicit row for the screen        crm.leads = false
//   2. an explicit row for its module        crm       = true
//   3. the module's default
//
// ── Defaults, and why they are not uniform ─────────────────────────────────
// An unconfigured module is ON. Every tenant in production predates licensing
// and has no rows at all; defaulting to OFF would dark every screen they use
// the moment this deployed.
//
// CRM is the exception and defaults OFF, because it already shipped as an
// opt-in entitlement under the very same featureKey. Treating it like the rest
// would silently switch CRM on for every tenant who never bought it.

import { SCREEN_MODULES } from "@/lib/laundry-rbac-registry"

/** Modules that a tenant must explicitly buy. Everything else is on by default. */
export const OPT_IN_MODULES = new Set(["crm"])

/** The legacy CRM entitlement key. Case-insensitive matching keeps it working. */
export const CRM_LEGACY_KEY = "CRM"

export interface LicensableScreen { key: string; screenKey: string; label: string }
export interface LicensableModule {
  key: string
  label: string
  /** True when the tenant must opt in; false when it ships enabled. */
  optIn: boolean
  screens: LicensableScreen[]
}

/** Every module and screen that can be licensed, derived from the RBAC registry. */
export function licensableCatalog(): LicensableModule[] {
  return SCREEN_MODULES.map((m) => ({
    key: m.key,
    label: m.label,
    optIn: OPT_IN_MODULES.has(m.key),
    screens: m.screens.map((s) => ({ key: s.key, screenKey: `${m.key}.${s.key}`, label: s.label })),
  }))
}

export const moduleOf = (screenKey: string): string => screenKey.split(".")[0] ?? ""

/** Raw rows as stored, normalised for lookup. */
export type LicenceRows = Record<string, boolean>

export function normalizeRows(rows: { featureKey: string; enabled: boolean }[]): LicenceRows {
  const out: LicenceRows = {}
  for (const r of rows) {
    const key = r.featureKey.trim()
    if (!key) continue
    out[key.toLowerCase()] = !!r.enabled
    // "CRM" and "crm" are the same entitlement; the legacy writer used the
    // former and the module catalog uses the latter.
  }
  return out
}

export interface Licence {
  rows: LicenceRows
  isModuleEnabled(moduleKey: string): boolean
  isScreenEnabled(screenKey: string): boolean
  /** Every enabled screen key — what the sidebar and RBAC filter against. */
  enabledScreens(): Set<string>
  enabledModules(): Set<string>
}

export function buildLicence(rows: LicenceRows): Licence {
  const moduleDefault = (moduleKey: string) => !OPT_IN_MODULES.has(moduleKey)

  const isModuleEnabled = (moduleKey: string): boolean => {
    const explicit = rows[moduleKey.toLowerCase()]
    if (typeof explicit === "boolean") return explicit
    return moduleDefault(moduleKey)
  }

  const isScreenEnabled = (screenKey: string): boolean => {
    const explicit = rows[screenKey.toLowerCase()]
    if (typeof explicit === "boolean") return explicit
    return isModuleEnabled(moduleOf(screenKey))
  }

  return {
    rows,
    isModuleEnabled,
    isScreenEnabled,
    enabledModules: () => new Set(licensableCatalog().filter((m) => isModuleEnabled(m.key)).map((m) => m.key)),
    enabledScreens: () => {
      const out = new Set<string>()
      for (const m of licensableCatalog()) for (const s of m.screens) if (isScreenEnabled(s.screenKey)) out.add(s.screenKey)
      return out
    },
  }
}

/** An unconfigured tenant: every module on except the opt-in ones. */
export const DEFAULT_LICENCE = (): Licence => buildLicence({})

/**
 * Turning a parent on or off sets its children too, so the stored rows always
 * match what the administrator saw. Without this, un-ticking a module would
 * leave stale child rows that quietly re-enable screens later.
 */
export function applyModuleToggle(rows: LicenceRows, moduleKey: string, enabled: boolean): LicenceRows {
  const next = { ...rows, [moduleKey.toLowerCase()]: enabled }
  const mod = licensableCatalog().find((m) => m.key === moduleKey)
  for (const s of mod?.screens ?? []) next[s.screenKey.toLowerCase()] = enabled
  return next
}

export function applyScreenToggle(rows: LicenceRows, screenKey: string, enabled: boolean): LicenceRows {
  const next = { ...rows, [screenKey.toLowerCase()]: enabled }
  // Enabling any child implies the module is licensed; a parent left off would
  // otherwise contradict the child row on the next read.
  if (enabled) next[moduleOf(screenKey).toLowerCase()] = true
  return next
}

/** Rows to persist for a full selection, so a save is one deterministic write. */
export function rowsForSelection(selected: Set<string>): { featureKey: string; enabled: boolean }[] {
  const out: { featureKey: string; enabled: boolean }[] = []
  for (const m of licensableCatalog()) {
    const on = m.screens.filter((s) => selected.has(s.screenKey))
    out.push({ featureKey: m.key, enabled: on.length > 0 })
    for (const s of m.screens) out.push({ featureKey: s.screenKey, enabled: selected.has(s.screenKey) })
  }
  return out
}

export const FEATURE_NOT_ENABLED = "Feature Not Enabled"
