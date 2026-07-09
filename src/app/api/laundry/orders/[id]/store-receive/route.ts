// POST /api/laundry/orders/[id]/store-receive — Received back at Store.
// The origin store confirms the returned processed order (garment count
// verification + optional discrepancy note) and the order becomes
// READY_FOR_DELIVERY. Only a RETURN_IN_TRANSIT order can be received.
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
      select: { id: true, orderNumber: true, status: true, packet: { select: { id: true, packetNumber: true } }, _count: { select: { items: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status !== "RETURN_IN_TRANSIT") {
      return NextResponse.json({ error: order.status === "READY_FOR_DELIVERY" ? "Order already received at store" : `Order is not in return transit (current: ${order.status})` }, { status: 409 })
    }

    const now = new Date()
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "RETURN_IN_TRANSIT" },
      data: { status: "READY_FOR_DELIVERY" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Order already received at store" }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "RETURNED_TO_STORE", returnReceivedBy: b.actorName || null, returnReceivedAt: now },
      })
    }
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "RETURN_IN_TRANSIT", toStatus: "READY_FOR_DELIVERY", action: "RECEIVE_AT_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `${order._count.items} garment(s) verified at store`,
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber } })
  } catch (e) {
    console.error("[laundry-order-store-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
