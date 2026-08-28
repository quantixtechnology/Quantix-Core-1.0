// POST /api/laundry/orders/[id]/deliver — the FINAL operational action.
// Customer pickup / delivery completion. SERVER-VALIDATED:
//   - order must be READY_FOR_DELIVERY
//   - outstanding balance blocks delivery (pay first via the payment API)
//     unless the order is subscription-covered
//   - customer verification (Workflow Settings method) must succeed — the
//     Delivery OTP must match for OTP orders, or the recipient identity must be
//     confirmed for Name orders. Never bypassable.
// Captures delivered by / timestamp / recipient, writes the Delivered event.
//
// Body: { businessId, actorId?, actorName?, recipientName?, note?, method?, otp? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { markOrderDelivered } from "@/lib/laundry-deliver"
import { applyDeliveryDisposition, isDisposition, isCondition, DEFAULT_DISPOSITION } from "@/lib/laundry-bag-lifecycle"
import { syncPackageLifecycle } from "@/lib/laundry-finishing"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"
import { verifyDelivery } from "@/lib/laundry-verification"
import { deliveryBagGate } from "@/lib/laundry-delivery-bags"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.ready_for_delivery.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // Business rule: delivery can never complete without successful verification.
    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, status: true, deliveryOtp: true, deliveryVerificationMethod: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // BAG GATE — every bag of the order must be confirmed before ANY state
    // changes. It runs ahead of verifyDelivery deliberately: successful
    // verification CLEARS the OTP, so gating after it would burn the customer's
    // code on a delivery that then could not complete. Server-authoritative —
    // calling this endpoint directly cannot skip it.
    const bagBlock = await deliveryBagGate(biz.id, id)
    if (bagBlock) return NextResponse.json({ error: bagBlock, code: "BAGS_PENDING" }, { status: 409 })

    const method = String(b.method || "").toUpperCase()
    const otp = String(b.otp || "").trim() || null
    const v = await verifyDelivery(biz.id, order, method, otp)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status })

    const r = await markOrderDelivered({ lbId: biz.id, orderId: id, deliveredBy: b.actorName || null, recipientName: b.recipientName || null, note: [b.note || null, `Verified (${v.method}${otp ? `: ${otp}` : " — identity confirmed"})`].filter(Boolean).join(" · "), actor: { id: b.actorId || null, name: b.actorName || null } })
    if (!r.ok) return NextResponse.json({ error: r.error, ...(r.code ? { code: r.code, balanceDue: r.balanceDue } : {}) }, { status: r.status })
    // BAG DISPOSITION — see the executive route. Best-effort by design: the
    // delivery is already complete and must never be undone by a bag outcome.
    await applyDeliveryDisposition({
      lbId: biz.id, orderId: id,
      disposition: isDisposition(b.bagDisposition) ? b.bagDisposition : DEFAULT_DISPOSITION,
      condition: isCondition(b.bagCondition) ? b.bagCondition : undefined,
      reason: b.bagNote ? String(b.bagNote) : null,
      actor: { id: b.actorId || null, name: b.actorName || null, role: "STORE" },
    }).catch(() => null)
    await notifyCustomerForOrder(id, biz.id, { type: "DELIVERY_UPDATE", title: "Order delivered", message: `Your order ${r.orderNumber} has been delivered.` })
    // Order closed → processing packages advance to CLOSED.
    await syncPackageLifecycle(id, biz.id).catch(() => null)
    return NextResponse.json({ success: true, data: { orderNumber: r.orderNumber, deliveredAt: r.deliveredAt, deliveryType: r.deliveryType } })
  } catch (e) {
    console.error("[laundry-order-deliver] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
