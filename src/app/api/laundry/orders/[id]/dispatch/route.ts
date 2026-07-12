// POST /api/laundry/orders/[id]/dispatch — Transit to Processing Center.
// Creates the persistent transit state on the packet (dispatched by/at/note)
// and advances PACKED → IN_TRANSIT_TO_PROCESSING. Duplicate dispatch is
// blocked by the status guard.
//
// Body: { businessId, actorId?, actorName?, note?, transportBy? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.transit.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, orderNumber: true, status: true, packet: true },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (!order.packet) return NextResponse.json({ error: "Order has not been packed yet — create the packet first" }, { status: 409 })
    if (order.status !== "PACKED") {
      return NextResponse.json({ error: order.status === "IN_TRANSIT_TO_PROCESSING" ? "Packet already dispatched" : `Order is not packed (current: ${order.status})` }, { status: 409 })
    }

    const note = [b.transportBy ? `Transport: ${b.transportBy}` : null, b.note || null].filter(Boolean).join(" · ") || null
    const now = new Date()
    // Atomic: only the first dispatch wins.
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "PACKED" },
      data: { status: "IN_TRANSIT_TO_PROCESSING" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Packet already dispatched" }, { status: 409 })

    await prisma.laundryPacket.update({
      where: { orderId: order.id },
      data: { status: "IN_TRANSIT_TO_PC", dispatchedBy: b.actorName || null, dispatchedAt: now, dispatchNote: note },
    })
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PACKED", toStatus: "IN_TRANSIT_TO_PROCESSING", action: "DISPATCH_TO_PROCESSING",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: note || `Packet ${order.packet.packetNumber} in transit`,
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, packetNumber: order.packet.packetNumber, dispatchedAt: now } })
  } catch (e) {
    console.error("[laundry-order-dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
