// POST /api/laundry/orders/[id]/receive — Received at Processing Center.
// STRICT: only a DISPATCHED packet (order IN_TRANSIT_TO_PROCESSING) can be
// received — an undispatched order is rejected. Records who received it and
// any package condition note, moves every garment to the Audit & Barcode
// queue, and advances the order to PROCESSING. Duplicate receipt is blocked
// by the atomic status guard.
//
// Body: { businessId?, actorId?, actorName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, businessId: true, status: true, packet: { select: { id: true, packetNumber: true, status: true } }, items: { select: { id: true, receivedAt: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (order.status !== "IN_TRANSIT_TO_PROCESSING") {
      const msg = order.status === "PROCESSING"
        ? "Packet already received at the Processing Center"
        : `Packet has not been dispatched — cannot receive (order is ${order.status})`
      return NextResponse.json({ error: msg }, { status: 409 })
    }

    const now = new Date()
    // Atomic: first receive wins.
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "IN_TRANSIT_TO_PROCESSING" },
      data: { status: "PROCESSING" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Packet already received" }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "AT_PROCESSING_CENTER", receivedBy: b.actorName || null, receivedAt: now, receiveNote: b.note || null },
      })
    }

    let received = 0
    for (const it of order.items) {
      if (it.receivedAt) continue // idempotent per garment
      // Received garments wait at Audit & Barcode Generation — they only enter
      // the processing queues after barcodes are generated + "Move to Processing".
      await prisma.laundryOrderItem.update({ where: { id: it.id }, data: { processingStage: "RECEIVED", processingStatus: "WAITING", processingDept: "Audit & Barcode", receivedAt: now } })
      await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "RECEIVED", toStage: "RECEIVED", department: "Receiving", actorName: b.actorName || null } })
      received++
    }

    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: order.businessId,
        fromStatus: "IN_TRANSIT_TO_PROCESSING", toStatus: "PROCESSING", action: "RECEIVE_AT_PROCESSING",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || (order.packet ? `Packet ${order.packet.packetNumber} received` : null),
      },
    }).catch(() => null)

    return NextResponse.json({ success: true, data: { received, totalItems: order.items.length, packetNumber: order.packet?.packetNumber || null } })
  } catch (e) {
    console.error("[laundry-order-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
