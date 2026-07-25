// GET /api/laundry/bags/reconciliation?businessId=[&hours=]
//
// Chain-of-custody accountability: which bags an executive picked up but the store
// has NOT yet scanned in (IN_TRANSIT_TO_STORE), grouped per pickup executive, so a
// bag can never be lost without a name against it. Bags older than `hours`
// (default 12) in transit are flagged as OVERDUE / likely missing.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const hours = Math.max(1, Number(sp.get("hours") || 12))
    if (!businessId) return NextResponse.json({ success: false, error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.bags.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: { executives: [], summary: { inTransit: 0, overdue: 0, receivedToday: 0 } } })
    const lbId = biz.id

    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const overdueBefore = new Date(Date.now() - hours * 3600_000)

    // Bags still with an executive: orders picked up, not yet received at store.
    const inTransit = await prisma.laundryOrder.findMany({
      where: { businessId: lbId, status: "IN_TRANSIT_TO_STORE", pickupCompletedAt: { not: null } },
      select: { id: true, orderNumber: true, pickupExecutiveId: true, pickupCompletedAt: true, storeId: true, customerId: true },
      orderBy: { pickupCompletedAt: "asc" },
    })
    // Received back at store today (per executive) — the "returned" side.
    const receivedTodayRows = await prisma.laundryOrderEvent.findMany({
      where: { businessId: lbId, action: { in: ["RECEIVE_PICKUP_AT_STORE", "RECEIVE_EXCEPTION"] }, createdAt: { gte: dayStart } },
      select: { orderId: true },
    })
    const receivedOrderIds = [...new Set(receivedTodayRows.map((r) => r.orderId))]
    const receivedOrders = receivedOrderIds.length
      ? await prisma.laundryOrder.findMany({ where: { id: { in: receivedOrderIds } }, select: { pickupExecutiveId: true } })
      : []

    const execIds = [...new Set([...inTransit.map((o) => o.pickupExecutiveId), ...receivedOrders.map((o) => o.pickupExecutiveId)].filter(Boolean) as string[])]
    const execs = execIds.length
      ? await prisma.laundryDeliveryExecutive.findMany({ where: { id: { in: execIds } }, select: { id: true, name: true, mobile: true } })
      : []
    const execMap = new Map(execs.map((e) => [e.id, e]))
    // Bag numbers currently held (COLLECTED) per in-transit order.
    const bags = await prisma.laundryBag.findMany({ where: { businessId: lbId, currentOrderId: { in: inTransit.map((o) => o.id) } }, select: { bagNumber: true, currentOrderId: true } })
    const bagsByOrder = new Map<string, string[]>()
    for (const bg of bags) { const k = bg.currentOrderId!; bagsByOrder.set(k, [...(bagsByOrder.get(k) || []), bg.bagNumber]) }

    // Group in-transit by executive.
    const byExec = new Map<string, { executiveId: string; executiveName: string; executivePhone: string | null; inTransit: number; overdue: number; oldestAt: string | null; receivedToday: number; orders: { orderNumber: string; pickupCompletedAt: string | null; bags: string[]; overdue: boolean }[] }>()
    const keyFor = (id: string | null) => id || "__unassigned__"
    for (const o of inTransit) {
      const k = keyFor(o.pickupExecutiveId)
      const ex = o.pickupExecutiveId ? execMap.get(o.pickupExecutiveId) : null
      if (!byExec.has(k)) byExec.set(k, { executiveId: k, executiveName: ex?.name || "Unassigned", executivePhone: ex?.mobile || null, inTransit: 0, overdue: 0, oldestAt: null, receivedToday: 0, orders: [] })
      const g = byExec.get(k)!
      const overdue = !!o.pickupCompletedAt && o.pickupCompletedAt < overdueBefore
      g.inTransit++; if (overdue) g.overdue++
      if (!g.oldestAt || (o.pickupCompletedAt && new Date(o.pickupCompletedAt) < new Date(g.oldestAt))) g.oldestAt = o.pickupCompletedAt?.toISOString() ?? null
      g.orders.push({ orderNumber: o.orderNumber, pickupCompletedAt: o.pickupCompletedAt?.toISOString() ?? null, bags: bagsByOrder.get(o.id) || [], overdue })
    }
    for (const o of receivedOrders) { const k = keyFor(o.pickupExecutiveId); if (byExec.has(k)) byExec.get(k)!.receivedToday++ }

    const executives = [...byExec.values()].sort((a, b) => b.overdue - a.overdue || b.inTransit - a.inTransit)
    const summary = {
      inTransit: inTransit.length,
      overdue: executives.reduce((n, e) => n + e.overdue, 0),
      receivedToday: receivedOrderIds.length,
    }
    return NextResponse.json({ success: true, data: { executives, summary, thresholdHours: hours } })
  } catch (e) {
    console.error("[bags-reconciliation] GET", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
