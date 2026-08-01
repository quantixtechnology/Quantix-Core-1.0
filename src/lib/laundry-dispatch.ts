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

// ============================================================================
// Dispatch board date ranges + WHERE construction.
//
// The live Dispatch board historically showed only TODAY's work (completed jobs
// matched against the current day). The board now supports Today / Yesterday /
// Last 7 Days / Upcoming / Custom ranges so supervisors can review previous and
// future field work without touching assignment/dispatch/completion logic.
//
// Semantics per range:
//   • pending jobs (awaiting/assigned/accepted/pending-receipt) match their
//     SCHEDULED date (pickupDate / deliveryDate|expectedDeliveryDate)
//   • completed jobs match their COMPLETION time (pickupCompletedAt /
//     deliveryCompletedAt)
//   • "today" (the default) preserves the EXACT legacy query — live jobs of any
//     date + today's completions — so the Today board is unchanged.
// ============================================================================

export type DispatchDateRange = { start: Date; end: Date | null }

/** [midnight, next midnight) for a given date — the legacy "a day" window. */
export function dayRange(d: Date): DispatchDateRange {
  const s = new Date(d); s.setHours(0, 0, 0, 0)
  const e = new Date(s); e.setDate(e.getDate() + 1)
  return { start: s, end: e }
}

/** Resolve a date preset + custom window to a { start, end } range (end null = open-ended). */
export function dispatchDateRangeForPreset(
  preset: string,
  now: Date,
  fromDate?: string,
  toDate?: string,
): DispatchDateRange {
  if (preset === "custom" && fromDate && toDate) {
    const s = new Date(fromDate); s.setHours(0, 0, 0, 0)
    const e = new Date(toDate); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  if (preset === "yesterday") {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return dayRange(d)
  }
  if (preset === "last7d") {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0)
    return { start: s, end: now }
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: s, end: now }
  }
  if (preset === "upcoming") {
    // Everything scheduled from tomorrow midnight onwards — open-ended.
    const s = new Date(now); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + 1)
    return { start: s, end: null }
  }
  // default: today
  return dayRange(now)
}

const dateFilter = (r: DispatchDateRange) => (r.end ? { gte: r.start, lt: r.end } : { gte: r.start })

export interface DispatchQueueWhereOptions {
  /** LaundryBusiness id used in the query. */
  businessId: string
  type: "pickup" | "delivery"
  /** today | yesterday | last7d | thisMonth | upcoming | custom (default today). */
  preset?: string
  fromDate?: string
  toDate?: string
  now?: Date
  /** Optional store isolation (Store Admin PWA). */
  storeScope?: Record<string, unknown>
}

/**
 * WHERE clause for the LIVE Dispatch board (active scope).
 * "today" reproduces the legacy query exactly; every other preset filters
 * pending jobs by their scheduled date and completed jobs by completion time.
 */
export function buildDispatchQueueWhere(o: DispatchQueueWhereOptions): Record<string, unknown> {
  const now = o.now || new Date()
  const range = dispatchDateRangeForPreset(o.preset || "today", now, o.fromDate, o.toDate)
  const store = o.storeScope || {}
  const isToday = !o.preset || o.preset === "today"

  if (o.type === "delivery") {
    if (isToday) {
      return {
        businessId: o.businessId, ...store, deliveryRequired: true,
        OR: [
          { deliveryCompletedAt: null, status: LaundryOrderStatus.READY_FOR_DELIVERY },
          { deliveryCompletedAt: { gte: range.start, lt: range.end as Date } },
        ],
      }
    }
    return {
      businessId: o.businessId, ...store, deliveryRequired: true,
      OR: [
        {
          deliveryCompletedAt: null,
          status: LaundryOrderStatus.READY_FOR_DELIVERY,
          OR: [
            { deliveryDate: dateFilter(range) },
            { deliveryDate: null, expectedDeliveryDate: dateFilter(range) },
          ],
        },
        { deliveryCompletedAt: dateFilter(range) },
      ],
    }
  }

  if (isToday) {
    return {
      businessId: o.businessId, ...store, pickupRequired: true,
      OR: [
        { status: { in: PICKUP_QUEUE_STATUSES } },
        { pickupCompletedAt: { gte: range.start, lt: range.end as Date } },
      ],
    }
  }
  return {
    businessId: o.businessId, ...store, pickupRequired: true,
    OR: [
      { status: { in: PICKUP_QUEUE_STATUSES }, pickupDate: dateFilter(range) },
      { pickupCompletedAt: dateFilter(range) },
    ],
  }
}
