"use client"

// Feature selector — the tenant licence console.
//
// Renders whatever the licensing catalog contains and holds no list of modules
// of its own, so registering a module and its screens in SCREEN_MODULES is the
// only step needed for it to appear here. That is the point of the engine.
//
// Two behaviours worth naming:
//   • Parent state is genuinely tri-state. `indeterminate` is a DOM property
//     with no HTML attribute, so it is set through a ref; a master switch drawn
//     as fully on while a child is off would misreport what the tenant buys.
//   • Turning a core module off is confirmed, because the screens it takes away
//     are the ones the business runs on.

import { useMemo, useState } from "react"
import { ChevronDown, Check, Users, Store, Factory, Settings, Megaphone, Boxes, AlertTriangle } from "lucide-react"
import {
  licensableGroups, groupState, toggleGroup, toggleScreen, hasAnySelection, NO_MODULES_SELECTED,
} from "@/lib/laundry-licensing"
import type { LicensableGroup, GroupState } from "@/lib/laundry-licensing"

/** Presentation only — an unknown module falls back to a neutral icon + copy. */
const META: Record<string, { icon: typeof Users; blurb: string }> = {
  crm: { icon: Users, blurb: "Leads, opportunities and the sales pipeline inside Laundry OS." },
  "laundry:ops": { icon: Store, blurb: "The shop floor: orders, customers, dispatch and store handling." },
  "laundry:settings": { icon: Settings, blurb: "Pricing, services, stores, staff, roles and workspace configuration." },
  processing: { icon: Factory, blurb: "Processing Center workstations from barcode generation to folding." },
  store_ops: { icon: Store, blurb: "Store Admin PWA operations for counter staff." },
  marketing: { icon: Megaphone, blurb: "Discounts, coupons, campaigns and loyalty." },
}

const TONE = {
  core: { chip: "border-blue-200 bg-blue-50 text-blue-700", icon: "bg-blue-50 text-blue-600", label: "Core module" },
  optional: { chip: "border-purple-200 bg-purple-50 text-purple-700", icon: "bg-purple-50 text-purple-600", label: "Optional module" },
  partial: { chip: "border-amber-200 bg-amber-50 text-amber-700", icon: "bg-amber-50 text-amber-600", label: "Partially enabled" },
  off: { chip: "border-slate-200 bg-slate-50 text-slate-500", icon: "bg-slate-100 text-slate-400", label: "Disabled" },
}

function toneFor(group: LicensableGroup, state: GroupState) {
  if (state === "none") return TONE.off
  if (state === "some") return TONE.partial
  return group.optIn ? TONE.optional : TONE.core
}

export interface FeatureSelectorProps {
  value: Set<string>
  onChange: (next: Set<string>) => void
  showValidation?: boolean
  disabled?: boolean
}

export function FeatureSelector({ value, onChange, showValidation = true, disabled = false }: FeatureSelectorProps) {
  const groups = useMemo(() => licensableGroups(), [])
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.key, !g.optIn])),
  )
  const [confirming, setConfirming] = useState<LicensableGroup | null>(null)

  const requestToggle = (g: LicensableGroup, on: boolean) => {
    // Disabling a core module removes the workflows a business runs on, so it
    // is confirmed. Enabling never needs a warning.
    if (!on && !g.optIn) { setConfirming(g); return }
    onChange(toggleGroup(g, value, on))
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <ModuleCard
            key={g.key}
            group={g}
            selected={value}
            open={!!open[g.key]}
            disabled={disabled}
            onToggleOpen={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
            onToggleGroup={(on) => requestToggle(g, on)}
            onToggleScreen={(key, on) => onChange(toggleScreen(key, value, on))}
          />
        ))}
      </div>

      {showValidation && !hasAnySelection(value) && (
        <p className="text-xs text-rose-700 border border-rose-200 bg-rose-50 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {NO_MODULES_SELECTED}
        </p>
      )}

      {confirming && (
        <ConfirmDisable
          group={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => { onChange(toggleGroup(confirming, value, false)); setConfirming(null) }}
        />
      )}
    </div>
  )
}

function ModuleCard({
  group, selected, open, disabled, onToggleOpen, onToggleGroup, onToggleScreen,
}: {
  group: LicensableGroup
  selected: Set<string>
  open: boolean
  disabled: boolean
  onToggleOpen: () => void
  onToggleGroup: (enabled: boolean) => void
  onToggleScreen: (screenKey: string, enabled: boolean) => void
}) {
  const state = groupState(group, selected)
  const tone = toneFor(group, state)
  const meta = META[group.key]
  const Icon = meta?.icon ?? Boxes
  const count = group.screens.filter((s) => selected.has(s.screenKey)).length
  const off = state === "none"

  return (
    <div className={`rounded-xl border transition-colors ${off ? "border-slate-200 bg-slate-50/60" : "border-slate-200 bg-white"}`}>
      <div className="p-3 flex items-start gap-3">
        <span className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 transition-colors ${tone.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${off ? "text-slate-500" : "text-slate-800"}`}>{group.label}</p>
            <span className={`text-[10px] rounded border px-1 py-px shrink-0 ${tone.chip}`}>{tone.label}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{meta?.blurb ?? `${group.screens.length} screens.`}</p>
          <p className={`text-[11px] mt-1 font-medium ${off ? "text-slate-400" : "text-slate-600"}`}>
            {count} / {group.screens.length} enabled
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <MasterSwitch state={state} label={group.label} disabled={disabled} onChange={() => onToggleGroup(state !== "all")} />
          <button
            type="button" onClick={onToggleOpen} aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${group.label}`}
            className="h-6 w-6 grid place-items-center rounded hover:bg-slate-100 text-slate-400">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Collapses on disable: a module that is off has nothing to configure. */}
      {open && !off && (
        <div className="border-t border-slate-100 p-3 grid gap-1.5 sm:grid-cols-2">
          {group.screens.map((s) => {
            const on = selected.has(s.screenKey)
            return (
              <button
                key={s.screenKey}
                type="button"
                disabled={disabled}
                onClick={() => onToggleScreen(s.screenKey, !on)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors disabled:opacity-60 ${
                  on ? "border-blue-200 bg-blue-50/70 text-blue-800" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}>
                <span className={`h-3.5 w-3.5 rounded grid place-items-center shrink-0 border ${on ? "bg-blue-600 border-blue-600" : "border-slate-300"}`}>
                  {on && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MasterSwitch({ state, label, disabled, onChange }: { state: GroupState; label: string; disabled: boolean; onChange: () => void }) {
  const on = state === "all"
  const partial = state === "some"
  return (
    <button
      type="button"
      role="switch"
      aria-checked={partial ? "mixed" : on}
      aria-label={`${label} — ${partial ? "some screens enabled" : on ? "all screens enabled" : "disabled"}`}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-60 ${
        on ? "bg-blue-600" : partial ? "bg-amber-400" : "bg-slate-300"
      }`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all duration-200 ${on ? "left-[1.125rem]" : partial ? "left-2.5" : "left-0.5"}`} />
    </button>
  )
}

function ConfirmDisable({ group, onCancel, onConfirm }: { group: LicensableGroup; onCancel: () => void; onConfirm: () => void }) {
  const names = group.screens.slice(0, 5).map((s) => s.label).join(", ")
  const more = group.screens.length > 5 ? ` and ${group.screens.length - 5} more` : ""
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" /> Disable {group.label}?
        </p>
        <p className="text-xs text-slate-600">
          Disabling {group.label} will remove {names}{more} from this business — from the sidebar, the Navigation Manager,
          Roles &amp; Permissions and the APIs.
        </p>
        <p className="text-[11px] text-slate-500">
          No data is deleted. Re-enabling restores these screens with the tenant&apos;s records and navigation intact.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="h-8 px-3 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700">Disable</button>
        </div>
      </div>
    </div>
  )
}
