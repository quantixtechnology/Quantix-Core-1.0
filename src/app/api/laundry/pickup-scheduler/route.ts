// Pickup & Delivery scheduler — Admin assigns field executives to existing
// orders. This is assignment ONLY: it never creates orders or changes the order
// lifecycle. Assignment writes the executive + live field status onto the order
// and appends a LaundryOrderEvent so Admin + Customer timelines reflect it.
//   GET  ?businessId=&date=YYYY-MM-DD&type=pickup|delivery  → bucketed jobs
//   POST { businessId, orderId, type, executiveId|null }     → assign/reassign/unassign
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"

export const runtime = "nodejs"

const dayRange = (dateStr: string | null) => {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
  const start = new Date(base); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { start, end }
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const type = sp.get("type") === "delivery" ? "delivery" : "pickup"
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId!)
    if (!biz) return NextResponse.json({ success: true, data: [], counts: {} })
    const lbId = biz.id
    const { start, end } = dayRange(sp.get("date"))
    const now = new Date()

    // Backfill the operational flag for legacy HOME_PICKUP orders created before
    // pickupRequired existed (idempotent — zero rows after the first pass).
    await prisma.laundryOrder.updateMany({ where: { businessId: lbId, orderType: "HOME_PICKUP", pickupRequired: false }, data: { pickupRequired: true, deliveryRequired: true } }).catch(() => {})

    // Assignment eligibility is OPERATIONAL and INDEPENDENT of order status.
    // Pickup queue  = every pickupRequired order (WALK_IN never qualifies;
    //                 HOME_PICKUP appears immediately after creation).
    // Delivery queue = deliveryRequired orders that are physically ready to hand
    //                 over (READY_FOR_DELIVERY) or delivered today. deliveryRequired
    //                 keeps walk-ins out; readiness is a real prerequisite, not a
    //                 status-exclusion filter.
    const where = type === "delivery"
      ? { businessId: lbId, deliveryRequired: true, OR: [{ status: "READY_FOR_DELIVERY" as const }, { AND: [{ status: "DELIVERED" as const }, { deliveredAt: { gte: start, lt: end } }] }] }
      : { businessId: lbId, pickupRequired: true }

    const orders = await prisma.laundryOrder.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, isExpress: true, customerId: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true, pickupMapsLink: true, pickupLat: true, pickupLng: true,
        expectedDeliveryDate: true, deliveredAt: true, fieldStatus: true,
        pickupExecutiveId: true, deliveryExecutiveId: true,
        pickupAssignedAt: true, pickupAcceptance: true, pickupAcceptedAt: true, pickupStartedAt: true, pickupCompletedAt: true,
        deliveryAssignedAt: true, deliveryAcceptance: true, deliveryAcceptedAt: true, deliveryStartedAt: true, deliveryCompletedAt: true,
        storeId: true, store: { select: { storeName: true } },
        services: { select: { serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ pickupTimeSlot: "asc" }, { createdAt: "asc" }],
    })

    // Assigned Delivery Executive names + customer name/phone (platform Customer,
    // by id — there is no direct relation on LaundryOrder).
    const execIds = [...new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter(Boolean) as string[])]
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const [execs, custs] = await Promise.all([
      prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true, vehicleType: true, vehicleNumber: true } }),
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }),
    ])
    const execMap = new Map(execs.map((e) => [e.id, e]))
    const custMap = new Map(custs.map((c) => [c.id, c]))

    // Buckets are derived from OPERATIONAL fields only (assignment → acceptance →
    // completion). Order status is read solely to LABEL a cancelled order, never
    // to decide whether it appears in the queue.
    const bucketOf = (o: (typeof orders)[number]): string => {
      if (o.status === "CANCELLED") return "cancelled"
      if (type === "delivery") {
        if (o.deliveryCompletedAt || o.status === "DELIVERED") return "completed"
        if (o.deliveryExecutiveId) return o.deliveryAcceptedAt ? "accepted" : "assigned"
        return "awaiting"
      }
      if (o.pickupCompletedAt) return "completed"
      if (o.pickupExecutiveId) return o.pickupAcceptedAt ? "accepted" : "assigned"
      if (o.pickupDate && o.pickupDate < now) return "missed"
      return "awaiting"
    }

    const data = orders.map((o) => {
      const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
      const ex = execId ? execMap.get(execId) : null
      const cust = o.customerId ? custMap.get(o.customerId) : null
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
        priority: o.isExpress ? "EXPRESS" : "NORMAL",
        customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
        timeSlot: type === "delivery" ? (o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : null) : o.pickupTimeSlot,
        storeId: o.storeId, storeName: o.store?.storeName ?? null,
        address: o.pickupAddress, landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
        services: o.services.map((s) => s.serviceName), bagCount: o.services.length, itemCount: o._count.items,
        executiveId: execId, executiveName: ex?.name ?? null,
        vehicle: ex ? [ex.vehicleType, ex.vehicleNumber].filter(Boolean).join(" · ") || null : null,
        acceptance: type === "delivery" ? o.deliveryAcceptance : o.pickupAcceptance,
        assignedAt: type === "delivery" ? o.deliveryAssignedAt : o.pickupAssignedAt,
        acceptedAt: type === "delivery" ? o.deliveryAcceptedAt : o.pickupAcceptedAt,
        bucket: bucketOf(o),
      }
    })
    const counts = data.reduce<Record<string, number>>((m, d) => { m[d.bucket] = (m[d.bucket] || 0) + 1; return m }, {})
    return NextResponse.json({ success: true, data, counts })
  } catch (e) {
    console.error("[pickup-scheduler] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    const type = b.type === "delivery" ? "delivery" : "pickup"
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.orders.edit")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    if (!b.orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    const order = await prisma.laundryOrder.findFirst({ where: { id: b.orderId, businessId: biz.id }, select: { id: true, pickupExecutiveId: true, deliveryExecutiveId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const execId: string | null = b.executiveId || null
    let execName: string | null = null
    if (execId) {
      const ex = await prisma.laundryDeliveryExecutive.findFirst({ where: { id: execId, businessId: biz.id, isActive: true }, select: { name: true } })
      if (!ex) return NextResponse.json({ error: "Delivery executive not found or inactive" }, { status: 404 })
      execName = ex.name
    }
    const actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Supervisor" }

    if (type === "delivery") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: execId ? new Date() : null, deliveryAcceptance: execId ? "PENDING" : null, deliveryAcceptedAt: null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : {}) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "DELIVERY_ASSIGNED" : "DELIVERY_UNASSIGNED", note: execId ? `Delivery assigned to ${execName}` : "Delivery assignment cleared", actor })
    } else {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { pickupExecutiveId: execId, pickupAssignedAt: execId ? new Date() : null, pickupAcceptance: execId ? "PENDING" : null, pickupAcceptedAt: null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : { fieldStatus: null }) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "PICKUP_ASSIGNED" : "PICKUP_UNASSIGNED", note: execId ? `Pickup assigned to ${execName}` : "Pickup assignment cleared", actor })
      if (execId) await notifyCustomerForOrder(order.id, biz.id, { type: "ORDER_STATUS", title: "Pickup scheduled", message: "A pickup executive has been assigned for your order." })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[pickup-scheduler] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
