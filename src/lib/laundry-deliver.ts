// Order DELIVERED transition ENGINE (shared). Extracted so both the Admin
// ready-for-delivery route and the Executive PWA complete a delivery through the
// EXACT same validated lifecycle step — READY_FOR_DELIVERY → DELIVERED, with the
// outstanding-balance gate, item completion and the MARK_DELIVERED timeline
// event. No parallel delivery logic. No auth here; callers gate.
import { prisma } from "@/lib/prisma"

export type DeliverResult =
  | { ok: true; orderNumber: string; deliveredAt: Date; deliveryType: string }
  | { ok: false; status: number; error: string; code?: string; balanceDue?: number }

export async function markOrderDelivered(opts: {
  lbId: string
  orderId: string
  deliveredBy?: string | null
  recipientName?: string | null
  note?: string | null
  actor?: { id?: string | null; name?: string | null }
}): Promise<DeliverResult> {
  const order = await prisma.laundryOrder.findFirst({
    where: { id: opts.orderId, businessId: opts.lbId },
    select: { id: true, orderNumber: true, status: true, orderType: true, balanceDue: true, paymentStatus: true },
  })
  if (!order) return { ok: false, status: 404, error: "Order not found" }
  if (order.status !== "READY_FOR_DELIVERY") {
    return { ok: false, status: 409, error: order.status === "DELIVERED" ? "Order already delivered" : `Order is not ready for delivery (current: ${order.status})` }
  }
  // Outstanding balance gate — collect the final payment first.
  const covered = order.paymentStatus === "PAID" || order.paymentStatus === "SUBSCRIPTION"
  if (!covered && order.balanceDue > 0) {
    return { ok: false, status: 402, code: "BALANCE_DUE", balanceDue: order.balanceDue, error: `Outstanding balance ₹${order.balanceDue.toFixed(2)} must be collected before delivery.` }
  }

  const now = new Date()
  const advanced = await prisma.laundryOrder.updateMany({
    where: { id: order.id, status: "READY_FOR_DELIVERY" },
    data: { status: "DELIVERED", deliveredAt: now, deliveredBy: opts.deliveredBy || null, recipientName: opts.recipientName || null },
  })
  if (advanced.count === 0) return { ok: false, status: 409, error: "Order already delivered" }

  await prisma.laundryOrderItem.updateMany({ where: { orderId: order.id }, data: { processingStage: "DISPATCHED", processingStatus: "DONE" } })

  const deliveryType = order.orderType === "WALK_IN" || order.orderType === "STORE_DROP" ? "Customer Pickup" : "Delivery"
  await prisma.laundryOrderEvent.create({
    data: {
      orderId: order.id, businessId: opts.lbId,
      fromStatus: "READY_FOR_DELIVERY", toStatus: "DELIVERED", action: "MARK_DELIVERED",
      actorId: opts.actor?.id || null, actorName: opts.actor?.name || null,
      note: [deliveryType, opts.recipientName ? `Received by ${opts.recipientName}` : null, opts.note || null].filter(Boolean).join(" · "),
    },
  }).catch(() => null)

  return { ok: true, orderNumber: order.orderNumber, deliveredAt: now, deliveryType }
}
