// Dispatch Center — live operations queue + historical archive.
//
//   GET  ?businessId=&type=pickup|delivery&scope=active
//        → today's live queue (awaiting / assigned / accepted / completed)
//   GET  ?businessId=&type=pickup|delivery&scope=history&datePreset=&fromDate=&toDate=&page=0&limit=50&search=
//        → paginated historical archive
//   GET  ?businessId=&type=&manifest=true&orderIds=     → manifest
//   POST { businessId, orderId, type, executiveId|null } → single assign
//   POST { businessId, orderIds, type, executiveId }     → bulk assign / unassign
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { LaundryOrderStatus } from "@prisma/client"
import { logFieldEvent, FIELD_STATUS } from "@/lib/laundry-field-ops"
import { notifyCustomerForOrder } from "@/lib/laundry-notify"

export const runtime = "nodejs"

const dayRange = (d: Date) => {
  const s = new Date(d); s.setHours(0, 0, 0, 0)
  const e = new Date(s); e.setDate(e.getDate() + 1)
  return { start: s, end: e }
}

const dateRangeForPreset = (preset: string, fromDate?: string, toDate?: string) => {
  const now = new Date()
  if (preset === "custom" && fromDate && toDate) {
    const s = new Date(fromDate); s.setHours(0, 0, 0, 0)
    const e = new Date(toDate); e.setHours(23, 59, 59, 999)
    return { start: s, end: e }
  }
  if (preset === "yesterday") {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return dayRange(d)
  }
  if (preset === "last7d") {
    const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0)
    return { start: s, end: now }
  }
  if (preset === "thisMonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: s, end: now }
  }
  // default: today
  return dayRange(now)
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

    // ── Scope ──────────────────────────────────────────────────────────────
    const scope = sp.get("scope") || "active"

    if (scope === "history") {
      return await handleHistory(sp, lbId, type, now)
    }

    // ── Active (today's live queue) ─────────────────────────────────────────
    const { start, end } = dayRange(now)

    const debug = sp.get("_debug") === "1"
    const where = type === "delivery"
      ? { businessId: lbId, deliveryRequired: true, deliveryCompletedAt: null, status: LaundryOrderStatus.READY_FOR_DELIVERY }
      : { businessId: lbId, pickupRequired: true, pickupCompletedAt: null, status: { notIn: [LaundryOrderStatus.CANCELLED, LaundryOrderStatus.READY_FOR_DELIVERY, LaundryOrderStatus.DELIVERED] } }

    if (debug) console.log(`[DISPATCH_DEBUG] type=${type} where=${JSON.stringify(where)}`)

    const orders = await prisma.laundryOrder.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, isExpress: true, customerId: true,
        pickupRequired: true, deliveryRequired: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true,
        pickupMapsLink: true, pickupLat: true, pickupLng: true, fieldStatus: true,
        pickupExecutiveId: true, deliveryExecutiveId: true,
        pickupAssignedAt: true, pickupAcceptance: true, pickupAcceptedAt: true,
        pickupStartedAt: true, pickupCompletedAt: true,
        deliveryAssignedAt: true, deliveryAcceptance: true, deliveryAcceptedAt: true,
        deliveryStartedAt: true, deliveryCompletedAt: true, deliveredAt: true,
        expectedDeliveryDate: true, deliveryDate: true, deliveryTimeSlot: true, balanceDue: true,
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
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true } }),
    ])
    const execMap = new Map(execs.map((e) => [e.id, e]))
    const custMap = new Map(custs.map((c) => [c.id, c]))

    // Correct MISSED: only if executive ACCEPTED and schedule expired and never completed
    const bucketOf = (o: (typeof orders)[number]): string => {
      if (o.status === "CANCELLED") return "cancelled"
      if (type === "delivery") {
        if (o.deliveryCompletedAt || o.status === "DELIVERED") return "completed"
        if (o.deliveryExecutiveId) return o.deliveryAcceptedAt ? "accepted" : "assigned"
        return "awaiting"
      }
      if (o.pickupCompletedAt) return "completed"
      if (o.pickupExecutiveId) return o.pickupAcceptedAt ? "accepted" : "assigned"
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
        // Mode-aware schedule: the same Order fields, surfaced per queue. No new data.
        timeSlot: type === "delivery" ? o.deliveryTimeSlot : o.pickupTimeSlot,
        amountDue: o.balanceDue ?? 0,
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
        scheduledDate: (type === "delivery" ? (o.deliveryDate ?? o.expectedDeliveryDate) : o.pickupDate)?.toISOString() ?? null,
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

    const resp: Record<string, unknown> = { success: true, data, counts }
    if (debug) {
      resp._debug = {
        url: request.url,
        type,
        where,
        returned: orders.map((o) => ({
          id: o.id, orderNumber: o.orderNumber, status: o.status,
          pickupRequired: o.pickupRequired, pickupCompletedAt: o.pickupCompletedAt?.toISOString() ?? null,
          deliveryRequired: o.deliveryRequired, deliveryCompletedAt: o.deliveryCompletedAt?.toISOString() ?? null,
          deliveredAt: o.deliveredAt?.toISOString() ?? null,
          fieldStatus: o.fieldStatus,
        })),
      }
    }
    return NextResponse.json(resp)
  } catch (e) {
    console.error("[dispatch] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── History handler ─────────────────────────────────────────────────────────
async function handleHistory(sp: URLSearchParams, lbId: string, type: string, now: Date) {
  const preset = sp.get("datePreset") || "today"
  const fromDate = sp.get("fromDate") || undefined
  const toDate = sp.get("toDate") || undefined
  const searchQ = sp.get("search")?.toLowerCase().trim() || ""
  const page = Math.max(0, parseInt(sp.get("page") || "0", 10))
  const limit = Math.min(200, Math.max(10, parseInt(sp.get("limit") || "50", 10)))
  const { start, end } = dateRangeForPreset(preset, fromDate, toDate)

  // Build WHERE for completed/historical dispatches within the date range
  const isPickup = type !== "delivery"
  const timeField = isPickup ? "pickupCompletedAt" : "deliveryCompletedAt"
  const execField = isPickup ? "pickupExecutiveId" : "deliveryExecutiveId"
  const acceptField = isPickup ? "pickupAcceptance" : "deliveryAcceptance"

  // Completed: within date range
  const completedWhere: any = {
    businessId: lbId,
    [isPickup ? "pickupRequired" : "deliveryRequired"]: true,
    OR: [
      { [timeField]: { gte: start, lte: end } },
      { status: "CANCELLED", updatedAt: { gte: start, lte: end } },
      // Also include DELIVERED orders within period
      ...(isPickup ? [] : [{ status: "DELIVERED" as const, deliveredAt: { gte: start, lte: end } }]),
    ],
  }

  const [total, orders] = await Promise.all([
    prisma.laundryOrder.count({ where: completedWhere }),
    prisma.laundryOrder.findMany({
      where: completedWhere,
      select: {
        id: true, orderNumber: true, status: true, isExpress: true, customerId: true,
        pickupDate: true, pickupTimeSlot: true, pickupAddress: true, pickupLandmark: true,
        pickupMapsLink: true, pickupLat: true, pickupLng: true, fieldStatus: true,
        pickupExecutiveId: true, deliveryExecutiveId: true,
        pickupAssignedAt: true, pickupAcceptance: true, pickupAcceptedAt: true,
        pickupStartedAt: true, pickupCompletedAt: true,
        deliveryAssignedAt: true, deliveryAcceptance: true, deliveryAcceptedAt: true,
        deliveryStartedAt: true, deliveryCompletedAt: true, deliveredAt: true,
        expectedDeliveryDate: true, createdAt: true,
        storeId: true, store: { select: { storeName: true, city: true } },
        services: { select: { serviceName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { [timeField]: "desc" },
      skip: page * limit,
      take: limit,
    }),
  ])

  const execIds = [...new Set(orders.flatMap((o) => [o.pickupExecutiveId, o.deliveryExecutiveId]).filter(Boolean) as string[])]
  const custIds2 = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
  const [execs, custs2] = await Promise.all([
    prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { id: { in: custIds2 } }, select: { id: true, name: true, phone: true } }),
  ])
  const execMap = new Map(execs.map((e) => [e.id, e.name]))
  const custMap2 = new Map(custs2.map((c) => [c.id, c]))

  // Fetch latest relevant events for context (rejection reason, cancellation reason)
  const eventActions = isPickup
    ? ["PICKUP_COMPLETED", "PICKUP_CANCELLED", "PICKUP_REJECTED", "PICKUP_ACCEPTED"]
    : ["MARK_DELIVERED", "DELIVERY_CANCELLED", "DELIVERY_REJECTED", "DELIVERY_ACCEPTED", "OUT_FOR_DELIVERY"]
  const events = await prisma.laundryOrderEvent.findMany({
    where: { orderId: { in: orders.map((o) => o.id) }, action: { in: eventActions } },
    select: { id: true, orderId: true, action: true, note: true, actorName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  const eventsByOrder = new Map<string, typeof events>()
  for (const e of events) {
    const arr = eventsByOrder.get(e.orderId) || []
    arr.push(e)
    eventsByOrder.set(e.orderId, arr)
  }

  let data = orders.map((o) => {
    const execId = isPickup ? o.pickupExecutiveId : o.deliveryExecutiveId
    const execName = execId ? execMap.get(execId) ?? null : null
    const cust = o.customerId ? custMap2.get(o.customerId) : null
    const orderEvents = eventsByOrder.get(o.id) || []

    const completedTime = isPickup ? o.pickupCompletedAt : (o.deliveryCompletedAt || o.deliveredAt)
    const requestedAt = isPickup ? o.createdAt : (o.deliveryAssignedAt || o.createdAt)
    const acceptedAt = isPickup ? o.pickupAcceptedAt : o.deliveryAcceptedAt

    // Determine reason for cancelled/rejected
    const rejectEvent = orderEvents.find((e) => e.action === (isPickup ? "PICKUP_REJECTED" : "DELIVERY_REJECTED"))
    const cancelEvent = orderEvents.find((e) => e.action === (isPickup ? "PICKUP_CANCELLED" : "DELIVERY_CANCELLED"))

    let bucket = "completed"
    if (o.status === "CANCELLED") {
      bucket = cancelEvent ? "cancelled" : "cancelled"
    } else if (isPickup ? o.pickupAcceptance === "REJECTED" : o.deliveryAcceptance === "REJECTED") {
      bucket = "rejected"
    } else if (isPickup ? !o.pickupCompletedAt : !o.deliveryCompletedAt && o.status !== "DELIVERED") {
      bucket = "failed"
    }

    return {
      id: o.id, orderNumber: o.orderNumber, status: o.status, fieldStatus: o.fieldStatus,
      priority: o.isExpress ? "EXPRESS" : "NORMAL",
      customerName: cust?.name ?? "—", customerPhone: cust?.phone ?? null,
      timeSlot: isPickup ? o.pickupTimeSlot : (o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : null),
      storeName: o.store?.storeName ?? null, address: o.pickupAddress,
      landmark: o.pickupLandmark, mapsLink: o.pickupMapsLink, lat: o.pickupLat, lng: o.pickupLng,
      services: o.services.map((s) => s.serviceName), bagCount: o.services.length,
      executiveId: execId, executiveName: execName,
      acceptance: isPickup ? o.pickupAcceptance : o.deliveryAcceptance,
      assignedAt: (isPickup ? o.pickupAssignedAt : o.deliveryAssignedAt)?.toISOString() ?? null,
      acceptedAt: acceptedAt?.toISOString() ?? null,
      completedAt: completedTime?.toISOString() ?? null,
      requestedAt: requestedAt?.toISOString() ?? null,
      createdAt: o.createdAt?.toISOString() ?? null,
      reason: rejectEvent?.note || cancelEvent?.note || null,
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

  return NextResponse.json({ success: true, data, total, page, limit })
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
      const now2 = new Date()
      if (type === "delivery") {
        await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { deliveryExecutiveId: execId, deliveryAssignedAt: now2, deliveryAcceptance: "PENDING", deliveryAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED } })
        for (const oid of orderIds) { await logFieldEvent({ orderId: oid, businessId: biz.id, action: "DELIVERY_ASSIGNED", note: `Bulk → ${execName}`, actor }).catch(() => {}) }
      } else {
        await prisma.laundryOrder.updateMany({ where: { id: { in: orderIds } }, data: { pickupExecutiveId: execId, pickupAssignedAt: now2, pickupAcceptance: "PENDING", pickupAcceptedAt: null, fieldStatus: FIELD_STATUS.ASSIGNED } })
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
