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
// ── Approved operational model (single source of truth) ─────────────────────
//   Cleaning (Wash OR Dry Clean) → Dry & Quality Check (QC) → Sorting →
//   Iron / Fold (optional, BAG-BASED) → Transit (DISPATCHED).
//
// Garment barcodes are the tracking identity through Cleaning + QC. QC ("Dry &
// Quality Check") is the SINGLE merged workstation — there is no separate Dry or
// Quality Check station. Sorting is the permanent garment→bag transition point:
// the operator scans every garment, and when the scanned set equals the order,
// ONE laundry bag is scanned and bound to the order (1 order = 1 bag), retiring
// every garment barcode. From then on ONLY the bag QR is valid — Iron / Fold /
// Transit operate on the bag, never on garment barcodes.
//
// The route a tenant configures is ONLY the service-specific departments
// (Wash / Dry Clean / Iron / Fold). The shared operational stages (Dry &
// Quality Check, Sorting) are injected by this engine so every service follows
// the same lifecycle. The terminal stage is Transit (DISPATCHED); the legacy
// PACKED terminal is accepted on read for pre-existing garments.
//
// Normalisation is ORDER-PRESERVING for stored snapshots (so an in-flight
// legacy garment is never rewritten); the canonical order is applied when a NEW
// service route is validated/written.
//
//     e.g. WASH → QC → SORTING → IRON → FOLD → DISPATCHED
//     e.g. DRYCLEAN → QC → SORTING → DISPATCHED

export const STAGE_LABELS: Record<string, string> = {
  RECEIVED: "Received", SORTING: "Sorting", WASH: "Wash", DRYCLEAN: "Dry Clean",
  DRY: "Dry", STEAM: "Steam", IRON: "Iron", FOLD: "Fold", CLEAN: "Cleaning",
  QC: "Dry & Quality Check", PACKED: "Packed", DISPATCHED: "Transit",
}
export const DEPARTMENT: Record<string, string> = {
  WASH: "Washing", DRYCLEAN: "Dry Clean", DRY: "Drying", STEAM: "Steam",
  IRON: "Ironing", FOLD: "Folding", CLEAN: "Cleaning", QC: "Dry & Quality Check",
  SORTING: "Sorting", PACKED: "Packing", DISPATCHED: "Transit",
}
// Department workstations shown as separate queues. Order reflects the approved
// model: cleaning + Dry & Quality Check are garment-barcode stations, then
// Sorting (the bag-assignment transition), then the BAG-BASED finishing stations
// (Iron / Fold) and the Transit terminal. STEAM is NOT part of the active
// Laundry OS workflow (no Steam Iron product requirement); its label is retained
// above only for safe display of any legacy record.
export const WORKSTATIONS = ["WASH", "DRYCLEAN", "QC", "SORTING", "IRON", "FOLD", "DISPATCHED"] as const

// Finishing stages — the BAG-BASED stations AFTER Sorting. They run on the
// assigned laundry bag / processing container, not on garment barcodes.
export const FINISHING_STAGES = ["IRON", "FOLD"] as const

// Stages that run BEFORE Quality Check — the garment-barcode cleaning stations.
// Everything at QC or beyond (including Sorting, the bag-assignment point) is no
// longer tracked by an individual garment barcode once the bag is assigned.
const PRE_QC_STAGES = new Set<string>(["RECEIVED", "WASH", "DRYCLEAN", "DRY", "CLEAN"])

// The terminal stage: every garment route ends at Transit. The legacy PACKED
// terminal is accepted so pre-existing garments finish without being rewritten.
export const TERMINAL_STAGE = "DISPATCHED"
const LEGACY_TERMINALS = new Set<string>(["PACKED"])
export const isProcessingTerminal = (stage: string | null | undefined): boolean =>
  !!stage && (stage === TERMINAL_STAGE || LEGACY_TERMINALS.has(stage))

// A garment has passed Quality Check when it is no longer in a pre-QC cleaning
// stage and is not sitting AT Quality Check itself. Used to decide when a
// Processing Package becomes a READY_FOR_FINISHING container and to gate
// finishing-workstation actions.
export function hasPassedQc(stage: string | null | undefined): boolean {
  return !!stage && !PRE_QC_STAGES.has(stage) && stage !== "QC"
}

export const isFinishingStage = (stage: string | null | undefined) => !!stage && (FINISHING_STAGES as readonly string[]).includes(stage)

// Stage codes a tenant may compose a route from (stable behaviour keys — the
// route config UI offers these; labels above are presentation only). The user
// configures ONLY the service-specific departments: Wash / Dry Clean / Iron /
// Fold (plus Cleaning for legacy shoe care). There is NO separate "Dry" stage —
// drying is part of the merged "Dry & Quality Check" workstation. STEAM is
// intentionally excluded so it is never inserted into a new service route.
export const ROUTE_STAGES = ["WASH", "DRYCLEAN", "IRON", "FOLD", "CLEAN"] as const

// Shared operational stages injected by the engine so every service follows the
// same lifecycle: Dry & Quality Check (after cleaning), Sorting (the garment→bag
// transition point), and the Transit terminal. Sorting is ALWAYS the bag-assignment
// point — the workflow engine never hardcodes department transitions.
export const ROUTE_TERMINALS = ["QC", "SORTING", "DISPATCHED"] as const

const VALID_STAGES = new Set<string>([
  ...ROUTE_STAGES, ...ROUTE_TERMINALS, "DRY", "PACKED", "RECEIVED",
])

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

// Normalise a stored snapshot, preserving the author's stage ORDER — an in-flight
// garment's route is NEVER rewritten, so its remaining journey is unchanged
// (a legacy route keeps DRY / QC / PACKED exactly where they are; a canonical
// route keeps QC → SORTING → finishing → DISPATCHED). Invalid/duplicated codes
// are dropped and exactly one terminal (PACKED or DISPATCHED) is kept, always
// last.
export function normalizeFlow(stages: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  let terminal: string | null = null
  for (const s of stages) {
    if (s === "STEAM" || !VALID_STAGES.has(s)) continue
    if (s === "PACKED" || s === "DISPATCHED") { terminal = s; continue }
    if (seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  out.push(terminal ?? TERMINAL_STAGE)
  return out
}

// Stage codes a write request may legitimately contain: the configurable
// working stages plus the shared terminals (Dry & Quality Check / Sorting) and
// the legacy PACKED terminal tolerated on re-save. RECEIVED / SORTING input is
// never configurable; SORTING is engine-injected.
const CONFIGURABLE_INPUT = new Set<string>([...ROUTE_STAGES, "DRY", "QC", "SORTING", "PACKED", "DISPATCHED"])

export type ProcessFlowValidation =
  | { ok: true; flow: string[] | null }
  | { ok: false; code: "INVALID_PROCESS_FLOW"; error: string }

// CANONICAL processing-route validator — the SINGLE source of truth for what a
// LaundryService.processFlow may contain. Every API that writes processFlow
// (service create, service update, any future writer) MUST route through this.
//
// Contract: the caller supplies ONLY the CONFIGURABLE working stages
// (Wash / Dry Clean / Iron / Fold / Cleaning). The shared operational stages are
// INJECTED here — the client never manages them:
//   cleaning stages (author order) → "QC" (Dry & Quality Check) → "SORTING"
//   (garment→bag transition) → finishing stages (author order, Iron / Fold) →
//   "DISPATCHED" (Transit terminal).
// A well-formed legacy trailing "QC","PACKED" (or any QC/SORTING/PACKED/DISPATCHED
// placement) is tolerated (idempotent re-save) but is never required. null / []
// clears the route (engine falls back to the legacy name heuristic). Anything
// else is REJECTED with INVALID_PROCESS_FLOW — the route is never silently
// rewritten into something the operator did not choose.
//
// The user CANNOT insert Packing or Sorting between departments: Packing exists
// only as the Store "Packing & QR" logistics stage, and Sorting / Dry & Quality
// Check are always positioned by the engine.
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
  // Shared/terminal stages are engine-managed — strip them and rebuild canonical.
  const working = raw.filter((s) => !["QC", "SORTING", "PACKED", "DISPATCHED"].includes(s))
  if (working.length === 0) return { ok: false, code: "INVALID_PROCESS_FLOW", error: "A service must have at least one processing stage before Dry & Quality Check and Sorting." }
  const seen = new Set<string>()
  for (const s of working) {
    if (seen.has(s)) return { ok: false, code: "INVALID_PROCESS_FLOW", error: `Duplicate stage "${label(s)}" — each processing stage may appear only once.` }
    seen.add(s)
  }
  const cleaning = working.filter((s) => !(FINISHING_STAGES as readonly string[]).includes(s))
  const finishing = working.filter((s) => (FINISHING_STAGES as readonly string[]).includes(s))
  return { ok: true, flow: [...cleaning, "QC", "SORTING", ...finishing, TERMINAL_STAGE] }
}

// Legacy heuristic — fallback ONLY when no configured route exists (no service
// processFlow and no item snapshot). Follows the approved model: cleaning →
// Dry & Quality Check → Sorting → finishing (Iron/Fold, if the service needs it)
// → Transit. STEAM is not part of the active workflow, so a "steam iron" service
// routes as ironing.
export function getFlow(serviceName: string | null | undefined): string[] {
  const s = (serviceName || "").toLowerCase()
  const dryClean = ["DRYCLEAN"]
  const wash = ["WASH"]
  const qc = ["QC", "SORTING"]
  // Dry Cleaning must pass through Dry & Quality Check + Sorting before Finishing.
  if (s.includes("dry clean")) {
    if (s.includes("iron") && s.includes("fold")) return [...dryClean, ...qc, "IRON", "FOLD", TERMINAL_STAGE]
    if (s.includes("iron")) return [...dryClean, ...qc, "IRON", TERMINAL_STAGE]
    if (s.includes("fold")) return [...dryClean, ...qc, "FOLD", TERMINAL_STAGE]
    return [...dryClean, ...qc, TERMINAL_STAGE]
  }
  if (s.includes("shoe")) return ["CLEAN", ...qc, TERMINAL_STAGE]
  if (s.includes("iron") && !s.includes("wash") && !s.includes("fold")) return [...qc, "IRON", TERMINAL_STAGE]
  if (s.includes("fold") && !s.includes("wash") && !s.includes("iron")) return [...qc, "FOLD", TERMINAL_STAGE]
  if (s.includes("wash") && s.includes("iron") && s.includes("fold")) return [...wash, ...qc, "IRON", "FOLD", TERMINAL_STAGE]
  if (s.includes("wash") && s.includes("iron")) return [...wash, ...qc, "IRON", TERMINAL_STAGE]
  if (s.includes("wash") && s.includes("fold")) return [...wash, ...qc, "FOLD", TERMINAL_STAGE]
  if (s.includes("wash")) return [...wash, ...qc, TERMINAL_STAGE]
  if (s.includes("curtain") || s.includes("blanket")) return [...wash, ...qc, "FOLD", TERMINAL_STAGE]
  if (s.includes("iron")) return [...qc, "IRON", TERMINAL_STAGE]
  if (s.includes("fold")) return [...qc, "FOLD", TERMINAL_STAGE]
  return [...wash, ...qc, TERMINAL_STAGE]
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
// Dry & Quality Check in the garment's own route. A QC failure sends the garment
// back to be cleaned/dried — never forward to Sorting or a finishing stage
// (finishing runs after Sorting and only once a garment has been approved).
export function reworkStagesOf(flow: string[]): string[] {
  const idx = flow.indexOf("QC")
  const before = idx >= 0 ? flow.slice(0, idx) : flow
  return before.filter((s) => !["QC", "SORTING", "DISPATCHED", "PACKED"].includes(s))
}

export const departmentFor = (stage: string | null | undefined) => (stage ? DEPARTMENT[stage] || stage : "")
export const stageLabel = (stage: string | null | undefined) => (stage ? STAGE_LABELS[stage] || stage : "—")
