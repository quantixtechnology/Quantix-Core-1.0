"use client"

// Feature selector — the hierarchical Parent → Child licence picker.
//
// Renders whatever the licensing catalog contains. It has no list of modules
// of its own, so registering a module and its screens in SCREEN_MODULES is the
// only step needed for it to appear here — no UI change, which is the point of
// the engine.
//
// Parent state is tri-state: all, none, or indeterminate when only some
// children are selected. A parent shown as fully checked while a child is off
// would misreport what the tenant is buying.

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Minus, Check } from "lucide-react"
import {
  licensableGroups, groupState, toggleGroup, toggleScreen, hasAnySelection, NO_MODULES_SELECTED,
} from "@/lib/laundry-licensing"
import type { LicensableGroup } from "@/lib/laundry-licensing"

export interface FeatureSelectorProps {
  /** Selected screen keys. Controlled — the parent owns the state. */
  value: Set<string>
  onChange: (next: Set<string>) => void
  /** Show the "select at least one" warning inline. */
  showValidation?: boolean
  disabled?: boolean
}

export function FeatureSelector({ value, onChange, showValidation = true, disabled = false }: FeatureSelectorProps) {
  const groups = useMemo(() => licensableGroups(), [])
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    // Opt-in modules start collapsed: they are the exception, and an expanded
    // wall of every screen on first render is unreadable.
    Object.fromEntries(groups.map((g) => [g.key, !g.optIn])),
  )

  const empty = !hasAnySelection(value)

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <GroupCard
          key={g.key}
          group={g}
          selected={value}
          open={!!open[g.key]}
          disabled={disabled}
          onToggleOpen={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
          onToggleGroup={(on) => onChange(toggleGroup(g, value, on))}
          onToggleScreen={(key, on) => onChange(toggleScreen(key, value, on))}
        />
      ))}

      {showValidation && empty && (
        <p className="text-xs text-rose-600 border border-rose-200 bg-rose-50 rounded-md px-3 py-2">{NO_MODULES_SELECTED}</p>
      )}
    </div>
  )
}

function GroupCard({
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
  const enabledCount = group.screens.filter((s) => selected.has(s.screenKey)).length

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <TriStateBox
          state={state}
          disabled={disabled}
          label={group.label}
          onChange={() => onToggleGroup(state !== "all")}
        />
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex-1 flex items-center gap-1.5 text-left min-w-0">
          {open ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
          <span className="text-sm font-medium text-slate-800 truncate">{group.label}</span>
          <span className="text-[11px] text-slate-400 shrink-0">({group.screens.length})</span>
          {group.optIn && <span className="text-[10px] rounded border border-amber-200 bg-amber-50 text-amber-700 px-1 shrink-0">Opt-in</span>}
        </button>
        <span className={`text-[11px] shrink-0 ${enabledCount === 0 ? "text-slate-400" : "text-slate-600"}`}>
          {enabledCount} / {group.screens.length} enabled
        </span>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-3 py-2 grid gap-1 sm:grid-cols-2">
          {group.screens.map((s) => (
            <label key={s.screenKey} className={`flex items-center gap-2 text-xs ${disabled ? "opacity-60" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                className="accent-blue-600"
                disabled={disabled}
                checked={selected.has(s.screenKey)}
                onChange={(e) => onToggleScreen(s.screenKey, e.target.checked)}
              />
              <span className="text-slate-700 truncate">{s.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A real tri-state checkbox. `indeterminate` is a DOM property with no HTML
 * attribute, so React cannot set it declaratively — hence the ref callback.
 */
function TriStateBox({ state, label, disabled, onChange }: { state: "all" | "none" | "some"; label: string; disabled: boolean; onChange: () => void }) {
  return (
    <span className="relative inline-flex h-4 w-4 shrink-0">
      <input
        type="checkbox"
        aria-label={`${label} — ${state === "all" ? "all screens" : state === "some" ? "some screens" : "no screens"}`}
        checked={state === "all"}
        disabled={disabled}
        ref={(el) => { if (el) el.indeterminate = state === "some" }}
        onChange={onChange}
        className="peer h-4 w-4 appearance-none rounded border border-slate-300 bg-white checked:bg-blue-600 checked:border-blue-600 disabled:opacity-60"
      />
      {state === "all" && <Check className="pointer-events-none absolute inset-0 h-4 w-4 text-white" />}
      {state === "some" && <Minus className="pointer-events-none absolute inset-0 h-4 w-4 text-blue-600" />}
    </span>
  )
}
