import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const orderId = sp.get("orderId")
    const customerId = sp.get("customerId")
    if (!businessId || (!orderId && !customerId))
      return NextResponse.json({ error: "businessId and orderId or customerId required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const where: Record<string, unknown> = { businessId: biz.id }
    if (orderId) where.id = orderId
    if (customerId) where.customerId = customerId

    const orders = await prisma.laundryOrder.findMany({
      where: where as any,
      select: {
        id: true, orderNumber: true, status: true, orderType: true,
        pickupRequired: true, pickupExecutiveId: true, pickupAssignedAt: true,
        pickupAcceptance: true, pickupAcceptedAt: true, pickupCompletedAt: true, pickupDate: true, pickupTimeSlot: true,
        deliveryRequired: true, deliveryExecutiveId: true, deliveryAssignedAt: true,
        deliveryAcceptance: true, deliveryAcceptedAt: true, deliveryCompletedAt: true, deliveredAt: true,
        fieldStatus: true,
        pickupExecutive: { select: { name: true } },
        deliveryExecutive: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    const data = orders.map((o) => ({
      orderId: o.id, orderNumber: o.orderNumber, status: o.status, orderType: o.orderType,
      pickup: {
        required: o.pickupRequired,
        status: o.pickupCompletedAt ? "COMPLETED" : o.pickupAcceptedAt ? "ACCEPTED" : o.pickupExecutiveId ? "ASSIGNED" : "PENDING",
        executiveId: o.pickupExecutiveId,
        executiveName: o.pickupExecutive?.name ?? null,
        assignedAt: o.pickupAssignedAt?.toISOString() ?? null,
        acceptedAt: o.pickupAcceptedAt?.toISOString() ?? null,
        completedAt: o.pickupCompletedAt?.toISOString() ?? null,
        scheduledDate: o.pickupDate?.toISOString() ?? null,
        timeSlot: o.pickupTimeSlot,
      },
      delivery: {
        required: o.deliveryRequired,
        status: o.deliveryCompletedAt ? "COMPLETED" : o.deliveryAcceptedAt ? "ACCEPTED" : o.deliveryExecutiveId ? "ASSIGNED" : o.deliveryRequired ? "PENDING" : "NOT_REQUIRED",
        executiveId: o.deliveryExecutiveId,
        executiveName: o.deliveryExecutive?.name ?? null,
        assignedAt: o.deliveryAssignedAt?.toISOString() ?? null,
        acceptedAt: o.deliveryAcceptedAt?.toISOString() ?? null,
        completedAt: o.deliveryCompletedAt?.toISOString() ?? null,
      },
    }))

    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[dispatch/status] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
