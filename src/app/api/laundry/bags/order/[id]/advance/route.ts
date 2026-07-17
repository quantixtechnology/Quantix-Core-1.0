// Advance ALL reusable bags currently carrying an order to a lifecycle status
// (e.g. audit-approved → PROCESSING). Best-effort; the order/audit engines are
// unchanged. No QR generated — the same bag QR continues.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])

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

    const data: Record<string, unknown> = { status: toStatus }
    if (toStatus === "AVAILABLE") Object.assign(data, { currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null, currentCustomerId: null, currentCustomerName: null })
    const res = await prisma.laundryBag.updateMany({ where: { businessId: order.businessId, currentOrderId: id }, data })
    return NextResponse.json({ success: true, advanced: res.count })
  } catch (e) {
    console.error("[bags-order-advance] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
