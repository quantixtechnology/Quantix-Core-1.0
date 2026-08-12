// Advance ALL reusable bags currently carrying an order to a lifecycle status
// (e.g. audit-approved → PROCESSING). Best-effort; the order/audit engines are
// unchanged. No QR generated — the same bag QR continues.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getBagReleaseStage, releaseBagsForOrder } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])
// A PICKUP bag is emptied at the STORE: the customer's garments come out when
// the store receives and audits them, so that bag goes straight back into
// circulation.
//
// PROCESSING is deliberately NOT here. Store Audit fires this route with
// PROCESSING when an audit is approved, which means "audited, moving on" — not
// "the Processing Center has it". Releasing on that signal frees the TRANSIT
// bag before it has travelled, and the order would leave the store in a bag the
// system already considers available. The real release happens when the
// Processing Center receives the order (orders/[id]/receive).
const BAG_FREED = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT"])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { businessId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const toStatus = String(b.toStatus || "").trim()
    if (!LIFECYCLE.has(toStatus)) return NextResponse.json({ error: "Invalid lifecycle status." }, { status: 400 })

    // Configurable release: a PROCESSING_RECEIVE laundry releases its bags the moment
    // the order is received/audited at the store — the same release engine, just
    // fired at this stage instead of at delivery. AFTER_DELIVERY laundries keep
    // advancing the bag through the lifecycle (released later at delivery).
    if ((toStatus === "AVAILABLE") ||
        (BAG_FREED.has(toStatus) && (await getBagReleaseStage(order.businessId)) === "PROCESSING_RECEIVE")) {
      const released = await releaseBagsForOrder(order.businessId, id)
      return NextResponse.json({ success: true, advanced: released, released: true })
    }

    const res = await prisma.laundryBag.updateMany({ where: { businessId: order.businessId, currentOrderId: id }, data: { status: toStatus } })
    return NextResponse.json({ success: true, advanced: res.count })
  } catch (e) {
    console.error("[bags-order-advance] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
