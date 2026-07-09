// POST /api/laundry/orders/[id]/pack — Packing & QR Generation.
// Creates the PERSISTENT packet identity (PKT-{orderNumber}, one per order —
// unique orderId) whose QR payload is the packet number, and advances the
// order READY_FOR_PROCESSING → PACKED. Idempotent: a double-click returns the
// existing packet instead of creating a second one.
//
// Body: { businessId, actorId?, actorName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { generatePacketNumber } from "@/lib/laundry-codes"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: { id: true, orderNumber: true, status: true, storeId: true, _count: { select: { items: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    // Idempotency: if a packet already exists, return it (no duplicate).
    const existing = await prisma.laundryPacket.findUnique({ where: { orderId: order.id } })
    if (existing) return NextResponse.json({ success: true, data: existing, alreadyPacked: true })

    if (order.status !== "READY_FOR_PROCESSING") {
      return NextResponse.json({ error: `Order is not ready for packing (current: ${order.status})` }, { status: 409 })
    }
    if (order._count.items === 0) {
      return NextResponse.json({ error: "Order has no garments to pack" }, { status: 409 })
    }

    const packetNumber = generatePacketNumber(order.orderNumber)
    let packet
    try {
      packet = await prisma.laundryPacket.create({
        data: {
          packetNumber, businessId: biz.id, storeId: order.storeId, orderId: order.id,
          status: "PACKED", qrValue: packetNumber, itemCount: order._count.items,
          packedBy: b.actorName || null,
        },
      })
    } catch (e: unknown) {
      // Unique constraint (concurrent double-click) → return the winner's packet.
      const existing2 = await prisma.laundryPacket.findUnique({ where: { orderId: order.id } })
      if (existing2) return NextResponse.json({ success: true, data: existing2, alreadyPacked: true })
      throw e
    }

    // Advance status atomically from the expected state only.
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "READY_FOR_PROCESSING" },
      data: { status: "PACKED" },
    })
    if (advanced.count > 0) {
      await prisma.laundryOrderEvent.create({
        data: {
          orderId: order.id, businessId: biz.id,
          fromStatus: "READY_FOR_PROCESSING", toStatus: "PACKED", action: "PACK_ORDER",
          actorId: b.actorId || null, actorName: b.actorName || null,
          note: b.note || `Packet ${packetNumber} · ${order._count.items} garment(s)`,
        },
      }).catch(() => null)
    }

    return NextResponse.json({ success: true, data: packet }, { status: 201 })
  } catch (e) {
    console.error("[laundry-order-pack] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
