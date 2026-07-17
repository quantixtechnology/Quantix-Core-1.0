// Advance a reusable bag through its lifecycle by scanning its permanent QR.
// COLLECTED → RECEIVED_AT_STORE → UNDER_AUDIT → PROCESSING → READY_FOR_DELIVERY
// → DELIVERED → RETURNED → CLEANING → AVAILABLE. On AVAILABLE the bag is cleared
// and its open assignment is closed, ready for the next pickup. Additive — the
// order/audit/processing engines are unchanged; this only tracks the asset.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const LIFECYCLE = new Set(["RECEIVED_AT_STORE", "UNDER_AUDIT", "PROCESSING", "READY_FOR_DELIVERY", "DELIVERED", "RETURNED", "CLEANING", "AVAILABLE"])

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    const toStatus = String(b.toStatus || "").trim()
    if (!businessId || !code || !toStatus) return NextResponse.json({ success: false, error: "businessId, code and toStatus are required" }, { status: 400 })
    if (!LIFECYCLE.has(toStatus)) return NextResponse.json({ success: false, error: "Invalid lifecycle status." }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const bag = await prisma.laundryBag.findFirst({ where: { businessId: biz.id, OR: [{ bagNumber: code }, { qrValue: code }] } })
    if (!bag) return NextResponse.json({ success: false, error: `Bag "${code}" not found.` }, { status: 404 })

    const data: Record<string, unknown> = { status: toStatus }
    if (toStatus === "AVAILABLE") {
      Object.assign(data, { currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null, currentCustomerId: null, currentCustomerName: null })
    }
    const updated = await prisma.$transaction(async (tx) => {
      const bg = await tx.laundryBag.update({ where: { id: bag.id }, data })
      // Close the open assignment once the bag is fully returned/available.
      if ((toStatus === "RETURNED" || toStatus === "AVAILABLE") && bag.currentOrderId) {
        await tx.laundryBagAssignment.updateMany({ where: { bagId: bag.id, orderId: bag.currentOrderId, status: "ASSIGNED" }, data: { status: "RETURNED", returnedAt: new Date() } })
      }
      return bg
    })
    return NextResponse.json({ success: true, data: updated, orderId: bag.currentOrderId })
  } catch (e) {
    console.error("[bags-advance] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
