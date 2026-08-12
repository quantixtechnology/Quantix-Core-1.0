// Advance ALL reusable bags currently carrying an order to a lifecycle status
// (e.g. audit-approved → PROCESSING). Best-effort; the order/audit engines are
// unchanged. No QR generated — the same bag QR continues.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { releaseBagsForOrder } from "@/lib/laundry-bag-assign"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])
// A BAG IS RELEASED BY A PHYSICAL HANDOVER, NEVER BY AN ORDER STATUS.
//
// This route only ADVANCES a bag's status alongside the order. It used to also
// release on certain statuses, which meant an order moving to PROCESSING freed
// a bag that was still in a van. The four real release points each live with
// their own handover action:
//
//   pickup received at the store   → bags/receive-at-store
//   Processing Center receives     → orders/[id]/receive
//   store receives the return leg  → orders/[id]/store-receive
//   delivery bag comes back        → bags/delivery-return
//
// An explicit AVAILABLE is still honoured — that is a person saying so.

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

    // Only an explicit AVAILABLE releases here.
    if (toStatus === "AVAILABLE") {
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
