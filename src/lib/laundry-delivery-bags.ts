// Delivery over the order's FINAL bag set.
//
// An order may have been packed into several bags (Sorting sets the plan,
// Packing may add to it), and the customer receives ALL of them. Delivery
// therefore reads the same authority every other stage reads —
// LaundryBagAssignment, via orderBags() — and requires every bag to be
// confirmed before the handover is complete.
//
// NO SCHEMA CHANGE. Per-bag confirmation is an APPEND-ONLY event
// (LaundryBagEvent, already indexed by orderId) rather than a new column, so
// nothing existing is migrated, nothing is comma-packed into
// LaundryOrder.deliveryBagNumber, and the confirmation is part of the bag's
// permanent history rather than a status that overwrites itself.
//
// LaundryOrder.deliveryBagNumber is left alone. It stays readable for orders
// that pre-date the assignment rows (legacy compatibility) and is never written
// with more than one code.
import { prisma } from "@/lib/prisma"
import { orderBags, type OrderBag } from "@/lib/laundry-order-bags"

/** The event action that records "this bag was confirmed onto the delivery". */
export const DELIVERY_BAG_CONFIRMED = "DELIVERY_BAG_CONFIRMED"

export interface DeliveryBag extends OrderBag {
  confirmed: boolean
  confirmedAt: Date | null
}

export interface DeliveryBagsView {
  bags: DeliveryBag[]
  total: number
  confirmed: number
  /** Every bag accounted for — the bag half of the completion gate. */
  complete: boolean
  /** Operator-facing while incomplete, else null. */
  message: string | null
}

/**
 * The order's bags with their delivery-confirmation state.
 *
 * An order with no bags at all is `complete` — a delivery that never had a bag
 * is a legitimate delivery, and the bag rule must not invent a blocker where
 * there is no bag to account for.
 */
export async function deliveryBags(lbId: string, orderId: string): Promise<DeliveryBagsView> {
  const bags = await orderBags(lbId, orderId)
  const events = bags.length
    ? await prisma.laundryBagEvent.findMany({
        where: { businessId: lbId, orderId, action: DELIVERY_BAG_CONFIRMED },
        select: { bagId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : []
  const firstConfirm = new Map<string, Date>()
  for (const e of events) if (!firstConfirm.has(e.bagId)) firstConfirm.set(e.bagId, e.createdAt)

  const rows: DeliveryBag[] = bags.map((b) => ({
    ...b,
    confirmed: firstConfirm.has(b.bagId),
    confirmedAt: firstConfirm.get(b.bagId) ?? null,
  }))
  const confirmed = rows.filter((r) => r.confirmed).length
  const total = rows.length
  const complete = confirmed === total // vacuously true when the order has no bags
  return {
    bags: rows,
    total,
    confirmed,
    complete,
    message: complete ? null : `${confirmed} of ${total} bags confirmed. Scan all bags before completing delivery.`,
  }
}

export type ConfirmResult =
  | { ok: true; bagNumber: string; confirmed: number; total: number; complete: boolean; alreadyConfirmed: boolean }
  | { ok: false; status: number; error: string }

/**
 * Confirm ONE scanned bag onto this order's delivery.
 *
 * Order-safe by construction: the scanned code is matched against THIS order's
 * own bag list, so a bag belonging to another order, another tenant, or to no
 * order at all simply is not found and is refused by name. Re-scanning a bag
 * already confirmed is a no-op that writes no second event.
 */
export async function confirmDeliveryBag(opts: {
  lbId: string
  orderId: string
  code: string
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}): Promise<ConfirmResult> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "Scan a bag to confirm it." }

  const view = await deliveryBags(opts.lbId, opts.orderId)
  const wanted = code.toUpperCase()
  const bag = view.bags.find((b) => b.bagNumber.toUpperCase() === wanted || b.qrValue.toUpperCase() === wanted)
  if (!bag) {
    // Named explicitly: the executive needs to know it is the wrong bag, not
    // that "something went wrong".
    return { ok: false, status: 409, error: `Bag ${code} does not belong to this order.` }
  }

  if (bag.confirmed) {
    return { ok: true, bagNumber: bag.bagNumber, confirmed: view.confirmed, total: view.total, complete: view.complete, alreadyConfirmed: true }
  }

  const order = await prisma.laundryOrder.findFirst({
    where: { id: opts.orderId, businessId: opts.lbId },
    select: { orderNumber: true, customerId: true, storeId: true },
  })
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  // Append-only: the confirmation joins the bag's history and overwrites no
  // status. The bag's actual custody moves at delivery completion, through the
  // existing applyDeliveryDisposition().
  await prisma.laundryBagEvent.create({
    data: {
      bagId: bag.bagId, bagNumber: bag.bagNumber, businessId: opts.lbId,
      action: DELIVERY_BAG_CONFIRMED,
      orderId: opts.orderId, orderNumber: order.orderNumber,
      customerId: order.customerId, storeId: order.storeId,
      actorId: opts.actor?.id ?? null, actorName: opts.actor?.name ?? null, actorRole: opts.actor?.role ?? null,
    },
  })

  const after = await deliveryBags(opts.lbId, opts.orderId)
  return { ok: true, bagNumber: bag.bagNumber, confirmed: after.confirmed, total: after.total, complete: after.complete, alreadyConfirmed: false }
}

/**
 * The bag half of the delivery completion gate.
 *
 * Returns null when delivery may proceed, or the operator-facing reason when it
 * may not. Deliberately ONLY about bags: payment, Pay Later and OTP are not
 * consulted here and their existing rules are untouched.
 */
export async function deliveryBagGate(lbId: string, orderId: string): Promise<string | null> {
  const view = await deliveryBags(lbId, orderId)
  return view.complete ? null : view.message
}
