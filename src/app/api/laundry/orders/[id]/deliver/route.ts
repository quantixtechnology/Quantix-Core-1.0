// POST /api/laundry/orders/[id]/deliver — the FINAL operational action.
// Customer pickup / delivery completion. SERVER-VALIDATED:
//   - order must be READY_FOR_DELIVERY
//   - outstanding balance blocks delivery (pay first via the payment API)
//     unless the order is subscription-covered
// Captures delivered by / timestamp / recipient, writes the Delivered event.
//
// Body: { businessId, actorId?, actorName?, recipientName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, orderNumber: true, status: true, orderType: true, balanceDue: true, paymentStatus: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status !== "READY_FOR_DELIVERY") {
      return NextResponse.json({ error: order.status === "DELIVERED" ? "Order already delivered" : `Order is not ready for delivery (current: ${order.status})` }, { status: 409 })
    }

    // Outstanding balance gate — collect the final payment first.
    const covered = order.paymentStatus === "PAID" || order.paymentStatus === "SUBSCRIPTION"
    if (!covered && order.balanceDue > 0) {
      return NextResponse.json({ error: `Outstanding balance ₹${order.balanceDue.toFixed(2)} must be collected before delivery.`, code: "BALANCE_DUE", balanceDue: order.balanceDue }, { status: 402 })
    }

    const now = new Date()
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "READY_FOR_DELIVERY" },
      data: { status: "DELIVERED", deliveredAt: now, deliveredBy: b.actorName || null, recipientName: b.recipientName || null },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Order already delivered" }, { status: 409 })

    // Every garment becomes operationally complete.
    await prisma.laundryOrderItem.updateMany({
      where: { orderId: order.id },
      data: { processingStage: "DISPATCHED", processingStatus: "DONE" },
    })

    const deliveryType = order.orderType === "WALK_IN" || order.orderType === "STORE_DROP" ? "Customer Pickup" : "Delivery"
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "READY_FOR_DELIVERY", toStatus: "DELIVERED", action: "MARK_DELIVERED",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: [deliveryType, b.recipientName ? `Received by ${b.recipientName}` : null, b.note || null].filter(Boolean).join(" · "),
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, deliveredAt: now, deliveryType } })
  } catch (e) {
    console.error("[laundry-order-deliver] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
