// ============================================================================
// Laundry Order STATE INTEGRITY — the server-side guard that sits between every
// status write and the database.
//
// laundry-workflow.ts answers "is there an EDGE from A to B?". That is necessary
// but not sufficient: an edge says the workflow allows the move, it does not say
// the physical work behind the move actually happened. This module answers the
// second question — "does the order's own evidence support being in that stage?"
// — and is what makes an invalid state unreachable rather than merely un-clicked.
//
// Why this exists (the defect it closes):
//   The Pay Later decision advanced an order along whatever `primary` edge its
//   current stage offered, INCLUDING the `internal` edges that stand for physical
//   custody events (pickup completed, packed, dispatched, received at the
//   Processing Centre, dispatched back, received at the store) and, at
//   READY_FOR_DELIVERY, MARK_DELIVERED. Repeating the decision walked an order
//   the whole way to DELIVERED with no garments, no processing, no delivery and
//   no deliveredAt — the parent status said "Delivered" while the pickup leg was
//   still "Accepted" and the delivery leg still "Awaiting Assignment".
//
// The invariants, in business terms:
//   • Garments must be identified and inspected before an order can be paid for,
//     packed, processed, made ready, or delivered.
//   • Processing must actually have happened before an order is ready or
//     delivered — it can never be skipped.
//   • DELIVERED is reachable ONLY from READY_FOR_DELIVERY and ONLY through the
//     delivery engine, which stamps the completion in the same write. The mere
//     existence, assignment, acceptance, start or transit of a delivery can
//     never move the parent order to DELIVERED.
//   • Pickup is untouched. Nothing here gates assigning, accepting, starting or
//     completing a pickup — those legs stay independently operable, and pickup
//     completion moves the order to IN_TRANSIT_TO_STORE, never further.
// ============================================================================
import { prisma } from "@/lib/prisma"
import { getTransition, statusLabel, type LaundryOrderStatus } from "@/lib/laundry-workflow"
import { isProcessingTerminal } from "@/lib/laundry-processing"

// The lifecycle in workflow order. Used to walk an order BACK to the furthest
// stage its evidence supports when reconciling a corrupted row.
export const WORKFLOW_ORDER: LaundryOrderStatus[] = [
  "DRAFT",
  "AWAITING_PICKUP_ASSIGNMENT",
  "IN_TRANSIT_TO_STORE",
  "PENDING_STORE_AUDIT",
  "UNDER_AUDIT",
  "PAYMENT_PENDING",
  "READY_FOR_PROCESSING",
  "PACKED",
  "IN_TRANSIT_TO_PROCESSING",
  "PROCESSING",
  "QC_PENDING",
  "RETURN_IN_TRANSIT",
  "READY_FOR_DELIVERY",
  "DELIVERED",
]

// Stages an order can only occupy once every garment has been identified AND
// inspected at Store Audit. Everything at Payment Collection and beyond.
// PENDING_STORE_AUDIT / UNDER_AUDIT are deliberately absent — that IS where the
// garments get identified — and so is the whole pickup leg.
export const REQUIRES_IDENTIFIED_GARMENTS = new Set<string>([
  "PAYMENT_PENDING",
  "READY_FOR_PROCESSING",
  "PACKED",
  "IN_TRANSIT_TO_PROCESSING",
  "PROCESSING",
  "QC_PENDING",
  "RETURN_IN_TRANSIT",
  "READY_FOR_DELIVERY",
  "DELIVERED",
])

// Stages that mean "processing is finished". An order cannot be ready for
// delivery — let alone delivered — until the garments have actually been
// through the Processing Centre.
export const REQUIRES_PROCESSING_COMPLETE = new Set<string>([
  "READY_FOR_DELIVERY",
  "DELIVERED",
])

// Timeline actions that PROVE the order genuinely went through processing.
// Item-level stamps are the primary proof; these events cover orders processed
// before per-garment stage tracking existed, so a legitimate historical order is
// never re-opened by the invariant. PAY_LATER is deliberately NOT proof of
// anything physical.
export const PROCESSING_PROOF_ACTIONS = ["ALL_ITEMS_COMPLETE", "QC_PASS", "RECEIVE_AT_STORE"]

// The order was physically received at the store — proof the pickup leg ended.
export const STORE_RECEIPT_PROOF_ACTIONS = ["RECEIVE_PICKUP_AT_STORE", "RECEIVE_EXCEPTION"]

export interface OrderStateEvidence {
  id: string
  orderNumber: string
  businessId: string
  status: string
  itemCount: number
  inspectedCount: number
  processedCount: number
  /** A PROCESSING_PROOF_ACTIONS event exists on the timeline. */
  hasProcessingEvent: boolean
  /** A STORE_RECEIPT_PROOF_ACTIONS event exists on the timeline. */
  hasStoreReceiptEvent: boolean
  pickupRequired: boolean
  pickupCompletedAt: Date | null
  deliveryRequired: boolean
  deliveredAt: Date | null
  deliveryCompletedAt: Date | null
}

export type StateVerdict = { ok: true } | { ok: false; code: string; error: string }

const OK: StateVerdict = { ok: true }

/** Every garment identified at Store Audit and inspected. */
export function garmentsIdentified(ev: OrderStateEvidence): boolean {
  return ev.itemCount > 0 && ev.inspectedCount >= ev.itemCount
}

/**
 * Processing genuinely finished. Item stamps are the real proof; a historical
 * proof event stands in for orders that predate per-garment stage tracking.
 */
export function processingComplete(ev: OrderStateEvidence): boolean {
  if (ev.itemCount > 0 && ev.processedCount >= ev.itemCount) return true
  return ev.hasProcessingEvent
}

/** A delivery actually happened — a completion stamp, not an assignment. */
export function deliveryCompleted(ev: OrderStateEvidence): boolean {
  return !!ev.deliveredAt || !!ev.deliveryCompletedAt
}

/**
 * Can the order legitimately OCCUPY `status`, given its own evidence?
 *
 * `deliveryCompletion` is how the delivery engine proves it is stamping the
 * completion in the very same write. Every other caller leaves it false, which
 * is precisely what makes DELIVERED unreachable from anywhere else — a delivery
 * that is merely scheduled, assigned, accepted, started or in transit carries no
 * completion, so it can never move the parent order.
 */
export function checkStateInvariants(
  status: string,
  ev: OrderStateEvidence,
  opts: { deliveryCompletion?: boolean } = {},
): StateVerdict {
  if (REQUIRES_IDENTIFIED_GARMENTS.has(status) && !garmentsIdentified(ev)) {
    return {
      ok: false,
      code: "GARMENTS_NOT_IDENTIFIED",
      error:
        ev.itemCount === 0
          ? `No garments have been identified for this order — it cannot move to ${statusLabel(status)}. Complete Store Audit first.`
          : `${ev.itemCount - ev.inspectedCount} garment(s) have not been inspected — the order cannot move to ${statusLabel(status)}.`,
    }
  }

  if (REQUIRES_PROCESSING_COMPLETE.has(status) && !processingComplete(ev)) {
    return {
      ok: false,
      code: "PROCESSING_NOT_COMPLETE",
      error: `The garments have not completed processing — the order cannot move to ${statusLabel(status)}. Processing cannot be skipped.`,
    }
  }

  if (status === "DELIVERED" && !opts.deliveryCompletion && !deliveryCompleted(ev)) {
    return {
      ok: false,
      code: "DELIVERY_NOT_COMPLETED",
      error:
        "An order becomes Delivered only when the delivery itself is completed and confirmed. Complete the delivery from Ready for Delivery or the executive app.",
    }
  }

  return OK
}

/**
 * The full gate for a status WRITE: the edge must exist, `internal` edges belong
 * to their own operational endpoint, and the destination's invariants must hold.
 *
 * `allowInternal` is granted only by the endpoint that performs the physical
 * action the edge stands for. A financial decision, a bulk tool or the generic
 * transition API never gets it — which is what stops a non-physical action from
 * fabricating custody.
 */
export function assertTransition(
  from: string,
  to: string,
  ev: OrderStateEvidence,
  opts: { allowInternal?: boolean; deliveryCompletion?: boolean } = {},
): StateVerdict {
  if (from === to) return { ok: false, code: "NO_CHANGE", error: `Order is already ${statusLabel(to)}` }

  const edge = getTransition(from, to)
  if (!edge) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      error: `Invalid transition: ${statusLabel(from)} → ${statusLabel(to)}`,
    }
  }
  if (edge.internal && !opts.allowInternal) {
    return {
      ok: false,
      code: "INTERNAL_TRANSITION",
      error: `"${edge.label}" records operational data — it must be performed from its own workflow screen, not as a side effect.`,
    }
  }
  return checkStateInvariants(to, ev, opts)
}

// ── Evidence loading ────────────────────────────────────────────────────────

/**
 * Read everything the invariants need in ONE query. `businessId` scopes the read
 * to the tenant when the caller has already resolved it.
 */
export async function loadOrderEvidence(
  orderId: string,
  businessId?: string,
): Promise<OrderStateEvidence | null> {
  const order = await prisma.laundryOrder.findFirst({
    where: { id: orderId, ...(businessId ? { businessId } : {}) },
    select: {
      id: true,
      orderNumber: true,
      businessId: true,
      status: true,
      pickupRequired: true,
      pickupCompletedAt: true,
      deliveryRequired: true,
      deliveredAt: true,
      deliveryCompletedAt: true,
      items: { select: { inspectedAt: true, processingStage: true, processingStatus: true } },
    },
  })
  if (!order) return null

  const proofActions = [...PROCESSING_PROOF_ACTIONS, ...STORE_RECEIPT_PROOF_ACTIONS]
  const proof = await prisma.laundryOrderEvent
    .findMany({
      where: { orderId: order.id, action: { in: proofActions } },
      select: { action: true },
    })
    .catch(() => [] as { action: string }[])
  const seen = new Set(proof.map((p) => p.action))

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    businessId: order.businessId,
    status: order.status as string,
    itemCount: order.items.length,
    inspectedCount: order.items.filter((i) => i.inspectedAt != null).length,
    processedCount: order.items.filter(
      (i) => isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE",
    ).length,
    hasProcessingEvent: PROCESSING_PROOF_ACTIONS.some((a) => seen.has(a)),
    hasStoreReceiptEvent: STORE_RECEIPT_PROOF_ACTIONS.some((a) => seen.has(a)),
    pickupRequired: order.pickupRequired,
    pickupCompletedAt: order.pickupCompletedAt,
    deliveryRequired: order.deliveryRequired,
    deliveredAt: order.deliveredAt,
    deliveryCompletedAt: order.deliveryCompletedAt,
  }
}

/**
 * THE guard every status-advancing endpoint calls immediately before its write.
 * Loads the evidence and applies the full gate. Endpoints keep their own
 * operational logic (bag scans, packets, payments); this only decides whether
 * the destination stage is legitimate at all.
 */
export async function guardStatusWrite(opts: {
  orderId: string
  businessId?: string
  from: string
  to: string
  allowInternal?: boolean
  deliveryCompletion?: boolean
}): Promise<StateVerdict> {
  const ev = await loadOrderEvidence(opts.orderId, opts.businessId)
  if (!ev) return { ok: false, code: "NOT_FOUND", error: "Order not found" }
  return assertTransition(opts.from, opts.to, ev, {
    allowInternal: opts.allowInternal,
    deliveryCompletion: opts.deliveryCompletion,
  })
}

// ── Reconciliation of already-corrupted rows ────────────────────────────────

// Where a reconciliation is allowed to LAND.
//
// A repair may only park an order in a queue that staff actually work, and it
// must never assert custody it cannot prove. The in-flight processing stages
// (PACKED, IN_TRANSIT_TO_PROCESSING, PROCESSING, QC_PENDING, RETURN_IN_TRANSIT)
// each claim the garments are physically at or travelling to/from the Processing
// Centre — a claim no repair can make on the order's behalf. UNDER_AUDIT is a
// manual hold, and DRAFT is pre-submission. So a broken row lands either back on
// the pickup board, at Store Audit, at Payment, in the Packing & QR queue, or —
// when the garments demonstrably finished processing and only the delivery is
// missing — at Ready for Delivery, whose own invariant already requires that
// proof.
export const RECONCILE_TARGETS = new Set<string>([
  "AWAITING_PICKUP_ASSIGNMENT",
  "IN_TRANSIT_TO_STORE",
  "PENDING_STORE_AUDIT",
  "PAYMENT_PENDING",
  "READY_FOR_PROCESSING",
  "READY_FOR_DELIVERY",
])

export interface Reconciliation {
  from: string
  to: string
  reason: string
}

/**
 * The furthest stage the order's OWN evidence supports — the honest status.
 *
 * Walks back down the lifecycle from the current status until the invariants
 * hold. A valid order returns its current status unchanged (so historical and
 * in-flight orders are never touched); only a row that cannot justify where it
 * sits moves, and it moves BACK to real work, never forward.
 */
export function reconcileStatus(ev: OrderStateEvidence): Reconciliation | null {
  // Terminal-by-choice states carry no workflow claim.
  if (ev.status === "CANCELLED" || ev.status === "DRAFT") return null

  const idx = WORKFLOW_ORDER.indexOf(ev.status as LaundryOrderStatus)
  if (idx < 0) return null
  if (checkStateInvariants(ev.status, ev).ok) return null

  let target: LaundryOrderStatus = "PENDING_STORE_AUDIT"
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = WORKFLOW_ORDER[i]
    if (!RECONCILE_TARGETS.has(candidate)) continue
    if (checkStateInvariants(candidate, ev).ok) {
      target = candidate
      break
    }
  }

  // The pickup leg owns the stages before Store Audit: an order whose garments
  // never reached the counter belongs back on the pickup board, not in the audit
  // queue. Rule: pickup stays independently operable, so the reconciliation puts
  // the order exactly where the pickup evidence says it is.
  if (WORKFLOW_ORDER.indexOf(target) <= WORKFLOW_ORDER.indexOf("PENDING_STORE_AUDIT")) {
    if (ev.pickupRequired && !ev.hasStoreReceiptEvent) {
      target = ev.pickupCompletedAt ? "IN_TRANSIT_TO_STORE" : "AWAITING_PICKUP_ASSIGNMENT"
    }
  }

  if (target === ev.status) return null

  const why = checkStateInvariants(ev.status, ev)
  return {
    from: ev.status,
    to: target,
    reason: why.ok ? "state not supported by workflow evidence" : `${why.code}: ${why.error}`,
  }
}
