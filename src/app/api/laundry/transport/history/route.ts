// GET /api/laundry/transport/history?businessId=&stage=&search=&limit=
// Transport history for the Store / Processing Center consoles, built from the
// order AUDIT LOG (LaundryOrderEvent) rather than from packet rows — so history
// is identical whether the business transports by packet, by bag, or by both.
// Each row carries the transport identifier resolved through Transport Setup.
//
// stage: DISPATCHED | RECEIVED | RETURN_DISPATCHED | RETURN_RECEIVED
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportModes, orderIdsByTransportSearch, transportRefsForOrders } from "@/lib/laundry-transport-server"
import type { TransportMode } from "@/lib/laundry-transport"

export const runtime = "nodejs"

const STAGE_ACTION: Record<string, { action: string; direction: "STORE_TO_PROCESSING" | "PROCESSING_TO_STORE" }> = {
  DISPATCHED: { action: "DISPATCH_TO_PROCESSING", direction: "STORE_TO_PROCESSING" },
  RECEIVED: { action: "RECEIVE_AT_PROCESSING", direction: "STORE_TO_PROCESSING" },
  RETURN_DISPATCHED: { action: "DISPATCH_TO_STORE", direction: "PROCESSING_TO_STORE" },
  RETURN_RECEIVED: { action: "RECEIVE_AT_STORE", direction: "PROCESSING_TO_STORE" },
}

/** Orders whose order number, transport identifier or customer matches `q`. */
async function orderIdsMatching(lbId: string, platformBusinessId: string, q: string, mode: TransportMode): Promise<string[]> {
  const ids = new Set<string>()

  const [byNumber, customers] = await Promise.all([
    prisma.laundryOrder.findMany({ where: { businessId: lbId, orderNumber: { contains: q } }, select: { id: true }, take: 200 }),
    prisma.customer.findMany({ where: { businessId: platformBusinessId, OR: [{ name: { contains: q } }, { phone: { contains: q } }] }, select: { id: true }, take: 200 }),
  ])
  for (const o of byNumber) ids.add(o.id)
  if (customers.length) {
    const byCustomer = await prisma.laundryOrder.findMany({
      where: { businessId: lbId, customerId: { in: customers.map((c) => c.id) } }, select: { id: true }, take: 200,
    })
    for (const o of byCustomer) ids.add(o.id)
  }
  for (const id of await orderIdsByTransportSearch(lbId, q, mode)) ids.add(id)
  return [...ids]
}

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const stage = STAGE_ACTION[(sp.get("stage") || "RECEIVED").toUpperCase()] || STAGE_ACTION.RECEIVED
    const search = (sp.get("search") || "").trim()
    const limit = Math.min(parseInt(sp.get("limit") || "50", 10) || 50, 100)

    const modes = await getTransportModes(biz.id)
    const mode = stage.direction === "PROCESSING_TO_STORE" ? modes.processingToStore : modes.storeToProcessing

    const where: Record<string, unknown> = { businessId: biz.id, action: stage.action }
    if (search) {
      const ids = await orderIdsMatching(biz.id, biz.platformBusinessId || biz.id, search, mode)
      if (ids.length === 0) return NextResponse.json({ success: true, mode, data: [] })
      where.orderId = { in: ids }
    }

    const events = await prisma.laundryOrderEvent.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, orderId: true, actorName: true, note: true, createdAt: true },
    })
    if (events.length === 0) return NextResponse.json({ success: true, mode, data: [] })

    // Newest event per order — an order re-dispatched after a correction shows once.
    const seen = new Set<string>()
    const rows = events.filter((e) => (seen.has(e.orderId) ? false : (seen.add(e.orderId), true)))
    const orderIds = rows.map((r) => r.orderId)

    const [orders, refs] = await Promise.all([
      prisma.laundryOrder.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, orderNumber: true, status: true, customerId: true, store: { select: { storeName: true } }, _count: { select: { items: true } } },
      }),
      transportRefsForOrders(biz.id, orderIds, mode),
    ])
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : []
    const custMap = new Map(custs.map((c) => [c.id, c]))

    return NextResponse.json({
      success: true,
      mode,
      data: rows.flatMap((e) => {
        const o = orderMap.get(e.orderId)
        if (!o) return []
        return [{
          id: e.id,
          orderId: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          storeName: o.store?.storeName || null,
          customer: o.customerId ? custMap.get(o.customerId)?.name || null : null,
          itemCount: o._count.items,
          at: e.createdAt,
          actorName: e.actorName,
          note: e.note,
          transport: refs.get(o.id) || null,
        }]
      }),
    })
  } catch (e) {
    console.error("[laundry-transport-history] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
