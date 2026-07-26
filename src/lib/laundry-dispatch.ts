// ============================================================================
// Dispatch derivation — SINGLE SOURCE OF TRUTH for the pickup/delivery queue.
//
// Every module that shows a pickup/delivery job (Dispatch Center, Store Receive
// queue, dashboard KPIs, the executive task list) must derive its display from
// LaundryOrder.status via the helpers here — never from a private copy of the
// bucketing rules and never from a side field like pickupCompletedAt alone.
//
// The chain of custody for a pickup is status-driven:
//   AWAITING_PICKUP_ASSIGNMENT  → in the pickup queue (unassigned/assigned/accepted/picked-up)
//   IN_TRANSIT_TO_STORE         → still in the queue, "pending store receipt"
//   PENDING_STORE_AUDIT (+)     → LEAVES the pickup queue (the store now owns it)
//
// Keeping this in one place is what prevents the "Orders says Awaiting, Assign
// Bags says Pickup Complete, Dispatch shows nothing" desync class of bug.
// ============================================================================
import { LaundryOrderStatus } from "@prisma/client"

// The order statuses that keep a pickup visible in the Dispatch queue. An order
// enters at AWAITING_PICKUP_ASSIGNMENT and stays until the STORE receives it
// (status advances to PENDING_STORE_AUDIT), at which point it leaves the queue.
export const PICKUP_QUEUE_STATUSES: LaundryOrderStatus[] = [
  LaundryOrderStatus.AWAITING_PICKUP_ASSIGNMENT,
  LaundryOrderStatus.IN_TRANSIT_TO_STORE,
]

export type DispatchOrderView = {
  status: string
  pickupCompletedAt: Date | null
  deliveryCompletedAt: Date | null
  pickupExecutiveId: string | null
  deliveryExecutiveId: string | null
  pickupAcceptedAt: Date | null
  deliveryAcceptedAt: Date | null
}

// Dispatch bucket for a job — derived from order status first.
export function dispatchBucketOf(o: DispatchOrderView, type: "pickup" | "delivery"): string {
  if (o.status === "CANCELLED") return "cancelled"
  if (type === "delivery") {
    if (o.deliveryCompletedAt || o.status === "DELIVERED") return "completed"
    if (o.deliveryExecutiveId) return o.deliveryAcceptedAt ? "accepted" : "assigned"
    return "awaiting"
  }
  // Pickup lifecycle:
  //  • IN_TRANSIT_TO_STORE  → picked up, awaiting store receipt (pending_receipt)
  //  • AWAITING (in queue)  → awaiting / assigned / accepted (or legacy pending_receipt)
  //  • past the queue (received at store, processing, …) → the pickup itself is done
  if (o.status === "IN_TRANSIT_TO_STORE") return "pending_receipt"
  if (o.status === "AWAITING_PICKUP_ASSIGNMENT") {
    if (o.pickupCompletedAt) return "pending_receipt" // legacy: completed but not advanced
    if (o.pickupExecutiveId) return o.pickupAcceptedAt ? "accepted" : "assigned"
    return "awaiting"
  }
  return "completed"
}
