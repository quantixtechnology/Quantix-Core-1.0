// POST /api/laundry/orders/[id]/return-dispatch — Transit to Store.
// The Processing Center dispatches the completed order back to the origin
// store. SERVER-VALIDATED: every garment must have finished its processing
// route (Transit terminal / legacy Packed, status DONE) — an order with
// unfinished or QC-failed garments cannot be returned.
//
// Body: { businessId, actorId?, actorName?, note?, bagCode? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { assignBagToOrder } from "@/lib/laundry-bag-assign"
import { syncPackageLifecycle } from "@/lib/laundry-finishing"
import { isProcessingTerminal } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryPermission(request, b.businessId, "processing.console_receive.operate")
    if (!guard.ok) return guard.res
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

    const unfinished = order.items.filter((i) => !(isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE"))
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

    // Optional return bag: the packet is placed in ANY available bag for the trip
    // back (never locked to a specific bag). Assigning it links the bag to the
    // order (serviceId null → no one-bag-per-service block) so the store can scan
    // EITHER the packet QR or this bag to receive. Best-effort: a bad/unavailable
    // bag is reported but never unwinds the dispatch (the packet QR still works).
    let bagWarning: string | null = null
    let bagAssigned: string | null = null
    const bagCode = String(b.bagCode || "").trim()
    if (bagCode) {
      const r = await assignBagToOrder({ lbId: biz.id, code: bagCode, orderId: order.id, serviceId: null, serviceName: "Return" })
      if (r.ok) bagAssigned = r.bag.bagNumber
      else bagWarning = r.error
    }

    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PROCESSING", toStatus: "RETURN_IN_TRANSIT", action: "DISPATCH_TO_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `${order.items.length} garment(s) complete — returning to store`,
      },
    }).catch(() => null)

    // Finished goods released → processing packages advance to RELEASED.
    await syncPackageLifecycle(order.id, biz.id).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, items: order.items.length, packetNumber: order.packet?.packetNumber || null, bagAssigned }, bagWarning })
  } catch (e) {
    console.error("[laundry-order-return-dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
