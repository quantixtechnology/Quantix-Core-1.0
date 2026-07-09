// POST /api/laundry/orders/[id]/return-dispatch — Transit to Store.
// The Processing Center dispatches the completed order back to the origin
// store. SERVER-VALIDATED: every garment must have finished its processing
// route (stage PACKED / status DONE) — an order with unfinished or QC-failed
// garments cannot be returned.
//
// Body: { businessId, actorId?, actorName?, note? }
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
      select: {
        id: true, orderNumber: true, status: true,
        packet: { select: { id: true, packetNumber: true } },
        items: { select: { id: true, processingStage: true, processingStatus: true } },
      },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status !== "PROCESSING") {
      return NextResponse.json({ error: order.status === "RETURN_IN_TRANSIT" ? "Order already dispatched to store" : `Order is not in processing (current: ${order.status})` }, { status: 409 })
    }

    const unfinished = order.items.filter((i) => !(i.processingStage === "PACKED" && i.processingStatus === "DONE"))
    if (unfinished.length > 0) {
      return NextResponse.json({ error: `${unfinished.length} garment(s) have not completed processing & QC — the order cannot return to store yet.`, pending: unfinished.length }, { status: 409 })
    }

    const now = new Date()
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "PROCESSING" },
      data: { status: "RETURN_IN_TRANSIT" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Order already dispatched to store" }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "RETURN_IN_TRANSIT", returnDispatchedBy: b.actorName || null, returnDispatchedAt: now },
      })
    }
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PROCESSING", toStatus: "RETURN_IN_TRANSIT", action: "DISPATCH_TO_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `${order.items.length} garment(s) complete — returning to store`,
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, items: order.items.length } })
  } catch (e) {
    console.error("[laundry-order-return-dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
