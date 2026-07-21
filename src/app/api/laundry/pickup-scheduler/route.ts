// Dispatch Center — Admin assigns field executives to today's pickups or
// deliveries. Assignment writes the executive + live field status onto the
// order and appends a LaundryOrderEvent for the timeline.
//
//   GET  ?businessId=&type=pickup|delivery&tab=&search= → today's jobs
//   GET  ?businessId=&type=&manifest=true&orderIds=     → manifest data
//   POST { businessId, orderId, type, executiveId|null } → single assign
//   POST { businessId, orderIds, type, executiveId }     → bulk assign / unassign
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"

export const runtime = "nodejs"

const todayRange = () => {
  const start = new Date(); start.setHours(0, 0, 0, 0)
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
    const now = new Date()
    const { start, end } = todayRange()

    // ── Manifest ──────────────────────────────────────────────────────────
    if (sp.get("manifest") === "true") {
      const ids = sp.get("orderIds")?.split(",").filter(Boolean) || []
      if (ids.length === 0) return NextResponse.json({ success: true, data: [] })
      const orders = await prisma.laundryOrder.findMany({
        where: { id: { in: ids }, businessId: lbId },
        select: {
          orderNumber: true, customerId: true,
          pickupAddress: true, pickupLandmark: true, pickupTimeSlot: true,
          pickupExecutiveId: true, deliveryExecutiveId: true,
          services: { select: { serviceName: true } },
          _count: { select: { items: true } },
        },
      })
      const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
      const execIds = [...new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter(Boolean) as string[])]
      const [custs, execs] = await Promise.all([
        prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }),
        prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true, mobile: true } }),
      ])
      const custMap = new Map(custs.map((c) => [c.id, c]))
      const execMap = new Map(execs.map((e) => [e.id, e]))
      return NextResponse.json({
        success: true,
        data: orders.map((o) => {
          const cust = o.customerId ? custMap.get(o.customerId) : null
          const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
          const ex = execId ? execMap.get(execId) : null
          return { orderNumber: o.orderNumber, customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null, address: o.pickupAddress, landmark: o.pickupLandmark, timeSlot: o.pickupTimeSlot, services: o.services.map((s) => s.serviceName), itemCount: o._count.items, executiveName: ex?.name ?? null, executivePhone: ex?.mobile ?? null }
        }),
      })
    }

    // ── Today's dispatch ──────────────────────────────────────────────────
    await prisma.laundryOrder.updateMany({
      where: { businessId: lbId, orderType: "HOME_PICKUP", pickupRequired: false },
      data: { pickupRequired: true, deliveryRequired: true },
    }).catch(() => {})

    const where = type === "delivery"
      ? { businessId: lbId, deliveryRequired: true, OR: [{ status: "READY_FOR_DELIVERY" as const }, { AND: [{ status: "DELIVERED" as const }, { deliveredAt: { gte: start, lt: end } }] }] }
      : { businessId: lbId, pickupRequired: true }

    const orders = await prisma.laundryOrder.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, isExpress: true, customerId: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true,
        pickupMapsLink: true, pickupLat: true, pickupLng: true, fieldStatus: true,
        pickupExecutiveId: true, deliveryExecutiveId: true,
        pickupAssignedAt: true, pickupAcceptance: true, pickupAcceptedAt: true,
        pickupStartedAt: true, pickupCompletedAt: true,
        deliveryAssignedAt: true, deliveryAcceptance: true, deliveryAcceptedAt: true,
        deliveryStartedAt: true, deliveryCompletedAt: true, deliveredAt: true,
        storeId: true, store: { select: { storeName: true, city: true } },
        services: { select: { serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ pickupTimeSlot: "asc" }, { createdAt: "asc" }],
    })

    const execIds = [...new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter(Boolean) as string[])]
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const [execs, custs] = await Promise.all([
      prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true, vehicleType: true, vehicleNumber: true } }),
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true, address: true } }),
    ])
    const execMap = new Map(execs.map((e) => [e.id, e]))
    const custMap = new Map(custs.map((c) => [c.id, c]))

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

    const searchQ = sp.get("search")?.toLowerCase().trim() || ""
    const tabFilter = sp.get("tab")?.trim() || ""

    let data = orders.map((o) => {
      const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
      const ex = execId ? execMap.get(execId) : null
      const cust = o.customerId ? custMap.get(o.customerId) : null
      const bucket = bucketOf(o)
      const area = o.store?.city || (o.pickupAddress ? o.pickupAddress.split(",").pop()?.trim() : null) || ""
      const completedTime = type === "delivery" ? o.deliveryCompletedAt : o.pickupCompletedAt
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
        priority: o.isExpress ? "EXPRESS" : "NORMAL",
        customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
        timeSlot: type === "delivery" ? (o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : null) : o.pickupTimeSlot,
        storeName: o.store?.storeName ?? null, address: o.pickupAddress,
        landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
        area,
        services: o.services.map((s) => s.serviceName), bagCount: o.services.length,
        executiveId: execId, executiveName: ex?.name ?? null,
        vehicle: ex ? [ex.vehicleType, ex.vehicleNumber].filter(Boolean).join(" · ") || null : null,
        acceptance: type === "delivery" ? o.deliveryAcceptance : o.pickupAcceptance,
        assignedAt: (type === "delivery" ? o.deliveryAssignedAt : o.pickupAssignedAt)?.toISOString() ?? null,
        acceptedAt: (type === "delivery" ? o.deliveryAcceptedAt : o.pickupAcceptedAt)?.toISOString() ?? null,
        completedAt: completedTime?.toISOString() ?? null,
        bucket,
      }
    })

    if (searchQ) {
      const q = searchQ
      data = data.filter((j) =>
        j.orderNumber.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        (j.customerPhone && j.customerPhone.includes(q)) ||
        (j.address && j.address.toLowerCase().includes(q)) ||
        (j.executiveName && j.executiveName.toLowerCase().includes(q))
      )
    }
    if (tabFilter && tabFilter !== "all") {
      data = data.filter((j) => j.bucket === tabFilter)
    }

    const counts: Record<string, number> = {}
    for (const d of data) { counts[d.bucket] = (counts[d.bucket] || 0) + 1 }
    counts.total = data.length

    return NextResponse.json({ success: true, data, counts })
  } catch (e) {
    console.error("[dispatch] GET", e)
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

    const execId: string | null = b.executiveId || null
    let execName: string | null = null
    if (execId) {
      const ex = await prisma.laundryDeliveryExecutive.findFirst({ where: { id: execId, businessId: biz.id, isActive: true }, select: { name: true } })
      if (!ex) return NextResponse.json({ error: "Executive not found or inactive" }, { status: 404 })
      execName = ex.name
    }
    const actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Supervisor" }

    // ── Bulk ──────────────────────────────────────────────────────────────
    const orderIds: string[] = b.orderIds
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      const found = await prisma.laundryOrder.findMany({ where: { id: { in: orderIds }, businessId: biz.id }, select: { id: true } })
      if (found.length !== orderIds.length) return NextResponse.json({ error: "Some orders not found" }, { status: 404 })
      if (!execId) {
        if (type === "delivery") {
          await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { deliveryExecutiveId: null, deliveryAssignedAt: null, deliveryAcceptance: null, deliveryAcceptedAt: null, fieldStatus: null } })
          for (const oid of orderIds) { await logFieldEvent({ orderId: oid, businessId: biz.id, action: "DELIVERY_UNASSIGNED", note: "Bulk unassign", actor }).catch(() => {}) }
        } else {
          await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { pickupExecutiveId: null, pickupAssignedAt: null, pickupAcceptance: null, pickupAcceptedAt: null, fieldStatus: null } })
          for (const oid of orderIds) { await logFieldEvent({ orderId: oid, businessId: biz.id, action: "PICKUP_UNASSIGNED", note: "Bulk unassign", actor }).catch(() => {}) }
        }
        return NextResponse.json({ success: true, unassigned: orderIds.length })
      }
      const now = new Date()
      if (type === "delivery") {
        await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: now, deliveryAcceptance: "PENDING", deliveryAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED } })
        for (const oid of orderIds) { await logFieldEvent({ orderId: oid, businessId: biz.id, action: "DELIVERY_ASSIGNED", note: `Bulk → ${execName}`, actor }).catch(() => {}) }
      } else {
        await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { pickupExecutiveId: execId, pickupAssignedAt: now, pickupAcceptance: "PENDING", pickupAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED } })
        for (const oid of orderIds) { await logFieldEvent({ orderId: oid, businessId: biz.id, action: "PICKUP_ASSIGNED", note: `Bulk → ${execName}`, actor }).catch(() => {}) }
        for (const oid of orderIds) { await notifyCustomerForOrder(oid, biz.id, { type: "ORDER_STATUS", title: "Pickup scheduled", message: "A pickup executive has been assigned for your order." }).catch(() => {}) }
      }
      return NextResponse.json({ success: true, assigned: orderIds.length, executiveId: execId })
    }

    // ── Single ────────────────────────────────────────────────────────────
    if (!b.orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    const order = await prisma.laundryOrder.findFirst({ where: { id: b.orderId, businessId: biz.id }, select: { id: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (type === "delivery") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: execId ? new Date() : null, deliveryAcceptance: execId ? "PENDING" : null, deliveryAcceptedAt: null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : { fieldStatus: null }) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "DELIVERY_ASSIGNED" : "DELIVERY_UNASSIGNED", note: execId ? `→ ${execName}` : "Cleared", actor })
    } else {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { pickupExecutiveId: execId, pickupAssignedAt: execId ? new Date() : null, pickupAcceptance: execId ? "PENDING" : null, pickupAcceptedAt: null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : { fieldStatus: null }) } })
      await logFieldEvent({ orderId: order.id, businessId: biz.id, action: execId ? "PICKUP_ASSIGNED" : "PICKUP_UNASSIGNED", note: execId ? `→ ${execName}` : "Cleared", actor })
      if (execId) await notifyCustomerForOrder(order.id, biz.id, { type: "ORDER_STATUS", title: "Pickup scheduled", message: "A pickup executive has been assigned for your order." })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[dispatch] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
