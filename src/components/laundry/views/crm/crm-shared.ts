// Shared client types + helpers for the optional CRM module (Laundry OS).
import { useCallback, useEffect, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"

export interface CrmFieldOption { value: string; label: string; order: number; active: boolean }

export interface CrmField {
  id: string; fieldKey: string; label: string; type: string
  description: string | null; placeholder: string | null; defaultValue: string | null
  options: string | null; required: boolean; active: boolean; isSystem: boolean
  displayOrder: number; searchable: boolean; filterable: boolean
  showInList: boolean; showInCreate: boolean; showInEdit: boolean; showInDetail: boolean
}

export interface CrmStatus {
  id: string; name: string; color: string; displayOrder: number; active: boolean
  isDefault: boolean; kind: string; allowConversion: boolean; isSystem: boolean
}

export interface CrmSource { id: string; name: string; color: string; displayOrder: number; active: boolean }

export interface CrmStage {
  id: string; name: string; color: string; displayOrder: number; active: boolean
  probability: number; stageType: string; isInitial: boolean
}

export interface CrmLostReason { id: string; name: string; displayOrder: number; active: boolean }
export interface CrmActivityType { id: string; name: string; displayOrder: number; active: boolean }

export interface CrmLead {
  id: string; leadCode: string; displayName: string; phone: string | null; email: string | null
  fieldValues: string; statusId: string | null; sourceId: string | null
  status?: CrmStatus | null; source?: CrmSource | null
  assignedToId: string | null; assignedToName: string | null
  converted: boolean; convertedAt: string | null; archived: boolean
  createdByName: string | null; createdAt: string; updatedAt: string
  opportunity?: { id: string; oppCode: string; state: string } | null
}

export interface CrmOpportunity {
  id: string; oppCode: string; leadId: string; name: string; value: number
  probability: number | null; expectedCloseDate: string | null; state: string
  stageId: string | null; stage?: CrmStage | null; stageEnteredAt: string
  wonAt: string | null; wonValue: number | null; lostAt: string | null
  lostReasonId: string | null; lostReason?: CrmLostReason | null; lostNotes: string | null
  notes: string | null; assignedToId: string | null; assignedToName: string | null
  createdAt: string; updatedAt: string
  lead?: { id: string; leadCode: string; displayName: string; phone?: string | null } | null
}

export interface CrmActivity {
  id: string; actCode: string; type: string; subject: string; description: string | null
  outcome: string | null; activityAt: string; createdByName: string | null
  leadId: string | null; opportunityId: string | null
  lead?: { id: string; leadCode?: string; displayName: string } | null
  opportunity?: { id: string; oppCode?: string; name: string } | null
}

export interface CrmTask {
  id: string; taskCode: string; title: string; description: string | null
  priority: string; status: string; dueAt: string | null
  assignedToId: string | null; assignedToName: string | null
  completedAt: string | null; createdAt: string
  leadId: string | null; opportunityId: string | null
  lead?: { id: string; displayName: string } | null
  opportunity?: { id: string; name: string } | null
}

export interface CrmEventRow {
  id: string; kind: string; label: string; meta: string | null
  actorName: string | null; createdAt: string
}

export const inr = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"

export function parseOptions(raw: string | null): CrmFieldOption[] {
  if (!raw) return []
  try { return JSON.parse(raw) as CrmFieldOption[] } catch { return [] }
}

export function parseValues(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || "{}") } catch { return {} }
}

// Human-readable value for a dynamic field (option labels, dates, currency).
export function displayValue(field: CrmField, values: Record<string, unknown>): string {
  const v = values[field.fieldKey]
  if (v == null || v === "") return "—"
  switch (field.type) {
    case "SELECT": case "RADIO": {
      const opt = parseOptions(field.options).find((o) => o.value === String(v))
      return opt?.label || String(v)
    }
    case "MULTISELECT": {
      const opts = parseOptions(field.options)
      const arr = Array.isArray(v) ? v : [v]
      return arr.map((x) => opts.find((o) => o.value === String(x))?.label || String(x)).join(", ")
    }
    case "CHECKBOX": case "TOGGLE": return v === true || v === "true" ? "Yes" : "No"
    case "CURRENCY": return inr(Number(v))
    case "DATE": return fmtDate(String(v))
    case "DATETIME": return fmtDateTime(String(v))
    default: return String(v)
  }
}

// Current actor (for createdBy / audit attribution) from the auth store.
export function useCrmActor() {
  const { user } = useAuthStore()
  return { actorId: user?.id, actorName: user?.name }
}

// Loads the tenant's CRM configuration (fields, statuses, sources, stages,
// lost reasons, activity types) in one hook — most CRM views need several.
export function useCrmMeta(businessId: string | null, opts: { includeInactive?: boolean } = {}) {
  const [fields, setFields] = useState<CrmField[]>([])
  const [statuses, setStatuses] = useState<CrmStatus[]>([])
  const [sources, setSources] = useState<CrmSource[]>([])
  const [stages, setStages] = useState<CrmStage[]>([])
  const [lostReasons, setLostReasons] = useState<CrmLostReason[]>([])
  const [activityTypes, setActivityTypes] = useState<CrmActivityType[]>([])
  const [loading, setLoading] = useState(true)
  const inactive = opts.includeInactive ? "&includeInactive=1" : ""

  const reload = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const qs = `businessId=${encodeURIComponent(businessId)}${inactive}`
    const get = (path: string) => fetch(`/api/laundry/crm/settings/${path}?${qs}`).then((r) => r.json()).catch(() => ({}))
    const [f, st, so, sg, lr, at] = await Promise.all([
      get("lead-fields"), get("lead-statuses"), get("lead-sources"),
      get("sales-stages"), get("lost-reasons"), get("activity-types"),
    ])
    setFields(f.success ? f.data : [])
    setStatuses(st.success ? st.data : [])
    setSources(so.success ? so.data : [])
    setStages(sg.success ? sg.data : [])
    setLostReasons(lr.success ? lr.data : [])
    setActivityTypes(at.success ? at.data : [])
    setLoading(false)
  }, [businessId, inactive])

  useEffect(() => { reload() }, [reload])
  return { fields, statuses, sources, stages, lostReasons, activityTypes, loading, reload }
}

// Whether CRM is enabled for the current tenant (drives the sidebar section
// and page guards; the server enforces independently).
export function useCrmEnabled() {
  const { currentBusinessId } = useAuthStore()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!currentBusinessId) { setEnabled(false); return }
    let alive = true
    fetch(`/api/laundry/crm/entitlement?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setEnabled(!!j.enabled) })
      .catch(() => { if (alive) setEnabled(false) })
    return () => { alive = false }
  }, [currentBusinessId])
  return enabled // null = loading
}
