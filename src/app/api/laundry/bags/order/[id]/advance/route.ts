// Advance ALL reusable bags currently carrying an order to a lifecycle status
// (e.g. audit-approved → PROCESSING). Best-effort; the order/audit engines are
// unchanged. No QR generated — the same bag QR continues.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getBagReleaseStage, releaseBagsForOrder } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])
// Store-arrival stages: the garments have been received/counted at the store, so
// a PROCESSING_RECEIVE laundry's bag is emptied here and must be RELEASED (not just
// advanced). This is the transition Store Audit fires (→ PROCESSING) — the
// systemic point the release was previously never wired to.
// Statuses that mean the garments have left the bag. PROCESSING is the
// Processing Center receive; the store-side ones cover a bag that never went
// out. Named for what they signify, not where they happen.
const BAG_FREED = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING"])

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
