// Assign a reusable bag to an order+service during pickup. Only an AVAILABLE
// bag can be assigned. One bag = one service (a service cannot get two bags,
// a bag holds one service). Sets the bag COLLECTED and logs the assignment.
// No QR is generated — the physical bag's permanent QR is reused.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = b.businessId as string | undefined
    const code = String(b.code || b.bagNumber || b.qrValue || "").trim()
    const orderId = String(b.orderId || "").trim()
    if (!businessId || !code || !orderId) return NextResponse.json({ success: false, error: "businessId, code and orderId are required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.create")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const bag = await prisma.laundryBag.findFirst({ where: { businessId: biz.id, OR: [{ bagNumber: code }, { qrValue: code }] } })
    if (!bag) return NextResponse.json({ success: false, error: "Bag not found." }, { status: 404 })
    if (bag.status !== "AVAILABLE") {
      const msg = bag.status === "DAMAGED" ? "Bag marked as Damaged. Please use another bag."
        : bag.status === "LOST" ? "Bag is marked Lost."
        : bag.status === "CLEANING" ? "Bag is being cleaned. Please use another bag."
        : "Bag already assigned to another order."
      return NextResponse.json({ success: false, error: msg }, { status: 409 })
    }

    const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, businessId: biz.id }, select: { id: true, orderNumber: true, customerId: true } })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    const customer = order.customerId ? await prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } }) : null

    const serviceId = b.serviceId ? String(b.serviceId) : null
    const serviceName = String(b.serviceName || "Laundry")

    // One bag = one service: block a second bag for the same order+service.
    if (serviceId) {
      const dup = await prisma.laundryBag.findFirst({ where: { businessId: biz.id, currentOrderId: orderId, currentServiceId: serviceId, status: { notIn: ["AVAILABLE", "RETURNED", "DELIVERED"] } } })
      if (dup) return NextResponse.json({ success: false, error: `${serviceName} already has bag ${dup.bagNumber} assigned.` }, { status: 409 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const bg = await tx.laundryBag.update({
        where: { id: bag.id },
        data: {
          status: "COLLECTED",
          currentOrderId: order.id, currentOrderNumber: order.orderNumber,
          currentServiceId: serviceId, currentServiceName: serviceName,
          currentCustomerId: order.customerId || null, currentCustomerName: customer?.name || null,
          lastUsedAt: new Date(), totalUsageCount: { increment: 1 },
        },
      })
      await tx.laundryBagAssignment.create({
        data: { bagId: bag.id, businessId: biz.id, orderId: order.id, orderNumber: order.orderNumber, serviceId, serviceName, customerId: order.customerId || null, customerName: customer?.name || null, status: "ASSIGNED" },
      })
      return bg
    })
    return NextResponse.json({ success: true, data: updated }, { status: 201 })
  } catch (e) {
    console.error("[bags-assign] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
