// GET /api/laundry/processing?businessId=&stage=
// Processing Center overview: orders waiting to be received, per-stage garment
// counts, and the garments in a given workstation queue.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { WORKSTATIONS, stageLabel, departmentFor } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const STAGE_SCREEN: Record<string, string> = { WASH: "washing", DRY: "drying", DRYCLEAN: "dry_cleaning", IRON: "ironing", FOLD: "folding", QC: "quality_check", PACKED: "packing" }

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const stage = sp.get("stage")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, stage ? `processing.${STAGE_SCREEN[stage] || "washing"}.view` : "processing.console_receive.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, incoming: [], awaitingBarcode: [], readyToReturn: [], stageCounts: {}, items: [] })

    // Incoming = DISPATCHED packets only (order IN_TRANSIT_TO_PROCESSING).
    // An undispatched order is NOT receivable — work-queue integrity.
    const incomingOrders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, status: "IN_TRANSIT_TO_PROCESSING" },
      select: { id: true, orderNumber: true, status: true, storeId: true, customerId: true, createdAt: true, _count: { select: { items: true } }, packet: { select: { packetNumber: true, dispatchedAt: true, dispatchedBy: true } }, store: { select: { storeName: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    })
    const custIds = [...new Set(incomingOrders.map((o) => o.customerId).filter(Boolean) as string[])]
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : []
    const cmap = new Map(custs.map((c) => [c.id, c.name]))
    const incoming = incomingOrders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, items: o._count.items, customer: o.customerId ? cmap.get(o.customerId) || null : null, createdAt: o.createdAt, packetNumber: o.packet?.packetNumber || null, dispatchedAt: o.packet?.dispatchedAt || null, fromStore: o.store?.storeName || null }))

    // Ready to Return = every garment finished its route (PACKED/DONE) but the
    // order is still at the Processing Center.
    const processingOrders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, status: "PROCESSING" },
      select: { id: true, orderNumber: true, customerId: true, store: { select: { storeName: true } }, packet: { select: { packetNumber: true } }, items: { select: { processingStage: true, processingStatus: true } } },
      orderBy: { createdAt: "asc" }, take: 100,
    })
    const rtCustIds = [...new Set(processingOrders.map((o) => o.customerId).filter(Boolean) as string[])]
    const rtCusts = rtCustIds.length ? await prisma.customer.findMany({ where: { id: { in: rtCustIds } }, select: { id: true, name: true } }) : []
    const rtMap = new Map(rtCusts.map((c) => [c.id, c.name]))
    const readyToReturn = processingOrders
      .filter((o) => o.items.length > 0 && o.items.every((i) => i.processingStage === "PACKED" && i.processingStatus === "DONE"))
      .map((o) => ({ id: o.id, orderNumber: o.orderNumber, customer: o.customerId ? rtMap.get(o.customerId) || null : null, items: o.items.length, toStore: o.store?.storeName || null, packetNumber: o.packet?.packetNumber || null }))

    // Awaiting Audit & Barcode Generation — received, not yet moved to processing.
    const abOrders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, items: { some: { processingStage: "RECEIVED" } } },
      select: { id: true, orderNumber: true, customerId: true, items: { where: { processingStage: "RECEIVED" }, select: { id: true, barcodeGenerated: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    })
    const abCustIds = [...new Set(abOrders.map((o) => o.customerId).filter(Boolean) as string[])]
    const abCusts = abCustIds.length ? await prisma.customer.findMany({ where: { id: { in: abCustIds } }, select: { id: true, name: true } }) : []
    const abMap = new Map(abCusts.map((c) => [c.id, c.name]))
    const awaitingBarcode = abOrders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, customer: o.customerId ? abMap.get(o.customerId) || null : null, items: o.items.length, barcoded: o.items.filter((i) => i.barcodeGenerated).length }))

    // Per-stage counts across all received garments.
    const grouped = await prisma.laundryOrderItem.groupBy({
      by: ["processingStage"],
      where: { order: { businessId: biz.id }, processingStage: { not: null } },
      _count: true,
    })
    const stageCounts: Record<string, number> = {}
    for (const w of WORKSTATIONS) stageCounts[w] = 0
    grouped.forEach((g) => { if (g.processingStage) stageCounts[g.processingStage] = g._count })

    // Garments in the requested workstation queue.
    let items: unknown[] = []
    if (stage) {
      const rows = await prisma.laundryOrderItem.findMany({
        where: { order: { businessId: biz.id }, processingStage: stage },
        include: { order: { select: { orderNumber: true, customerId: true } } },
        orderBy: { receivedAt: "asc" }, take: 100,
      })
      const cid = [...new Set(rows.map((r) => r.order.customerId).filter(Boolean) as string[])]
      const cs = cid.length ? await prisma.customer.findMany({ where: { id: { in: cid } }, select: { id: true, name: true } }) : []
      const cm = new Map(cs.map((c) => [c.id, c.name]))
      items = rows.map((r) => ({
        id: r.id, itemNumber: r.itemNumber, barcode: r.barcode, garmentName: r.garmentName,
        serviceName: r.serviceName, quantity: r.quantity, orderNumber: r.order.orderNumber,
        customer: r.order.customerId ? cm.get(r.order.customerId) || null : null,
        processingStage: r.processingStage, processingStatus: r.processingStatus, processFlow: r.processFlow,
        stageLabel: stageLabel(r.processingStage), department: departmentFor(r.processingStage),
      }))
    }

    return NextResponse.json({ success: true, incoming, awaitingBarcode, readyToReturn, stageCounts, items })
  } catch (e) {
    console.error("[laundry-processing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
