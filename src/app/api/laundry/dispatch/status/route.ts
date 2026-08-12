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

    const scope = sp.get("scope")
    if (scope === "history") {
      // History scope: completed pickups/deliveries
      ;(where as any).OR = [
        { pickupCompletedAt: { not: null } },
        { deliveryCompletedAt: { not: null } },
        { deliveredAt: { not: null } },
      ]
    }

    const orders = await prisma.laundryOrder.findMany({
      where: where as any,
      select: {
        id: true, orderNumber: true, status: true, orderType: true, createdAt: true,
        pickupRequired: true, pickupExecutiveId: true, pickupAssignedAt: true,
        pickupAcceptance: true, pickupAcceptedAt: true, pickupCompletedAt: true, pickupDate: true, pickupTimeSlot: true,
        deliveryRequired: true, deliveryExecutiveId: true, deliveryAssignedAt: true,
        deliveryAcceptance: true, deliveryAcceptedAt: true, deliveryCompletedAt: true, deliveredAt: true,
        fieldStatus: true,
        // The promise drives the running order of the day.
        promisedDeliveryDate: true, promisedDeliveryTimeSlot: true,
        deliveryDate: true, deliveryTimeSlot: true,
      },
      // A dispatch queue is a RUNNING ORDER, not a feed: the van leaves in
      // promised-slot order, so the earliest commitment must be at the top.
      // createdAt sorted by when the order was TAKEN, which says nothing about
      // when it is due. Slot strings are "HH:MM-HH:MM", so they sort correctly
      // as text. History keeps newest-first, which is what a log wants.
      orderBy: scope === "history"
        ? [{ createdAt: "desc" as const }]
        : [{ promisedDeliveryDate: "asc" as const }, { promisedDeliveryTimeSlot: "asc" as const }, { createdAt: "asc" as const }],
      take: scope === "history" ? 50 : 20,
    })

    // Executives (pickup + delivery) live in one LaundryDeliveryExecutive table
    // with no relation on the order — batch-resolve names by id, as the
    // pickup-scheduler does (single source of truth for executive lookups).
    const execIds = Array.from(new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter((x): x is string => !!x)))
    const execs = execIds.length
      ? await prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true } })
      : []
    const execNames = new Map(execs.map((e) => [e.id, e.name]))

    const data = orders.map((o) => ({
      orderId: o.id, orderNumber: o.orderNumber, status: o.status, orderType: o.orderType, createdAt: o.createdAt?.toISOString() ?? null,
      pickup: {
        required: o.pickupRequired,
        status: o.pickupCompletedAt ? "COMPLETED" : o.pickupAcceptedAt ? "ACCEPTED" : o.pickupExecutiveId ? "ASSIGNED" : "PENDING",
        executiveId: o.pickupExecutiveId,
        executiveName: execNames.get(o.pickupExecutiveId ?? "") ?? null,
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
        executiveName: execNames.get(o.deliveryExecutiveId ?? "") ?? null,
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
