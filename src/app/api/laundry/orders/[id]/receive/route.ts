// POST /api/laundry/orders/[id]/receive — Received at Processing Center.
// STRICT: only a DISPATCHED package (order IN_TRANSIT_TO_PROCESSING) can be
// received — an undispatched order is rejected. Records who received it and
// any package condition note, moves every garment to the Barcode Generation
// queue, and advances the order to PROCESSING. Duplicate receipt is blocked
// by the atomic status guard. The package is named by Transport Setup (bag or
// packet) in every message and audit note.
//
// Body: { businessId?, actorId?, actorName?, note? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportMode, transportRefForOrder } from "@/lib/laundry-transport-server"
import { transportNoun, transportRefLabel } from "@/lib/laundry-transport"
import { releaseBagsForOrder } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: { id: true, orderNumber: true, businessId: true, status: true, packet: { select: { id: true } }, items: { select: { id: true, receivedAt: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "processing.console_receive.operate")
    if (!guard.ok) return guard.res

    const mode = await getTransportMode(order.businessId, "STORE_TO_PROCESSING")
    const noun = transportNoun(mode)
    if (order.status !== "IN_TRANSIT_TO_PROCESSING") {
      const msg = order.status === "PROCESSING"
        ? `${noun} already received at the Processing Center`
        : `${noun} has not been dispatched — cannot receive (order is ${order.status})`
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    const ref = await transportRefForOrder(order.businessId, order.id, mode)

    const now = new Date()
    // Atomic: first receive wins.
    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "IN_TRANSIT_TO_PROCESSING" },
      data: { status: "PROCESSING" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: `${noun} already received` }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "AT_PROCESSING_CENTER", receivedBy: b.actorName || null, receivedAt: now, receiveNote: b.note || null },
      })
    }

    let received = 0
    for (const it of order.items) {
      if (it.receivedAt) continue // idempotent per garment
      // Received garments wait at Barcode Generation (Processing Center Receive)
      // — they only enter the processing queues after barcodes are generated +
      // "Move to Processing". (Store Audit is a separate, earlier store-side stage.)
      await prisma.laundryOrderItem.update({ where: { id: it.id }, data: { processingStage: "RECEIVED", processingStatus: "WAITING", processingDept: "Barcode Generation", receivedAt: now } })
      await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "RECEIVED", toStage: "RECEIVED", department: "Receiving", actorName: b.actorName || null } })
      received++
    }

    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: order.businessId,
        fromStatus: "IN_TRANSIT_TO_PROCESSING", toStatus: "PROCESSING", action: "RECEIVE_AT_PROCESSING",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || (transportRefLabel(ref) ? `${transportRefLabel(ref)} received` : null),
      },
    }).catch(() => null)

    // REUSABLE BAG RELEASE. The Processing Center has the garments now, so the
    // bag it travelled in is free — it must not wait for processing, QC, the
    // return leg or delivery. Uses the single release engine, which closes the
    // assignment and keeps the history, so the bag still shows this order and
    // this receive event.
    //
    // The ORDER is untouched by this: it carries on to Processing, QC, Store
    // and Delivery exactly as before.
    // Unconditional: this IS the handover. The bag is empty the moment the
    // Processing Center has the garments, so there is nothing left for a
    // setting to decide.
    const bagsReleased = await releaseBagsForOrder(order.businessId, order.id).catch(() => 0)

    return NextResponse.json({ success: true, mode, data: { received, totalItems: order.items.length, transport: ref, transportCode: ref.code, bagsReleased } })
  } catch (e) {
    console.error("[laundry-order-receive] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
