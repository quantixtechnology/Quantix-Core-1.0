// ============================================================================
// OPERATIONAL STAGE — the queue an order is actually sitting in, waiting for
// someone to act on it.
//
// LaundryOrder.status alone cannot answer that. "PROCESSING" is true of a
// garment being washed, one at Quality Check and one waiting for a barcode, and
// it tells the operator nothing about where to go. The queue lives in the
// garments' processingStage once an order reaches the Processing Centre, and in
// the order status everywhere else.
//
// THIS FILE INVENTS NOTHING. Every name and every rule is taken from the code
// that already owns it:
//
//   • store-side queue names  → STORE_COUNTER_QUEUES (laundry-workflow.ts)
//   • processing queue names  → the Processing Center nav (laundry-nav-config)
//                               and DEPARTMENT (laundry-processing.ts)
//   • Barcode Generation      → processingStage "RECEIVED", which is exactly
//                               what /api/laundry/processing selects on and
//                               what the receive endpoint stamps
//                               (processingDept = "Barcode Generation")
//   • multi-garment rule      → the Processing dashboard's own words:
//                               "The EARLIEST stage still present is where the
//                               order really is — an order is only as far along
//                               as its slowest garment."
//
// It is READ-ONLY: a pure derivation with no writes, no transitions and no
// custody implications. Filtering by a stage never moves an order.
// ============================================================================
import { STORE_COUNTER_QUEUES, statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"

export interface OperationalQueue {
  /** Stable filter value. Never a raw status — a status is not a queue. */
  key: string
  /** What staff call it, matching the screen they would open. */
  label: string
  /** Set when the queue is decided by the order's own status. */
  status?: string
  /** Set when the queue is decided by the garments' processingStage. */
  stage?: string
}

/**
 * The garment queues INSIDE the Processing Centre, in flow order.
 *
 * The order matters: it is the precedence used to resolve an order whose
 * garments sit in different queues. Earliest first.
 */
export const PROCESSING_QUEUES: OperationalQueue[] = [
  { key: "PC_BARCODE",  stage: "RECEIVED",   label: "Barcode Generation" },
  { key: "PC_WASH",     stage: "WASH",       label: "Washing" },
  { key: "PC_DRYCLEAN", stage: "DRYCLEAN",   label: "Dry Cleaning" },
  { key: "PC_DRY",      stage: "DRY",        label: "Dry & Quality Check" },
  { key: "PC_QC",       stage: "QC",         label: "Dry & Quality Check" },
  { key: "PC_SORTING",  stage: "SORTING",    label: "Sorting" },
  { key: "PC_IRON",     stage: "IRON",       label: "Ironing" },
  { key: "PC_FOLD",     stage: "FOLD",       label: "Folding" },
  { key: "PC_TRANSIT",  stage: "DISPATCHED", label: "Transit" },
]

/** The queues decided by the order's status, in workflow order. */
export const STATUS_QUEUES: OperationalQueue[] = [
  { key: "DRAFT",              status: "DRAFT",                      label: "Draft" },
  { key: "PICKUP_SCHEDULING",  status: "AWAITING_PICKUP_ASSIGNMENT",  label: "Pickup Scheduling" },
  { key: "PICKUP_TRANSIT",     status: "IN_TRANSIT_TO_STORE",         label: "Pickup In Transit" },
  // Titles come from STORE_COUNTER_QUEUES so the queue and its screen agree.
  { key: "STORE_AUDIT",        status: "PENDING_STORE_AUDIT",         label: storeTitle("PENDING_STORE_AUDIT", "Store Audit") },
  { key: "STORE_AUDIT_HOLD",   status: "UNDER_AUDIT",                 label: "Store Audit (On Hold)" },
  { key: "PAYMENT",            status: "PAYMENT_PENDING",             label: storeTitle("PAYMENT_PENDING", "Payment Collection") },
  { key: "PACKING_QR",         status: "READY_FOR_PROCESSING",        label: storeTitle("READY_FOR_PROCESSING", "Packing & QR") },
  { key: "TRANSIT_TO_PC",      status: "PACKED",                      label: storeTitle("PACKED", "Transit to Processing") },
  { key: "CONSOLE_RECEIVE",    status: "IN_TRANSIT_TO_PROCESSING",    label: "Console & Receive" },
  { key: "STORE_RECEIVE",      status: "RETURN_IN_TRANSIT",           label: storeTitle("RETURN_IN_TRANSIT", "Store Receive") },
  { key: "READY_DELIVERY",     status: "READY_FOR_DELIVERY",          label: storeTitle("READY_FOR_DELIVERY", "Ready for Delivery") },
  { key: "DELIVERED",          status: "DELIVERED",                   label: "Delivered" },
  { key: "CANCELLED",          status: "CANCELLED",                   label: "Cancelled" },
]

function storeTitle(status: string, fallback: string): string {
  return STORE_COUNTER_QUEUES.find((q) => q.status === status)?.title ?? fallback
}

/**
 * An order at the Processing Centre whose garments carry no stage at all.
 *
 * Labelled so it can never be mistaken for a real queue, and reached ONLY when
 * no more specific stage exists.
 */
export const UNASSIGNED: OperationalQueue = { key: "PC_UNASSIGNED", label: "In Processing (no queue yet)" }

/** Every option the dropdown offers, in the order staff work them. */
export function operationalQueues(): OperationalQueue[] {
  const seen = new Set<string>()
  const ordered: OperationalQueue[] = []
  const push = (q: OperationalQueue) => {
    // DRY and QC share one screen and one label — offer it once.
    if (seen.has(q.label)) return
    seen.add(q.label)
    ordered.push(q)
  }
  for (const k of ["DRAFT", "PICKUP_SCHEDULING", "PICKUP_TRANSIT", "STORE_AUDIT", "STORE_AUDIT_HOLD", "PAYMENT", "PACKING_QR", "TRANSIT_TO_PC", "CONSOLE_RECEIVE"]) {
    const q = STATUS_QUEUES.find((s) => s.key === k)
    if (q) push(q)
  }
  PROCESSING_QUEUES.forEach(push)
  push(UNASSIGNED)
  for (const k of ["STORE_RECEIVE", "READY_DELIVERY", "DELIVERED", "CANCELLED"]) {
    const q = STATUS_QUEUES.find((s) => s.key === k)
    if (q) push(q)
  }
  return ordered
}

export interface OperationalStageInput {
  status: string
  /** Every garment's processingStage. Order is irrelevant — the rule is a scan. */
  itemStages?: (string | null | undefined)[]
}

/**
 * THE mapping. One function behind the row label, the dropdown and the filter,
 * so a queue can never mean one thing in the table and another in the filter.
 */
export function operationalStage(order: OperationalStageInput): OperationalQueue {
  const status = String(order?.status || "")

  // Inside the Processing Centre the GARMENTS decide, not the status.
  if (status === "PROCESSING" || status === "QC_PENDING") {
    const stages = new Set((order.itemStages || []).filter(Boolean) as string[])
    // Earliest stage still present — an order is only as far along as its
    // slowest garment.
    const found = PROCESSING_QUEUES.find((q) => q.stage && stages.has(q.stage))
    if (found) return found
    // QC_PENDING is a legacy status that names its own queue.
    if (status === "QC_PENDING") return PROCESSING_QUEUES.find((q) => q.key === "PC_QC")!
    return UNASSIGNED
  }

  // An order can carry RECEIVED garments while its status still says it is
  // travelling — Barcode Generation is genuinely where the work is.
  if (status === "IN_TRANSIT_TO_PROCESSING") {
    const stages = new Set((order.itemStages || []).filter(Boolean) as string[])
    if (stages.has("RECEIVED")) return PROCESSING_QUEUES[0]
  }

  const byStatus = STATUS_QUEUES.find((q) => q.status === status)
  if (byStatus) return byStatus
  // An unknown status still reads as something, using the workflow's own label.
  return { key: `STATUS_${status}`, status, label: statusLabel(status as LaundryOrderStatus) }
}

/** The row's displayed stage. Same rule as the filter, by construction. */
export const operationalStageLabel = (order: OperationalStageInput): string => operationalStage(order).label

/**
 * The stages that come BEFORE `stage` in the processing flow.
 *
 * The server filter needs this to honour "earliest wins": an order is in queue
 * X only when it has a garment at X and NONE at any earlier stage. Without it,
 * an order with one shirt at Washing and one at Folding would answer to both.
 */
export function stagesBefore(stage: string): string[] {
  const i = PROCESSING_QUEUES.findIndex((q) => q.stage === stage)
  return i <= 0 ? [] : PROCESSING_QUEUES.slice(0, i).map((q) => q.stage!).filter(Boolean)
}

/** Every processing stage a queue key covers (DRY and QC share one screen). */
export function stagesForKey(key: string): string[] {
  const q = PROCESSING_QUEUES.find((x) => x.key === key)
  if (!q?.stage) return []
  const sameLabel = PROCESSING_QUEUES.filter((x) => x.label === q.label && x.stage)
  return sameLabel.map((x) => x.stage!)
}
