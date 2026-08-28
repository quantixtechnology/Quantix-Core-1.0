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
import { guardStatusWrite } from "@/lib/laundry-order-state"
import { assignBagToOrder } from "@/lib/laundry-bag-assign"
import { syncPackageLifecycle } from "@/lib/laundry-finishing"
import { isProcessingTerminal } from "@/lib/laundry-processing"
import { getTransportMode, transportRefForOrder } from "@/lib/laundry-transport-server"
import { usesBag } from "@/lib/laundry-transport"

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
        packet: { select: { id: true } },
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

    // Transport Setup (Processing Center → Store) decides what identifies the
    // return package. In BAG mode the bag IS the identifier: it is required up
    // front, and a bad bag blocks the dispatch instead of degrading to a warning.
    const mode = await getTransportMode(biz.id, "PROCESSING_TO_STORE")
    const bagCode = String(b.bagCode || "").trim()
    if (mode === "BAG" && !bagCode) {
      return NextResponse.json({ error: "Scan the return bag — the bag QR is this business's return transport identifier.", code: "TRANSPORT_BAG_REQUIRED" }, { status: 409 })
    }

    // The return bag is linked to the order BEFORE the status advances, so a
    // bad/unavailable bag can never leave a BAG-mode order in transit with no
    // identifier. Assigning with serviceId null avoids the one-bag-per-service
    // block; re-scanning the bag the order already holds is a no-op. In
    // PACKET / BOTH mode the bag stays optional and best-effort.
    let bagWarning: string | null = null
    let bagAssigned: string | null = null
    if (bagCode) {
      const r = await assignBagToOrder({ lbId: biz.id, code: bagCode, orderId: order.id, serviceId: null, serviceName: "Return" })
      if (r.ok) bagAssigned = r.bag.bagNumber
      else if (mode === "BAG") return NextResponse.json({ error: r.error, code: "TRANSPORT_BAG_INVALID" }, { status: 409 })
      else bagWarning = r.error
    }

    const now = new Date()
    // STATE INVARIANTS — shared server guard (src/lib/laundry-order-state.ts).
    // The operational checks above own the physical action; this owns the
    // workflow claim, so no endpoint can advance an order past work that
    // never happened.
    const stateGate = await guardStatusWrite({ orderId: order.id, businessId: biz.id, from: "PROCESSING", to: "RETURN_IN_TRANSIT", allowInternal: true })
    if (!stateGate.ok) return NextResponse.json({ error: stateGate.error, code: stateGate.code }, { status: 409 })

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

    const ref = await transportRefForOrder(biz.id, order.id, mode)
    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PROCESSING", toStatus: "RETURN_IN_TRANSIT", action: "DISPATCH_TO_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `${order.items.length} garment(s) complete — returning to store${usesBag(mode) && bagAssigned ? ` in bag ${bagAssigned}` : ref.code ? ` · ${ref.code}` : ""}`,
      },
    }).catch(() => null)

    // Finished goods released → processing packages advance to RELEASED.
    await syncPackageLifecycle(order.id, biz.id).catch(() => null)

    return NextResponse.json({ success: true, mode, data: { orderNumber: order.orderNumber, items: order.items.length, transport: ref, transportCode: ref.code, bagAssigned }, bagWarning })
  } catch (e) {
    console.error("[laundry-order-return-dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
