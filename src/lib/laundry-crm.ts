// Laundry OS — optional CRM module: shared server helpers.
//
// Entitlement: CRM is a per-tenant feature (LaundryBusinessFeature key "CRM")
// toggled by the Super Admin. EVERY CRM API resolves the tenant through
// requireCrmBusiness() so a disabled tenant is rejected server-side — hiding
// the sidebar section alone is not security.
//
// Codes follow the existing laundry-codes.ts month-scoped pattern:
//   LED-CRM-YYYYMM-NNNNNN · OPP-CRM-… · ACT-CRM-… · TSK-CRM-…
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness, type ResolvedLaundryBusiness } from "@/lib/laundry-business"

export const CRM_FEATURE_KEY = "CRM"

export type CrmBusiness = ResolvedLaundryBusiness

// Resolve the laundry tenant AND verify the CRM feature is enabled for it.
// Returns null when the business doesn't exist; { enabled: false } when CRM is off.
export async function resolveCrmAccess(businessId: string | null | undefined): Promise<{ biz: CrmBusiness; enabled: boolean } | null> {
  const biz = await resolveLaundryBusiness(businessId)
  if (!biz) return null
  const feature = await prisma.laundryBusinessFeature.findUnique({
    where: { businessId_featureKey: { businessId: biz.id, featureKey: CRM_FEATURE_KEY } },
  })
  return { biz, enabled: !!feature?.enabled }
}

// Standard guard for CRM API routes. Throws typed errors the routes map to 404/403.
export class CrmAccessError extends Error {
  constructor(public status: 403 | 404, message: string) { super(message) }
}

export async function requireCrmBusiness(businessId: string | null | undefined): Promise<CrmBusiness> {
  const access = await resolveCrmAccess(businessId)
  if (!access) throw new CrmAccessError(404, "Laundry business not found")
  if (!access.enabled) throw new CrmAccessError(403, "CRM is not enabled for this business")
  return access.biz
}

// ─── Code generation (month-scoped, max-code + 1 like laundry-codes.ts) ────
function monthPrefix(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
}

async function nextCode(model: "laundryCrmLead" | "laundryCrmOpportunity" | "laundryCrmActivity" | "laundryCrmTask", field: string, prefixCode: string): Promise<string> {
  const prefix = `${prefixCode}-CRM-${monthPrefix()}-`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = await (prisma as any)[model].findFirst({
    where: { [field]: { startsWith: prefix } },
    orderBy: { [field]: "desc" },
    select: { [field]: true },
  })
  const next = last ? parseInt(String(last[field]).split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(next).padStart(6, "0")}`
}

export const generateLeadCode = () => nextCode("laundryCrmLead", "leadCode", "LED")
export const generateOpportunityCode = () => nextCode("laundryCrmOpportunity", "oppCode", "OPP")
export const generateActivityCode = () => nextCode("laundryCrmActivity", "actCode", "ACT")
export const generateTaskCode = () => nextCode("laundryCrmTask", "taskCode", "TSK")

// ─── Timeline events ────────────────────────────────────────────────────────
export interface CrmActor { id?: string | null; name?: string | null }

export async function crmEvent(businessId: string, kind: string, label: string, opts: {
  leadId?: string | null; opportunityId?: string | null; meta?: unknown; actor?: CrmActor
} = {}) {
  await prisma.laundryCrmEvent.create({
    data: {
      businessId, kind, label,
      leadId: opts.leadId || null,
      opportunityId: opts.opportunityId || null,
      meta: opts.meta ? JSON.stringify(opts.meta) : null,
      actorId: opts.actor?.id || null,
      actorName: opts.actor?.name || null,
    },
  })
}

// ─── Opportunity ownership ──────────────────────────────────────────────────
// PHASE 1: there is exactly ONE owner concept. The Lead Owner owns the deal;
// an Opportunity inherits it at conversion and has no separately editable
// owner. The server is the enforcement point — an owner sent by a client is
// dropped, never trusted.
//
// FUTURE-PROOFING (deliberately not exposed in the UI today):
//   · The Opportunity already stores assignedToId/assignedToName, so giving it
//     a dedicated owner later needs NO schema redesign — only lifting the
//     write-block in the PUT route and rendering an editable control.
//   · `ownerSource` records HOW the current owner got there:
//       "INHERITED" — copied from the Lead Owner at conversion (Phase 1)
//       "EXPLICIT"  — deliberately set on the opportunity (future)
//       null        — pre-dates this field; provenance unknown. Existing rows
//                     are left null on purpose; nothing is backfilled.
//     A future "the Lead Owner changed — apply to open opportunities?" prompt
//     can then safely target only INHERITED rows and leave EXPLICIT ones alone,
//     which is impossible to derive after the fact by comparing names.
//
// Everything that decides an opportunity's owner goes through here, so there is
// one place to change when Phase 2 arrives.

export const OWNER_SOURCE_INHERITED = "INHERITED"
export const OWNER_SOURCE_EXPLICIT = "EXPLICIT"

export interface CrmOwner {
  assignedToId: string | null
  assignedToName: string | null
  ownerSource: string | null
}

/** The owner a NEW opportunity takes: always the Lead Owner in Phase 1. */
export function ownerForNewOpportunity(lead: { assignedToId: string | null; assignedToName: string | null }): CrmOwner {
  return {
    assignedToId: lead.assignedToId,
    assignedToName: lead.assignedToName,
    ownerSource: OWNER_SOURCE_INHERITED,
  }
}

/**
 * Strip any owner a client tried to send. Phase 1 has no editable opportunity
 * owner, so this always returns nothing to write. When Phase 2 lands, this is
 * the single function that starts returning an owner patch (plus
 * ownerSource: EXPLICIT) instead of an empty object.
 */
export function ownerPatchFromRequest(_body: unknown): Partial<CrmOwner> {
  return {}
}

// ─── Per-tenant CRM behaviour config ────────────────────────────────────────
// Settings that are a SWITCH rather than a list. Read-through with a default,
// so a tenant that has never opened CRM Settings still behaves sensibly and no
// row has to exist up front.

export type CrmProbabilityMode = "AUTO_FROM_STAGE" | "MANUAL"

export interface CrmConfig { probabilityMode: CrmProbabilityMode }

export const DEFAULT_CRM_CONFIG: CrmConfig = { probabilityMode: "AUTO_FROM_STAGE" }

export function normalizeProbabilityMode(v: unknown): CrmProbabilityMode {
  return v === "MANUAL" ? "MANUAL" : "AUTO_FROM_STAGE"
}

export async function getCrmConfig(businessId: string): Promise<CrmConfig> {
  const row = await prisma.laundryCrmConfig.findUnique({
    where: { businessId }, select: { probabilityMode: true },
  }).catch(() => null)
  if (!row) return { ...DEFAULT_CRM_CONFIG }
  return { probabilityMode: normalizeProbabilityMode(row.probabilityMode) }
}

/**
 * The probability an opportunity should carry after landing on `stage`.
 * AUTO_FROM_STAGE → always the stage's configured probability.
 * MANUAL          → whatever it already had (never overwritten by a stage move).
 */
export function probabilityForStage(
  mode: CrmProbabilityMode, stageProbability: number, current: number | null,
): number | null {
  return mode === "MANUAL" ? current : stageProbability
}

// ─── Tenant defaults (idempotent) ───────────────────────────────────────────
// Called when the Super Admin enables CRM and lazily from the entitlement/
// settings endpoints, so an already-enabled tenant self-initializes.
// Defaults are STARTING configuration only — everything is tenant-editable.

const DEFAULT_STATUSES = [
  { name: "New", color: "#2563EB", kind: "OPEN", isDefault: true, allowConversion: true },
  { name: "Contacted", color: "#0EA5E9", kind: "OPEN", allowConversion: true },
  { name: "Follow-up Required", color: "#F59E0B", kind: "OPEN", allowConversion: true },
  { name: "Qualified", color: "#10B981", kind: "OPEN", allowConversion: true },
  { name: "Not Interested", color: "#94A3B8", kind: "CLOSED", allowConversion: false },
  { name: "Converted", color: "#16A34A", kind: "CONVERTED", allowConversion: false, isSystem: true },
  { name: "Lost", color: "#EF4444", kind: "LOST", allowConversion: false },
]

// Distinct colors so source distributions (donut/legend) are readable out of
// the box — tenant-editable in CRM Settings.
const DEFAULT_SOURCES: { name: string; color: string }[] = [
  { name: "Walk-in", color: "#2563EB" },
  { name: "Website", color: "#0EA5E9" },
  { name: "Phone Call", color: "#10B981" },
  { name: "WhatsApp", color: "#22C55E" },
  { name: "Referral", color: "#8B5CF6" },
  { name: "Facebook", color: "#3B5998" },
  { name: "Instagram", color: "#E1306C" },
  { name: "Google", color: "#F59E0B" },
  { name: "Campaign", color: "#F97316" },
  { name: "Other", color: "#64748B" },
]

const DEFAULT_STAGES = [
  { name: "Qualification", probability: 10, stageType: "OPEN", isInitial: true, color: "#64748B" },
  { name: "Requirement Discussion", probability: 25, stageType: "OPEN", color: "#0EA5E9" },
  { name: "Demo / Meeting", probability: 40, stageType: "OPEN", color: "#2563EB" },
  { name: "Proposal", probability: 60, stageType: "OPEN", color: "#8B5CF6" },
  { name: "Negotiation", probability: 75, stageType: "OPEN", color: "#F59E0B" },
  { name: "Final Discussion", probability: 90, stageType: "OPEN", color: "#F97316" },
  { name: "Won", probability: 100, stageType: "WON", color: "#16A34A" },
  { name: "Lost", probability: 0, stageType: "LOST", color: "#EF4444" },
]

const DEFAULT_LOST_REASONS = ["Price", "No Response", "Competitor", "Requirement Changed", "Budget Issue", "Service Not Available", "Decision Delayed", "Other"]

const DEFAULT_ACTIVITY_TYPES = ["Call", "Meeting", "WhatsApp", "Email", "Follow-up", "General"]

const DEFAULT_PRIORITIES: { name: string; color: string }[] = [
  { name: "High", color: "#EF4444" },
  { name: "Medium", color: "#F59E0B" },
  { name: "Low", color: "#94A3B8" },
]

const DEFAULT_TASK_TYPES = ["Follow-up", "Call", "Meeting", "Admin", "Other"]

type FieldSeed = {
  fieldKey: string; label: string; type: string; required?: boolean; isSystem?: boolean
  showInList?: boolean; searchable?: boolean; filterable?: boolean; placeholder?: string
  options?: { value: string; label: string; order: number; active: boolean }[]
}

// System fields (first_name, phone, email) drive the promoted displayName/phone/
// email columns on LaundryCrmLead — protected from deletion/deactivation.
const DEFAULT_FIELDS: FieldSeed[] = [
  { fieldKey: "first_name", label: "First Name", type: "TEXT", required: true, isSystem: true, showInList: true, searchable: true },
  { fieldKey: "last_name", label: "Last Name", type: "TEXT", isSystem: true, showInList: true, searchable: true },
  { fieldKey: "phone", label: "Phone Number", type: "PHONE", required: true, isSystem: true, showInList: true, searchable: true },
  { fieldKey: "alternate_phone", label: "Alternate Phone", type: "PHONE" },
  { fieldKey: "email", label: "Email", type: "EMAIL", isSystem: true, showInList: true, searchable: true },
  { fieldKey: "business_name", label: "Business Name", type: "TEXT", showInList: true, searchable: true },
  { fieldKey: "interested_service", label: "Interested Service", type: "TEXT", filterable: true },
  { fieldKey: "estimated_monthly_orders", label: "Estimated Monthly Orders", type: "NUMBER" },
  { fieldKey: "estimated_monthly_value", label: "Estimated Monthly Value", type: "CURRENCY" },
  { fieldKey: "address", label: "Address", type: "ADDRESS" },
  { fieldKey: "city", label: "City", type: "TEXT", filterable: true },
  { fieldKey: "state", label: "State", type: "TEXT" },
  { fieldKey: "pin_code", label: "PIN Code", type: "TEXT" },
  { fieldKey: "expected_closing_date", label: "Expected Closing Date", type: "DATE" },
  { fieldKey: "notes", label: "Notes", type: "TEXTAREA" },
]

export async function ensureCrmDefaults(businessId: string): Promise<void> {
  const [statusCount, sourceCount, stageCount, reasonCount, typeCount, fieldCount, priorityCount, taskTypeCount] = await Promise.all([
    prisma.laundryCrmLeadStatus.count({ where: { businessId } }),
    prisma.laundryCrmLeadSource.count({ where: { businessId } }),
    prisma.laundryCrmSalesStage.count({ where: { businessId } }),
    prisma.laundryCrmLostReason.count({ where: { businessId } }),
    prisma.laundryCrmActivityType.count({ where: { businessId } }),
    prisma.laundryCrmLeadField.count({ where: { businessId } }),
    prisma.laundryCrmPriority.count({ where: { businessId } }),
    prisma.laundryCrmTaskType.count({ where: { businessId } }),
  ])

  const work: Promise<unknown>[] = []
  if (statusCount === 0) work.push(prisma.laundryCrmLeadStatus.createMany({
    data: DEFAULT_STATUSES.map((s, i) => ({ businessId, displayOrder: i, ...s })),
  }))
  if (sourceCount === 0) work.push(prisma.laundryCrmLeadSource.createMany({
    data: DEFAULT_SOURCES.map((s, i) => ({ businessId, name: s.name, color: s.color, displayOrder: i })),
  }))
  if (stageCount === 0) work.push(prisma.laundryCrmSalesStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ businessId, displayOrder: i, ...s })),
  }))
  if (reasonCount === 0) work.push(prisma.laundryCrmLostReason.createMany({
    data: DEFAULT_LOST_REASONS.map((name, i) => ({ businessId, name, displayOrder: i })),
  }))
  if (typeCount === 0) work.push(prisma.laundryCrmActivityType.createMany({
    data: DEFAULT_ACTIVITY_TYPES.map((name, i) => ({ businessId, name, displayOrder: i })),
  }))
  if (fieldCount === 0) work.push(prisma.laundryCrmLeadField.createMany({
    data: DEFAULT_FIELDS.map((f, i) => ({
      businessId, fieldKey: f.fieldKey, label: f.label, type: f.type,
      required: !!f.required, isSystem: !!f.isSystem, displayOrder: i,
      searchable: !!f.searchable, filterable: !!f.filterable, showInList: !!f.showInList,
      placeholder: f.placeholder || null,
      options: f.options ? JSON.stringify(f.options) : null,
    })),
  }))
  if (priorityCount === 0) work.push(prisma.laundryCrmPriority.createMany({
    data: DEFAULT_PRIORITIES.map((p, i) => ({ businessId, name: p.name, color: p.color, displayOrder: i, isDefault: i === 1 })),
  }))
  if (taskTypeCount === 0) work.push(prisma.laundryCrmTaskType.createMany({
    data: DEFAULT_TASK_TYPES.map((name, i) => ({ businessId, name, displayOrder: i })),
  }))
  if (work.length) await Promise.all(work)
}

// ─── Dynamic field value validation ─────────────────────────────────────────
export interface LeadFieldDef {
  fieldKey: string; label: string; type: string; required: boolean; active: boolean
  showInCreate: boolean; showInEdit: boolean; options: string | null
}

export class CrmValidationError extends Error {}

// Validate + coerce submitted values against the tenant's active field config.
// mode "create" enforces required fields; "edit" only validates provided keys.
export function buildLeadValues(
  fields: LeadFieldDef[],
  input: Record<string, unknown>,
  mode: "create" | "edit",
  existing: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...existing }
  for (const f of fields) {
    if (!f.active) continue
    const visible = mode === "create" ? f.showInCreate : f.showInEdit
    const provided = Object.prototype.hasOwnProperty.call(input, f.fieldKey)
    if (!provided) {
      if (mode === "create" && f.required && visible && (out[f.fieldKey] == null || out[f.fieldKey] === "")) {
        throw new CrmValidationError(`${f.label} is required`)
      }
      continue
    }
    let v: unknown = input[f.fieldKey]
    if (v === "" || v == null) {
      if (f.required && visible) throw new CrmValidationError(`${f.label} is required`)
      out[f.fieldKey] = null
      continue
    }
    switch (f.type) {
      case "NUMBER": {
        const n = Number(v)
        if (!Number.isFinite(n)) throw new CrmValidationError(`${f.label} must be a number`)
        v = Math.trunc(n)
        break
      }
      case "DECIMAL": case "CURRENCY": {
        const n = Number(v)
        if (!Number.isFinite(n)) throw new CrmValidationError(`${f.label} must be a number`)
        v = n
        break
      }
      case "CHECKBOX": case "TOGGLE": v = v === true || v === "true" || v === "1"; break
      case "EMAIL": {
        const s = String(v).trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new CrmValidationError(`${f.label} must be a valid email`)
        v = s
        break
      }
      case "SELECT": case "RADIO": case "MULTISELECT": {
        const opts = f.options ? (JSON.parse(f.options) as { value: string; active?: boolean }[]) : []
        const valid = new Set(opts.filter((o) => o.active !== false).map((o) => o.value))
        const all = new Set(opts.map((o) => o.value))
        const vals = f.type === "MULTISELECT" ? (Array.isArray(v) ? v.map(String) : [String(v)]) : [String(v)]
        for (const s of vals) {
          // Historical (inactive) values already on the record stay valid on edit.
          const wasAlready = Array.isArray(existing[f.fieldKey])
            ? (existing[f.fieldKey] as unknown[]).map(String).includes(s)
            : String(existing[f.fieldKey] ?? "") === s
          if (!valid.has(s) && !(all.has(s) && wasAlready)) throw new CrmValidationError(`Invalid option for ${f.label}`)
        }
        v = f.type === "MULTISELECT" ? vals : vals[0]
        break
      }
      default: v = typeof v === "string" ? v.trim() : String(v)
    }
    out[f.fieldKey] = v
  }
  return out
}

// Promote well-known system field values to the indexed Lead columns.
export function promoteSystemFields(fieldValues: Record<string, unknown>): { displayName: string; phone: string | null; email: string | null } {
  const first = String(fieldValues.first_name ?? "").trim()
  const last = String(fieldValues.last_name ?? "").trim()
  const displayName = [first, last].filter(Boolean).join(" ") || String(fieldValues.business_name ?? "").trim() || "Unnamed Lead"
  const phone = String(fieldValues.phone ?? "").trim() || null
  const email = String(fieldValues.email ?? "").trim() || null
  return { displayName, phone, email }
}
