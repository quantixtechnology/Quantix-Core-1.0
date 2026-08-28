// POST /api/laundry/executive/jobs/[id]/deliver — delivery execution by the
// assigned executive.
//   { action: "out_for_delivery" | "delivered", recipientName?, method?, otp? }
// out_for_delivery → live field status + timeline + customer ping.
// delivered → SERVER-VERIFIED customer verification (OTP must match the stored
//   Delivery OTP, or Name confirmation for the configured method) THEN the
//   shared DELIVERED engine (balance gate + lifecycle), then field status +
//   customer notification. Verification can never be bypassed.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveExecutive, bearerToken } from "@/lib/laundry-executive-auth"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"
import { markOrderDelivered } from "@/lib/laundry-deliver"
import { applyDeliveryDisposition, isDisposition, isCondition, DEFAULT_DISPOSITION } from "@/lib/laundry-bag-lifecycle"
import { deliveryBagGate } from "@/lib/laundry-delivery-bags"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"
import { verifyDelivery } from "@/lib/laundry-verification"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await resolveExecutive(request)
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const b = await request.json().catch(() => ({}))

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: session.businessId }, select: { id: true, deliveryExecutiveId: true, deliveryAcceptance: true, status: true, deliveryOtp: true, deliveryVerificationMethod: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.deliveryExecutiveId !== session.executiveId) return NextResponse.json({ error: "This delivery is not assigned to you" }, { status: 403 })
    if (order.deliveryAcceptance !== "ACCEPTED") return NextResponse.json({ error: "Accept the delivery before starting" }, { status: 409 })

    const actor = { id: session.executiveId, name: b.executiveName ?? "Executive" }

    if (b.action === "out_for_delivery") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { fieldStatus: FIELD_STATUS.OUT_FOR_DELIVERY, deliveryStartedAt: new Date() } })
      await logFieldEvent({ orderId: order.id, businessId: session.businessId, action: "OUT_FOR_DELIVERY", note: "Out for delivery", actor })
      await notifyCustomerForOrder(order.id, session.businessId, { type: "DELIVERY_UPDATE", title: "Out for delivery", message: "Your order is out for delivery." })
      return NextResponse.json({ success: true })
    }

    if (b.action === "delivered") {
      // Business rule: a delivery can never complete without successful customer
      // verification (per the configured method — OTP or Name).
      // BAG GATE — before anything changes, and before verification, because a
      // successful verifyDelivery CLEARS the OTP: gating after it would burn the
      // customer's code on a delivery that then could not complete.
      const bagBlock = await deliveryBagGate(session.businessId, order.id)
      if (bagBlock) return NextResponse.json({ error: bagBlock, code: "BAGS_PENDING" }, { status: 409 })

      const method = String(b.method || "").toUpperCase()
      const otp = String(b.otp || "").trim() || null
      const v = await verifyDelivery(session.businessId, order, method, otp)
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })
      const recipientName = String(b.recipientName || "").trim() || null
      const r = await markOrderDelivered({ lbId: session.businessId, orderId: order.id, deliveredBy: actor.name, recipientName, note: `Verified (${v.method}${otp ? `: ${otp}` : " — identity confirmed"})`, actor })
      if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code, balanceDue: r.balanceDue } : {}) }, { status: r.status })
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { fieldStatus: FIELD_STATUS.DELIVERED, deliveryCompletedAt: new Date() } })
      // BAG DISPOSITION — recorded BESIDE the delivery, never in front of it.
      // Handing the bag to the customer is the normal outcome and the default;
      // a missing, unknown or kept bag can never fail a completed delivery, so
      // this is best-effort and its result does not change the response.
      await applyDeliveryDisposition({
        lbId: session.businessId, orderId: order.id,
        disposition: isDisposition(b.bagDisposition) ? b.bagDisposition : DEFAULT_DISPOSITION,
        condition: isCondition(b.bagCondition) ? b.bagCondition : undefined,
        reason: b.bagNote ? String(b.bagNote) : null,
        actor: { ...actor, role: "DELIVERY_EXECUTIVE" },
      }).catch(() => null)
      await notifyCustomerForOrder(order.id, session.businessId, { type: "DELIVERY_UPDATE", title: "Order delivered", message: `Your order ${r.orderNumber} has been delivered.` })
      return NextResponse.json({ success: true, delivered: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e) {
    console.error("[executive-deliver] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
