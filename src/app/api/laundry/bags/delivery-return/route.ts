// POST /api/laundry/bags/delivery-return { businessId, code, actorName } — the
// store scans/enters a delivery bag brought back by the executive after a
// completed delivery. Closes the delivery chain of custody: marks the order's
// deliveryBagReturnedAt and, if the code is a reusable bag, releases it to
// AVAILABLE so it can be used again.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId
    const raw = String(b.code || b.bagNumber || b.qrValue || "").trim()
    if (!businessId || !raw) return NextResponse.json({ success: false, error: "businessId and a bag code are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    // Normalise a scanned QR to the reusable bag number when it matches one.
    const bag = await prisma.laundryBag.findFirst({ where: { businessId: biz.id, OR: [{ bagNumber: raw }, { qrValue: raw }] }, select: { id: true, bagNumber: true, status: true, currentOrderId: true } })
    const bagNumber = bag?.bagNumber || raw

    const order = await prisma.laundryOrder.findFirst({
      where: { businessId: biz.id, deliveryBagNumber: bagNumber, deliveryCompletedAt: { not: null }, deliveryBagReturnedAt: null },
      orderBy: { deliveredAt: "desc" },
      select: { id: true, orderNumber: true, customerId: true },
    })
    if (!order) {
      // Distinguish "already returned / never out" from "unknown bag".
      const already = await prisma.laundryOrder.findFirst({ where: { businessId: biz.id, deliveryBagNumber: bagNumber, deliveryBagReturnedAt: { not: null } }, select: { orderNumber: true }, orderBy: { deliveredAt: "desc" } })
      if (already) return NextResponse.json({ success: false, error: `Bag ${bagNumber} was already returned (last: ${already.orderNumber}).` }, { status: 409 })
      return NextResponse.json({ success: false, error: `No delivered order is out with bag ${bagNumber}.` }, { status: 404 })
    }

    const now = new Date()
    await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryBagReturnedAt: now } })

    // Release the reusable bag back to AVAILABLE (physical bag is back, empty).
    let released = false
    if (bag && bag.status !== "AVAILABLE") {
      await prisma.laundryBag.update({
        where: { id: bag.id },
        data: { status: "AVAILABLE", currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null, currentCustomerId: null, currentCustomerName: null },
      })
      released = true
    }

    await logFieldEvent({ orderId: order.id, businessId: biz.id, action: "DELIVERY_BAG_RETURNED", note: `Delivery bag ${bagNumber} received back at store${released ? " · released to Available" : ""}`, actor: { id: guard.ctx?.userId ?? null, name: b.actorName ?? guard.ctx?.userName ?? "Staff" } })

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, bagNumber, released } })
  } catch (e) {
    console.error("[bags-delivery-return] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
