// GET /api/laundry/processing?businessId=&stage=
// Processing Center overview: orders waiting to be received, per-stage garment
// counts, and the garments in a given workstation queue.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { WORKSTATIONS, stageLabel, departmentFor, isProcessingTerminal, TERMINAL_STAGE } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportModes, transportRefsForOrders } from "@/lib/laundry-transport-server"

export const runtime = "nodejs"

const STAGE_SCREEN: Record<string, string> = { WASH: "washing", DRY: "quality_check", DRYCLEAN: "dry_cleaning", IRON: "ironing", FOLD: "folding", QC: "quality_check", SORTING: "sorting", PACKED: "transit", DISPATCHED: "transit" }

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
    const bizSettings = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { workstationScanSound: true } })

    // Transport Setup decides which identifier the console shows and scans:
    // inbound packages use the Store → Processing mode, returns the reverse.
    const transportModes = await getTransportModes(biz.id)

    // Incoming = DISPATCHED packages only (order IN_TRANSIT_TO_PROCESSING).
    // An undispatched order is NOT receivable — work-queue integrity.
    const incomingOrders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, status: "IN_TRANSIT_TO_PROCESSING" },
      select: { id: true, orderNumber: true, status: true, storeId: true, customerId: true, createdAt: true, _count: { select: { items: true } }, store: { select: { storeName: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    })
    const custIds = [...new Set(incomingOrders.map((o) => o.customerId).filter(Boolean) as string[])]
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : []
    const cmap = new Map(custs.map((c) => [c.id, c.name]))
    const inRefs = await transportRefsForOrders(biz.id, incomingOrders.map((o) => o.id), transportModes.storeToProcessing)
    // Dispatch time comes from the audit log when there is no packet row to
    // carry it (BAG mode) — the event exists in every transport mode.
    const dispatchEvents = incomingOrders.length
      ? await prisma.laundryOrderEvent.findMany({
          where: { businessId: biz.id, action: "DISPATCH_TO_PROCESSING", orderId: { in: incomingOrders.map((o) => o.id) } },
          orderBy: { createdAt: "desc" }, select: { orderId: true, createdAt: true },
        })
      : []
    const dispatchedAtMap = new Map<string, Date>()
    for (const e of dispatchEvents) if (!dispatchedAtMap.has(e.orderId)) dispatchedAtMap.set(e.orderId, e.createdAt)
    const incoming = incomingOrders.map((o) => {
      const transport = inRefs.get(o.id) || null
      return { id: o.id, orderNumber: o.orderNumber, status: o.status, items: o._count.items, customer: o.customerId ? cmap.get(o.customerId) || null : null, createdAt: o.createdAt, transport, transportCode: transport?.code || null, dispatchedAt: dispatchedAtMap.get(o.id) || null, fromStore: o.store?.storeName || null }
    })

    // Ready to Return = every garment finished its route (Transit terminal /
    // legacy Packed) but the order is still at the Processing Center.
    const processingOrders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, status: "PROCESSING" },
      select: { id: true, orderNumber: true, customerId: true, store: { select: { storeName: true } }, items: { select: { processingStage: true, processingStatus: true } } },
      orderBy: { createdAt: "asc" }, take: 100,
    })
    const rtCustIds = [...new Set(processingOrders.map((o) => o.customerId).filter(Boolean) as string[])]
    const rtCusts = rtCustIds.length ? await prisma.customer.findMany({ where: { id: { in: rtCustIds } }, select: { id: true, name: true } }) : []
    const rtMap = new Map(rtCusts.map((c) => [c.id, c.name]))
    const returnable = processingOrders.filter((o) => o.items.length > 0 && o.items.every((i) => isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE"))
    // Return leg → Processing Center → Store mode.
    const outRefs = await transportRefsForOrders(biz.id, returnable.map((o) => o.id), transportModes.processingToStore)
    const readyToReturn = returnable.map((o) => {
      const transport = outRefs.get(o.id) || null
      return { id: o.id, orderNumber: o.orderNumber, customer: o.customerId ? rtMap.get(o.customerId) || null : null, items: o.items.length, toStore: o.store?.storeName || null, transport, transportCode: transport?.code || null }
    })

    // Awaiting Barcode Generation — received, not yet moved to processing.
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

    // Optional search by item code (barcode / GAR / ITM) or garment name.
    const search = (sp.get("search") || "").trim()
    const codeOr = search
      ? { OR: [
          { barcode: { contains: search } },
          { itemNumber: { contains: search } },
          { garmentScanCode: { contains: search } },
          { garmentName: { contains: search } },
        ] }
      : {}

    // Garments in the requested workstation queue + this stage's COMPLETED history.
    let items: unknown[] = []
    let completed: unknown[] = []
    if (stage) {
      const rows = await prisma.laundryOrderItem.findMany({
        where: { order: { businessId: biz.id }, processingStage: stage, ...codeOr },
        include: { order: { select: { orderNumber: true, customerId: true } } },
        orderBy: { receivedAt: "asc" }, take: 100,
      })
      const cid = [...new Set(rows.map((r) => r.order.customerId).filter(Boolean) as string[])]
      const cs = cid.length ? await prisma.customer.findMany({ where: { id: { in: cid } }, select: { id: true, name: true } }) : []
      const cm = new Map(cs.map((c) => [c.id, c.name]))
      items = rows.map((r) => ({
        id: r.id, itemNumber: r.itemNumber, barcode: r.barcode, garmentScanCode: r.garmentScanCode, garmentName: r.garmentName,
        serviceName: r.serviceName, quantity: r.quantity, orderId: r.orderId, orderNumber: r.order.orderNumber,
        customer: r.order.customerId ? cm.get(r.order.customerId) || null : null,
        processingStage: r.processingStage, processingStatus: r.processingStatus, processFlow: r.processFlow,
        stageLabel: stageLabel(r.processingStage), department: departmentFor(r.processingStage),
      }))

      // Persisted completed history: every garment finished AT this stage (COMPLETE,
      // or QC_PASS at the QC stage), newest first — survives refresh, unlike the
      // per-session list the UI used to show.
      const events = await prisma.laundryItemEvent.findMany({
        where: { businessId: biz.id, stage, action: { in: ["COMPLETE", "QC_PASS"] } },
        orderBy: { createdAt: "desc" }, take: 100,
      })
      const evIds = [...new Set(events.map((e) => e.itemId))]
      const evItems = evIds.length
        ? await prisma.laundryOrderItem.findMany({ where: { id: { in: evIds } }, select: { id: true, itemNumber: true, barcode: true, garmentScanCode: true, garmentName: true, serviceName: true, order: { select: { orderNumber: true } } } })
        : []
      const em = new Map(evItems.map((i) => [i.id, i]))
      const q = search.toLowerCase()
      completed = events
        .map((e) => {
          const it = em.get(e.itemId)
          return {
            id: e.id, itemId: e.itemId,
            itemNumber: it?.itemNumber || null, barcode: it?.barcode || null, garmentScanCode: it?.garmentScanCode || null,
            garmentName: it?.garmentName || "Garment", serviceName: it?.serviceName || null,
            orderNumber: it?.order.orderNumber || null,
            action: e.action, actorName: e.actorName || null, completedAt: e.createdAt,
            // Where the garment moved to after finishing this stage — so staff can
            // see where it went, not just "it's gone". The terminal (Transit /
            // legacy Packed) = processing finished (no per-garment packing queue;
            // the ORDER is dispatched in Transit / packed in Store Packing & QR).
            toStage: e.toStage || null,
            toStageLabel: e.toStage && isProcessingTerminal(e.toStage) ? "Processing complete" : e.toStage ? stageLabel(e.toStage) : null,
          }
        })
        .filter((c) => !q || [c.itemNumber, c.barcode, c.garmentScanCode, c.garmentName, c.orderNumber].some((v) => (v || "").toLowerCase().includes(q)))
    }

    return NextResponse.json({ success: true, incoming, awaitingBarcode, readyToReturn, stageCounts, items, completed, transportModes, soundEnabled: bizSettings?.workstationScanSound ?? true })
  } catch (e) {
    console.error("[laundry-processing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
