// Garment processing route engine — routes each garment through the correct
// department sequence. The route derives from CONFIGURATION, never from
// hardcoded garment names:
//   1. item.processFlow — the SNAPSHOT frozen when the garment entered
//      processing (later config changes never rewrite in-progress history)
//   2. service.processFlow — the tenant's configured route for the service
//      (Services & Pricing → per-service processing route)
//   3. name-based heuristic — legacy fallback for services with no configured
//      route, preserved for pre-existing production data.
//
// Workflow model (container-based finishing): garment barcodes are scanned
// through the cleaning stages AND Quality Check. QC is the final garment-barcode
// stage — after it, Iron / Folding operate on the PROCESSING CONTAINER
// (the Processing Package QR / bag), never on individual garments. A canonical
// route therefore places the finishing stages AFTER Quality Check:
//     e.g. WASH → DRY → QC → IRON → FOLD → PACKED
// Normalisation is ORDER-PRESERVING for stored snapshots (so an in-flight
// legacy garment whose route has finishing before QC is never rewritten); the
// canonical order is applied when a NEW service route is validated/written.

export const STAGE_LABELS: Record<string, string> = {
  RECEIVED: "Received", SORTING: "Sorting", WASH: "Wash", DRYCLEAN: "Dry Clean",
  DRY: "Dry", STEAM: "Steam", IRON: "Iron", FOLD: "Folding", CLEAN: "Cleaning",
  QC: "Quality Check", PACKED: "Packed", DISPATCHED: "Dispatched to Store",
}
export const DEPARTMENT: Record<string, string> = {
  WASH: "Washing", DRYCLEAN: "Dry Clean", DRY: "Drying", STEAM: "Steam",
  IRON: "Ironing", FOLD: "Folding", CLEAN: "Cleaning", QC: "Quality Check", PACKED: "Packing",
}
// Department workstations shown as separate queues. Order reflects the
// container-based finishing workflow: cleaning + QC are garment-barcode stages,
// then finishing (Iron/Fold) operates on the processing container. STEAM is NOT
// part of the active Laundry OS workflow (no Steam Iron product requirement);
// its label is retained above only for safe display of any legacy record.
export const WORKSTATIONS = ["WASH", "DRYCLEAN", "DRY", "QC", "IRON", "FOLD", "PACKED"] as const

// Finishing stages — the container-based stations AFTER Quality Check. These run
// on the Processing Package, not on garment barcodes.
export const FINISHING_STAGES = ["IRON", "FOLD"] as const

// Stages that run BEFORE Quality Check — the garment-barcode stations.
// Everything at QC or beyond is no longer operated on by individual barcodes.
const PRE_QC_STAGES = new Set<string>(["RECEIVED", "SORTING", "WASH", "DRYCLEAN", "DRY", "CLEAN"])

// A garment has passed Quality Check when it is no longer in a pre-QC cleaning
// stage and is not sitting AT Quality Check itself. Used to decide when a
// Processing Package becomes a READY_FOR_FINISHING container and to gate
// finishing-workstation actions.
export function hasPassedQc(stage: string | null | undefined): boolean {
  return !!stage && !PRE_QC_STAGES.has(stage) && stage !== "QC"
}

export const isFinishingStage = (stage: string | null | undefined) => !!stage && (FINISHING_STAGES as readonly string[]).includes(stage)

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

// Normalise a route, preserving the author's stage ORDER. QC keeps whatever
// position the stored route gave it (a canonical route has finishing AFTER QC,
// a legacy route may have it before) — an in-flight garment's snapshot is NEVER
// rewritten, so its remaining journey is unchanged. PACKED is always the last
// terminal; QC is appended if the stored route lacked it.
export function normalizeFlow(stages: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of stages) {
    if (s === "PACKED") continue
    if (s === "QC") { if (!seen.has("QC")) { seen.add("QC"); out.push("QC") } continue }
    if (s === "RECEIVED" || s === "SORTING") continue
    if (seen.has(s) || !VALID_STAGES.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  if (!seen.has("QC")) out.push("QC")
  out.push("PACKED")
  return out
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
//
// Canonical order: the cleaning stages keep their relative order and run BEFORE
// Quality Check; the finishing stages (Iron / Folding) always run AFTER QC —
// garment barcode scanning ends at QC, so finishing operates on the container.
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
  const preQC = working.filter((s) => !(FINISHING_STAGES as readonly string[]).includes(s))
  const finishing = working.filter((s) => (FINISHING_STAGES as readonly string[]).includes(s))
  return { ok: true, flow: [...preQC, "QC", ...finishing, "PACKED"] }
}

// Legacy heuristic — fallback ONLY when no configured route exists (no service
// processFlow and no item snapshot). Follows the container-based finishing
// model: cleaning + QC are the garment-barcode stages, then finishing
// (Iron/Fold) runs on the processing container AFTER QC. STEAM is not part of
// the active workflow, so a "steam iron" service routes as ironing.
export function getFlow(serviceName: string | null | undefined): string[] {
  const s = (serviceName || "").toLowerCase()
  // Dry Cleaning must pass through Drying + QC before entering Finishing.
  if (s.includes("dry clean")) return ["DRYCLEAN", "DRY", "QC", "IRON", "PACKED"]
  if (s.includes("iron") && !s.includes("wash")) return ["QC", "IRON", "PACKED"]
  if (s.includes("shoe")) return ["CLEAN", "QC", "PACKED"]
  if (s.includes("wash") && s.includes("iron")) return ["WASH", "DRY", "QC", "IRON", "FOLD", "PACKED"]
  if (s.includes("wash")) return ["WASH", "DRY", "QC", "FOLD", "PACKED"]
  if (s.includes("curtain") || s.includes("blanket")) return ["WASH", "DRY", "QC", "FOLD", "PACKED"]
  return ["WASH", "DRY", "QC", "FOLD", "PACKED"]
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

// Valid rework destinations for a QC failure: the CLEANING stages BEFORE
// Quality Check in the garment's own route. A QC failure sends the garment back
// to be cleaned/dried — never forward to a finishing stage (finishing runs
// after QC and only once a garment has been approved).
export function reworkStagesOf(flow: string[]): string[] {
  const idx = flow.indexOf("QC")
  const before = idx >= 0 ? flow.slice(0, idx) : flow
  return before.filter((s) => s !== "QC" && s !== "PACKED")
}

export const departmentFor = (stage: string | null | undefined) => (stage ? DEPARTMENT[stage] || stage : "")
export const stageLabel = (stage: string | null | undefined) => (stage ? STAGE_LABELS[stage] || stage : "—")
