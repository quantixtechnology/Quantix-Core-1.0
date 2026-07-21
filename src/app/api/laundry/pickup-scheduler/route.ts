// Pickup & Delivery scheduler — Admin assigns field executives to existing
// orders. This is assignment ONLY: it never creates orders or changes the order
// lifecycle. Assignment writes the executive + live field status onto the order
// and appends a LaundryOrderEvent so Admin + Customer timelines reflect it.
//   GET  ?businessId=&date=YYYY-MM-DD&type=pickup|delivery&tab=&search=&area=&executiveId=&timeSlot=&service=&priority=
//        → bucketed jobs with area info, counts
//   POST { businessId, orderId, type, executiveId|null }           → single assign/reassign/unassign
//   POST { businessId, orderIds: string[], type, executiveId }      → bulk assign
//   GET  ?businessId=&date=&type=&manifest=true&orderIds=id1,id2    → manifest print data
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

// ── Derive area from store city or address first line ──────────────────────
const deriveArea = (storeCity: string | null, address: string | null): string => {
  if (storeCity) return storeCity
  if (address) {
    const parts = address.split(",").map((s) => s.trim()).filter(Boolean)
    return parts[parts.length - 1] || "Unknown"
  }
  return "Unknown"
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

    // ── Manifest mode: return print data for selected order ids ─────────────
    if (sp.get("manifest") === "true") {
      const ids = sp.get("orderIds")?.split(",").filter(Boolean) || []
      if (ids.length === 0) return NextResponse.json({ success: true, data: [] })
      const orders = await prisma.laundryOrder.findMany({
        where: { id: { in: ids }, businessId: lbId },
        select: {
          id: true, orderNumber: true, customerId: true,
          pickupAddress: true, pickupLandmark: true, pickupTimeSlot: true,
          storeId: true,
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
      const data = orders.map((o) => {
        const cust = o.customerId ? custMap.get(o.customerId) : null
        const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
        const ex = execId ? execMap.get(execId) : null
        return {
          orderNumber: o.orderNumber,
          customerName: cust?.name ?? "—",
          customerPhone: cust?.phone ?? null,
          address: o.pickupAddress,
          landmark: o.pickupLandmark,
          timeSlot: o.pickupTimeSlot,
          services: o.services.map((s) => s.serviceName),
          itemCount: o._count.items,
          executiveName: ex?.name ?? null,
          executivePhone: ex?.mobile ?? null,
        }
      })
      return NextResponse.json({ success: true, data })
    }

    // ── Normal listing mode ────────────────────────────────────────────────
    await prisma.laundryOrder.updateMany({ where: { businessId: lbId, orderType: "HOME_PICKUP", pickupRequired: false }, data: { pickupRequired: true, deliveryRequired: true } }).catch(() => {})

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

    // ── Client-side filter params (applied server-side for search) ──────────
    const searchQ = sp.get("search")?.toLowerCase().trim() || ""
    const filterArea = sp.get("area")?.trim() || ""
    const filterExecutiveId = sp.get("executiveId")?.trim() || ""
    const filterTimeSlot = sp.get("timeSlot")?.trim() || ""
    const filterService = sp.get("service")?.trim() || ""
    const filterPriority = sp.get("priority")?.trim() || ""
    const tabFilter = sp.get("tab")?.trim() || ""

    let data = orders.map((o) => {
      const execId = type === "delivery" ? o.deliveryExecutiveId : o.pickupExecutiveId
      const ex = execId ? execMap.get(execId) : null
      const cust = o.customerId ? custMap.get(o.customerId) : null
      const bucket = bucketOf(o)
      const area = deriveArea(o.store?.city ?? null, o.pickupAddress)
      return {
        id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
        priority: o.isExpress ? "EXPRESS" : "NORMAL",
        customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
        timeSlot: type === "delivery" ? (o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : null) : o.pickupTimeSlot,
        storeId: o.storeId, storeName: o.store?.storeName ?? null,
        address: o.pickupAddress, landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
        area,
        services: o.services.map((s) => s.serviceName), bagCount: o.services.length, itemCount: o._count.items,
        executiveId: execId, executiveName: ex?.name ?? null,
        vehicle: ex ? [ex.vehicleType, ex.vehicleNumber].filter(Boolean).join(" · ") || null : null,
        acceptance: type === "delivery" ? o.deliveryAcceptance : o.pickupAcceptance,
        assignedAt: type === "delivery" ? o.deliveryAssignedAt : o.pickupAssignedAt,
        acceptedAt: type === "delivery" ? o.deliveryAcceptedAt : o.pickupAcceptedAt,
        bucket,
      }
    })

    // ── Apply server-side filters ───────────────────────────────────────────
    if (searchQ) {
      data = data.filter((j) =>
        j.orderNumber.toLowerCase().includes(searchQ) ||
        j.customerName.toLowerCase().includes(searchQ) ||
        (j.customerPhone && j.customerPhone.includes(searchQ)) ||
        (j.address && j.address.toLowerCase().includes(searchQ)) ||
        (j.executiveName && j.executiveName.toLowerCase().includes(searchQ))
      )
    }
    if (filterArea) data = data.filter((j) => j.area.toLowerCase() === filterArea.toLowerCase())
    if (filterExecutiveId) data = data.filter((j) => j.executiveId === filterExecutiveId)
    if (filterTimeSlot) data = data.filter((j) => j.timeSlot === filterTimeSlot)
    if (filterService) data = data.filter((j) => j.services.some((s) => s.toLowerCase().includes(filterService.toLowerCase())))
    if (filterPriority) data = data.filter((j) => j.priority === filterPriority)

    // ── Tab filter excludes completed from "all" ────────────────────────────
    if (tabFilter === "all" || !tabFilter) {
      data = data.filter((j) => j.bucket !== "completed")
    }
    // For other tabs, the bucket filter handles it on the client side

    const allBuckets = data.reduce<Record<string, number>>((m, d) => { m[d.bucket] = (m[d.bucket] || 0) + 1; return m }, {})
    const areaCounts = data.reduce<Record<string, number>>((m, d) => { m[d.area] = (m[d.area] || 0) + 1; return m }, {})

    return NextResponse.json({ success: true, data, counts: allBuckets, areaCounts })
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

    const execId: string | null = b.executiveId || null
    let execName: string | null = null
    if (execId) {
      const ex = await prisma.laundryDeliveryExecutive.findFirst({ where: { id: execId, businessId: biz.id, isActive: true }, select: { name: true } })
      if (!ex) return NextResponse.json({ error: "Delivery executive not found or inactive" }, { status: 404 })
      execName = ex.name
    }
    const actor = { id: guard.ctx?.userId ?? null, name: guard.ctx?.userName ?? "Supervisor" }

    // ── Bulk assignment ─────────────────────────────────────────────────────
    const orderIds: string[] = b.orderIds
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      const orders = await prisma.laundryOrder.findMany({ where: { id: { in: orderIds }, businessId: biz.id }, select: { id: true } })
      if (orders.length !== orderIds.length) return NextResponse.json({ error: "Some orders not found" }, { status: 404 })
      if (!execId) return NextResponse.json({ error: "executiveId required for bulk assignment" }, { status: 400 })

      const now = new Date()
      if (type === "delivery") {
        await prisma.laundryOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { deliveryExecutiveId: execId, deliveryAssignedAt: now, deliveryAcceptance: "PENDING", deliveryAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED },
        })
        for (const oid of orderIds) {
          await logFieldEvent({ orderId: oid, businessId: biz.id, action: "DELIVERY_ASSIGNED", note: `Delivery assigned to ${execName} (bulk)`, actor }).catch(() => {})
        }
      } else {
        await prisma.laundryOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { pickupExecutiveId: execId, pickupAssignedAt: now, pickupAcceptance: "PENDING", pickupAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED },
        })
        for (const oid of orderIds) {
          await logFieldEvent({ orderId: oid, businessId: biz.id, action: "PICKUP_ASSIGNED", note: `Pickup assigned to ${execName} (bulk)`, actor }).catch(() => {})
          await notifyCustomerForOrder(oid, biz.id, { type: "ORDER_STATUS", title: "Pickup scheduled", message: "A pickup executive has been assigned for your order." }).catch(() => {})
        }
      }
      return NextResponse.json({ success: true, assigned: orderIds.length, executiveId: execId })
    }

    // ── Bulk unassign (orderIds with null executiveId) ──────────────────────
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0 && !execId) {
      const now = new Date()
      if (type === "delivery") {
        await prisma.laundryOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { deliveryExecutiveId: null, deliveryAssignedAt: null, deliveryAcceptance: null, deliveryAcceptedAt: null, fieldStatus: null },
        })
        for (const oid of orderIds) {
          await logFieldEvent({ orderId: oid, businessId: biz.id, action: "DELIVERY_UNASSIGNED", note: `Delivery assignment cleared (bulk)`, actor }).catch(() => {})
        }
      } else {
        await prisma.laundryOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { pickupExecutiveId: null, pickupAssignedAt: null, pickupAcceptance: null, pickupAcceptedAt: null, fieldStatus: null },
        })
        for (const oid of orderIds) {
          await logFieldEvent({ orderId: oid, businessId: biz.id, action: "PICKUP_UNASSIGNED", note: `Pickup assignment cleared (bulk)`, actor }).catch(() => {})
        }
      }
      return NextResponse.json({ success: true, unassigned: orderIds.length })
    }

    // ── Single assignment (legacy) ──────────────────────────────────────────
    if (!b.orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    const order = await prisma.laundryOrder.findFirst({ where: { id: b.orderId, businessId: biz.id }, select: { id: true, pickupExecutiveId: true, deliveryExecutiveId: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    if (type === "delivery") {
      await prisma.laundryOrder.update({ where: { id: order.id }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: execId ? new Date() : null, deliveryAcceptance: execId ? "PENDING" : null, deliveryAcceptedAt: null, ...(execId ? { fieldStatus: FIELD_STATUS.ASSIGNED } : { fieldStatus: null }) } })
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
