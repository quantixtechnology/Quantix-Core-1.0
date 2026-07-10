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
// De-duplicates working stages (defence for any legacy record that stored a
// repeated stage before validateProcessFlow was enforced on write).
export function normalizeFlow(stages: string[]): string[] {
  const seen = new Set<string>()
  const work: string[] = []
  for (const s of stages) {
    if (s === "QC" || s === "PACKED" || s === "RECEIVED" || s === "SORTING") continue
    if (seen.has(s)) continue
    seen.add(s)
    work.push(s)
  }
  return [...work, "QC", "PACKED"]
}

// Stage codes a write request may legitimately contain: the configurable
// working stages plus the mandatory QC → PACKED terminals. RECEIVED/SORTING
// and STEAM are never configurable.
const CONFIGURABLE_INPUT = new Set<string>([...ROUTE_STAGES, ...ROUTE_TERMINALS])

export type ProcessFlowValidation =
  | { ok: true; flow: string[] | null }
  | { ok: false; code: "INVALID_PROCESS_FLOW"; error: string }

// CANONICAL processing-route validator — the SINGLE source of truth for what a
// LaundryService.processFlow may contain. Every API that writes processFlow
// (service create, service update, any future writer) MUST route through this.
//
// Contract: the caller supplies the CONFIGURABLE working stages
// (Wash / Dry / Dry Clean / Iron / Fold / Clean). QC → PACKED are the mandatory
// terminals and are APPENDED here — the client does not manage them. A
// well-formed trailing "QC","PACKED" is tolerated (idempotent re-save) but is
// never required. null / [] clears the route (engine falls back to the legacy
// name heuristic). Anything else is REJECTED with INVALID_PROCESS_FLOW — the
// route is never silently rewritten into something the operator did not choose.
export function validateProcessFlow(input: unknown): ProcessFlowValidation {
  if (input === null || input === undefined) return { ok: true, flow: null }
  if (!Array.isArray(input)) return { ok: false, code: "INVALID_PROCESS_FLOW", error: "Processing route must be a list of stages." }
  const raw = input.map((s) => String(s).toUpperCase().trim()).filter(Boolean)
  if (raw.length === 0) return { ok: true, flow: null }

  const label = (s: string) => STAGE_LABELS[s] || s
  // STEAM is retired; any unknown/internal stage is rejected outright.
  for (const s of raw) {
    if (s === "STEAM") return { ok: false, code: "INVALID_PROCESS_FLOW", error: `"Steam" is not an available processing stage.` }
    if (!CONFIGURABLE_INPUT.has(s)) return { ok: false, code: "INVALID_PROCESS_FLOW", error: `"${label(s)}" is not a valid processing stage.` }
  }
  // Terminals: tolerate exactly one trailing QC, PACKED (in that order). Any
  // other placement — QC/PACKED mid-route, wrong order, duplicated, PACKED not
  // last — is a hard rejection.
  let working = raw
  if (raw.includes("QC") || raw.includes("PACKED")) {
    const n = raw.length
    const wellFormed = n >= 2 && raw[n - 2] === "QC" && raw[n - 1] === "PACKED"
      && raw.filter((s) => s === "QC").length === 1 && raw.filter((s) => s === "PACKED").length === 1
    if (!wellFormed) return { ok: false, code: "INVALID_PROCESS_FLOW", error: "Quality Check and Packing must be the final two stages, in that order — nothing may come after Packing." }
    working = raw.slice(0, n - 2)
  }
  if (working.length === 0) return { ok: false, code: "INVALID_PROCESS_FLOW", error: "A service must have at least one processing stage before Quality Check and Packing." }
  const seen = new Set<string>()
  for (const s of working) {
    if (seen.has(s)) return { ok: false, code: "INVALID_PROCESS_FLOW", error: `Duplicate stage "${label(s)}" — each processing stage may appear only once.` }
    seen.add(s)
  }
  return { ok: true, flow: [...working, "QC", "PACKED"] }
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
