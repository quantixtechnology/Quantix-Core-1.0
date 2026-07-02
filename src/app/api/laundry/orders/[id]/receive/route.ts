// POST /api/laundry/orders/[id]/receive
// Receive a dispatched order at the Processing Center: every garment moves into
// its first processing stage and gets a RECEIVED timeline event. Advances the
// order to PROCESSING if it was READY_FOR_PROCESSING.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { id: true, businessId: true, status: true, items: { select: { id: true, serviceName: true, receivedAt: true } } } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const now = new Date()
    let received = 0
    for (const it of order.items) {
      if (it.receivedAt) continue // idempotent — already received
      // Received garments wait at Audit & Barcode Generation — they only enter
      // the processing queues after barcodes are generated + "Move to Processing".
      await prisma.laundryOrderItem.update({ where: { id: it.id }, data: { processingStage: "RECEIVED", processingStatus: "WAITING", processingDept: "Audit & Barcode", receivedAt: now } })
      await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "RECEIVED", toStage: "RECEIVED", department: "Receiving", actorName: b.actorName || null } })
      received++
    }
    if (order.status === "READY_FOR_PROCESSING") {
      await prisma.laundryOrder.update({ where: { id }, data: { status: "PROCESSING" } })
      await prisma.laundryOrderEvent.create({ data: { orderId: id, businessId: order.businessId, fromStatus: order.status, toStatus: "PROCESSING", action: "DISPATCH_TO_PROCESSING", actorName: b.actorName || null, note: "Received at Processing Center" } }).catch(() => null)
    }
    return NextResponse.json({ success: true, data: { received, totalItems: order.items.length } })
  } catch (e) {
    console.error("[laundry-order-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
