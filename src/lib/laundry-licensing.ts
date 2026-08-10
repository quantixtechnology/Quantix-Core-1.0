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

/**
 * Collapse stored rows into a lookup.
 *
 * "CRM" and "crm" are the same entitlement — the old features card wrote the
 * uppercase form, the module catalog uses the lowercase one — so both fold to
 * one key. That fold is where a real bug lived: a tenant can hold BOTH rows,
 * and a single pass let whichever the database returned last win. Prisma makes
 * no ordering promise without an orderBy, so the licence changed between page
 * loads for no visible reason: save Coupons, refresh, Marketing is off again.
 *
 * The canonical lowercase key therefore always wins, in two passes, so the
 * result no longer depends on row order. saveLicence additionally rewrites the
 * legacy rows in step, which removes the contradiction at the source.
 */
export function normalizeRows(rows: { featureKey: string; enabled: boolean }[]): LicenceRows {
  const out: LicenceRows = {}
  const clean = rows.map((r) => ({ key: r.featureKey.trim(), enabled: !!r.enabled })).filter((r) => r.key)
  // Pass 1 — legacy rows stored in any other casing.
  for (const r of clean) if (r.key !== r.key.toLowerCase()) out[r.key.toLowerCase()] = r.enabled
  // Pass 2 — canonical rows, which override whatever pass 1 left.
  for (const r of clean) if (r.key === r.key.toLowerCase()) out[r.key] = r.enabled
  return out
}

/**
 * Legacy uppercase aliases kept in step whenever a licence is saved, so the
 * duplicate can never disagree with the canonical row again. Dropping them
 * instead would be cleaner, but they predate this engine and may still be read
 * somewhere outside it.
 */
export const LEGACY_ALIASES: Record<string, string> = { crm: "CRM", marketing: "MARKETING" }

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
    const moduleEnabled = on.length > 0
    out.push({ featureKey: m.key, enabled: moduleEnabled })
    // Keep any legacy alias identical, so the pair can never disagree.
    const alias = LEGACY_ALIASES[m.key]
    if (alias) out.push({ featureKey: alias, enabled: moduleEnabled })
    for (const s of m.screens) out.push({ featureKey: s.screenKey, enabled: selected.has(s.screenKey) })
  }
  return out
}

export const FEATURE_NOT_ENABLED = "Feature Not Enabled"

// ── Display grouping ────────────────────────────────────────────────────────
//
// Licensing is stored and enforced per SCREEN KEY. Grouping is presentation
// only: it exists because "Laundry" is one RBAC module but reads to a human as
// two unrelated things — the shop floor, and the settings behind it.
//
// A module with no split rule becomes exactly one group, so a future module
// (Inventory, Accounting, HRMS, Franchise) shows up in the selector the moment
// it is registered in SCREEN_MODULES. That is the whole future-proofing claim:
// registering a module and its screens is the only step.

/** Screens of the `laundry` module that belong under Settings rather than the floor. */
const LAUNDRY_SETTINGS_SCREENS = new Set([
  "subscription_plans", "subscriptions", "categories", "pricing", "pricing_simulator",
  "charges_rules", "services", "garments", "stores", "staff", "delivery_executives",
  "roles", "mobile_apps", "reports", "settings", "hardware", "navigation",
])

/** Modules the selector should not offer — not administrator-licensable. */
const HIDDEN_GROUPS = new Set(["customer_app"])

export interface LicensableGroup {
  key: string
  label: string
  optIn: boolean
  screens: LicensableScreen[]
}

export function licensableGroups(): LicensableGroup[] {
  const out: LicensableGroup[] = []
  for (const m of licensableCatalog()) {
    if (HIDDEN_GROUPS.has(m.key)) continue
    if (m.key === "laundry") {
      const floor = m.screens.filter((s) => !LAUNDRY_SETTINGS_SCREENS.has(s.key))
      const settings = m.screens.filter((s) => LAUNDRY_SETTINGS_SCREENS.has(s.key))
      if (floor.length) out.push({ key: "laundry:ops", label: "Store Operations", optIn: false, screens: floor })
      if (settings.length) out.push({ key: "laundry:settings", label: "Laundry Settings", optIn: false, screens: settings })
      continue
    }
    out.push({ key: m.key, label: m.label, optIn: m.optIn, screens: m.screens })
  }
  return out
}

export type GroupState = "all" | "none" | "some"

/** Tri-state for a parent checkbox: some children selected is neither on nor off. */
export function groupState(group: LicensableGroup, selected: Set<string>): GroupState {
  const on = group.screens.filter((s) => selected.has(s.screenKey)).length
  if (on === 0) return "none"
  return on === group.screens.length ? "all" : "some"
}

/** Checking a parent selects every child; unchecking clears them. */
export function toggleGroup(group: LicensableGroup, selected: Set<string>, enabled: boolean): Set<string> {
  const next = new Set(selected)
  for (const s of group.screens) enabled ? next.add(s.screenKey) : next.delete(s.screenKey)
  return next
}

export function toggleScreen(screenKey: string, selected: Set<string>, enabled: boolean): Set<string> {
  const next = new Set(selected)
  enabled ? next.add(screenKey) : next.delete(screenKey)
  return next
}

/** Every screen a licence currently grants, as a selection the UI can edit. */
export function selectionFromLicence(licence: Licence): Set<string> {
  return licence.enabledScreens()
}

/** A tenant with nothing licensed cannot operate; the selector must refuse it. */
export const NO_MODULES_SELECTED = "Select at least one module."
export const hasAnySelection = (selected: Set<string>): boolean => selected.size > 0
