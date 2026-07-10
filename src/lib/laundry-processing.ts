// Garment processing route engine — routes each garment through the correct
// department sequence. The route derives from CONFIGURATION, never from
// hardcoded garment names:
//   1. item.processFlow — the SNAPSHOT frozen when the garment entered
//      processing (later config changes never rewrite in-progress history)
//   2. service.processFlow — the tenant's configured route for the service
//      (Services & Pricing → per-service processing route)
//   3. name-based heuristic — legacy fallback for services with no configured
//      route, preserved for pre-existing production data.

export const STAGE_LABELS: Record<string, string> = {
  RECEIVED: "Received", SORTING: "Sorting", WASH: "Wash", DRYCLEAN: "Dry Clean",
  DRY: "Dry", STEAM: "Steam", IRON: "Iron", FOLD: "Folding", CLEAN: "Cleaning",
  QC: "Quality Check", PACKED: "Packed", DISPATCHED: "Dispatched to Store",
}
export const DEPARTMENT: Record<string, string> = {
  WASH: "Washing", DRYCLEAN: "Dry Clean", DRY: "Drying", STEAM: "Steam",
  IRON: "Ironing", FOLD: "Folding", CLEAN: "Cleaning", QC: "Quality Check", PACKED: "Packing",
}
// Department workstations shown as separate queues. STEAM is NOT part of the
// active Laundry OS workflow (no Steam Iron product requirement); its label is
// retained above only for safe display of any legacy record.
export const WORKSTATIONS = ["WASH", "DRYCLEAN", "DRY", "IRON", "FOLD", "QC", "PACKED"] as const

// Stage codes a tenant may compose routes from (stable behaviour keys — the
// route config UI offers these; labels above are presentation only). STEAM is
// intentionally excluded so it is never inserted into a new service route.
export const ROUTE_STAGES = ["WASH", "DRYCLEAN", "DRY", "IRON", "FOLD", "CLEAN"] as const
// Every route always terminates in QC → PACKED (enforced on save + on read).
export const ROUTE_TERMINALS = ["QC", "PACKED"] as const

const VALID_STAGES = new Set<string>([...ROUTE_STAGES, ...ROUTE_TERMINALS, "RECEIVED", "SORTING"])

// Parse a stored JSON route; returns null when absent/invalid.
export function parseFlow(raw: string | null | undefined): string[] | null {
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || arr.length === 0) return null
    const stages = arr.map(String).filter((s) => VALID_STAGES.has(s))
    if (!stages.length) return null
    return normalizeFlow(stages)
  } catch { return null }
}

// Ensure a route ends in QC → PACKED exactly once, preserving working order.
export function normalizeFlow(stages: string[]): string[] {
  const work = stages.filter((s) => s !== "QC" && s !== "PACKED" && s !== "RECEIVED" && s !== "SORTING")
  return [...work, "QC", "PACKED"]
}

// Legacy heuristic — fallback ONLY when no configured route exists (no service
// processFlow and no item snapshot). Washed garments are dried then FOLDED
// before QC → PACKED. STEAM is not part of the active workflow, so a "steam
// iron" service routes as ironing.
export function getFlow(serviceName: string | null | undefined): string[] {
  const s = (serviceName || "").toLowerCase()
  if (s.includes("dry clean")) return ["DRYCLEAN", "IRON", "QC", "PACKED"]
  if (s.includes("iron") && !s.includes("wash")) return ["IRON", "QC", "PACKED"]
  if (s.includes("shoe")) return ["CLEAN", "QC", "PACKED"]
  if (s.includes("wash") && s.includes("iron")) return ["WASH", "DRY", "IRON", "FOLD", "QC", "PACKED"]
  if (s.includes("wash")) return ["WASH", "DRY", "FOLD", "QC", "PACKED"]
  if (s.includes("curtain") || s.includes("blanket")) return ["WASH", "DRY", "FOLD", "QC", "PACKED"]
  return ["WASH", "DRY", "FOLD", "QC", "PACKED"]
}

// Resolve the effective route for a garment: snapshot → service config → heuristic.
export function resolveFlow(item: { processFlow?: string | null; serviceName?: string | null }, serviceFlow?: string | null): string[] {
  return parseFlow(item.processFlow) ?? parseFlow(serviceFlow) ?? getFlow(item.serviceName)
}

export const firstStage = (serviceName: string | null | undefined) => getFlow(serviceName)[0]
export const firstStageOf = (flow: string[]) => flow[0]

export function nextStage(serviceName: string | null | undefined, current: string | null | undefined): string | null {
  return nextStageOf(getFlow(serviceName), current)
}
export function nextStageOf(flow: string[], current: string | null | undefined): string | null {
  const i = current ? flow.indexOf(current) : -1
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null
}

// Valid rework destinations for a QC failure: any working stage in the
// garment's own route (before QC).
export function reworkStagesOf(flow: string[]): string[] {
  return flow.filter((s) => s !== "QC" && s !== "PACKED")
}

export const departmentFor = (stage: string | null | undefined) => (stage ? DEPARTMENT[stage] || stage : "")
export const stageLabel = (stage: string | null | undefined) => (stage ? STAGE_LABELS[stage] || stage : "—")
