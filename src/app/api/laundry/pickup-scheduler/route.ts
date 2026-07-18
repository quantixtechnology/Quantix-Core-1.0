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
import { logFieldEvent, FIELD_STATUS, PICKUP_DONE } from "@/lib/laundry-field-ops"

export const runtime = "nodejs"

const dayRange = (dateStr: string | null) => {
  const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
  const start = new Date(base); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { start, end }
}

// Order statuses that mean the pickup leg is already behind us.
const PAST_PICKUP = new Set(["PENDING_STORE_AUDIT", "UNDER_AUDIT", "PAYMENT_PENDING", "READY_FOR_PROCESSING", "PACKED", "IN_TRANSIT_TO_PROCESSING", "PROCESSING", "QC_PENDING", "RETURN_IN_TRANSIT", "READY_FOR_DELIVERY", "DELIVERED"])

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

    const where = type === "delivery"
      ? { businessId: lbId, OR: [{ status: "READY_FOR_DELIVERY" as const }, { AND: [{ status: "DELIVERED" as const }, { deliveredAt: { gte: start, lt: end } }] }] }
      : { businessId: lbId, pickupDate: { gte: start, lt: end } }

    const orders = await prisma.laundryOrder.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, isExpress: true, customerId: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true, pickupMapsLink: true, pickupLat: true, pickupLng: true,
        expectedDeliveryDate: true, deliveredAt: true, fieldStatus: true,
        pickupExecutiveId: true, deliveryExecutiveId: true,
        storeId: true, store: { select: { storeName: true } },
        services: { select: { serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ pickupTimeSlot: "asc" }, { createdAt: "asc" }],
    })

    // Assigned-executive names + customer name/phone (platform Customer, by id —
    // there is no direct relation on LaundryOrder).
    const execIds = [...new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter(Boolean) as string[])]
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const [execs, custs] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true } }),
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }),
    ])
    const execName = new Map(execs.map((e) => [e.id, e.name]))
    const custMap = new Map(custs.map((c) => [c.id, c]))

    const bucketOf = (o: (typeof orders)[number]): string => {
      if (o.status === "CANCELLED") return "cancelled"
      if (type === "delivery") {
        if (o.status === "DELIVERED") return "completed"
        if (o.deliveryExecutiveId) return "assigned"
        return "unassigned"
      }
      const done = (o.fieldStatus && PICKUP_DONE.has(o.fieldStatus)) || PAST_PICKUP.has(o.status)
      if (done) return "completed"
      if (o.pickupDate && o.pickupDate < now) return "missed"
      if (o.pickupExecutiveId) return "assigned"
      return "unassigned"
    }

    const data = orders.map((o) => {
      const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
      const cust = o.customerId ? custMap.get(o.customerId) : null
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
        priority: o.isExpress ? "EXPRESS" : "NORMAL",
        customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
        timeSlot: type === "delivery" ? (o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : null) : o.pickupTimeSlot,
        storeId: o.storeId, storeName: o.store?.storeName ?? null,
        address: o.pickupAddress, landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
        services: o.services.map((s) => s.serviceName), bagCount: o.services.length, itemCount: o._count.items,
        executiveId: execId, executiveName: execId ? execName.get(execId) ?? null : null,
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
      const u = await prisma.user.findUnique({ where: { id: execId }, select: { name: true } })
      if (!u) return NextResponse.json({ error: "Executive not found" }, { status: 404 })
      execName = u.name
    }
    const actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Supervisor" }

    if (type === "delivery") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: execId ? new Date() : null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : {}) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "DELIVERY_ASSIGNED" : "DELIVERY_UNASSIGNED", note: execId ? `Delivery assigned to ${execName}` : "Delivery assignment cleared", actor })
    } else {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { pickupExecutiveId: execId, pickupAssignedAt: execId ? new Date() : null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : { fieldStatus: null }) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "PICKUP_ASSIGNED" : "PICKUP_UNASSIGNED", note: execId ? `Pickup assigned to ${execName}` : "Pickup assignment cleared", actor })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[pickup-scheduler] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
