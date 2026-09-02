// GET /api/laundry/processing?businessId=&stage=
// Processing Center overview: orders waiting to be received, per-stage garment
// counts, and the garments in a given workstation queue.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { WORKSTATIONS, stageLabel, departmentFor, isProcessingTerminal, TERMINAL_STAGE } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getTransportModes, transportRefsForOrders } from "@/lib/laundry-transport-server"
import { ensureBusinessCode } from "@/lib/business-code"

export const runtime = "nodejs"

const STAGE_SCREEN: Record<string, string> = { WASH: "washing", DRY: "quality_check", DRYCLEAN: "dry_cleaning", IRON: "ironing", FOLD: "folding", QC: "quality_check", SORTING: "sorting", PACKED: "transit", DISPATCHED: "transit" }

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    const stage = sp.get("stage")
    // Workstations that own MORE than one stage (Dry & Quality Check owns DRY
    // and QC) pass them all, so the workload is aggregated in ONE pass. Summing
    // two single-stage responses would double-count any garment that completed
    // at both stages. Defaults to the requested stage.
    const workloadStages = (sp.get("stages") || stage || "").split(",").map((x) => x.trim()).filter(Boolean)
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, stage ? `processing.${STAGE_SCREEN[stage] || "washing"}.view` : "processing.console_receive.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, incoming: [], awaitingBarcode: [], readyToReturn: [], stageCounts: {}, items: [] })
    const bizSettings = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { workstationScanSound: true } })
    // THE CANONICAL Business Code, for the Order-wise lookup prefix.
    //
    // Read from the PLATFORM Business row, never from LaundryBusiness — that
    // column may still carry the workspace's retired LND-… product code, while
    // store codes (and therefore order numbers) embed the canonical BUS-… one:
    //
    //   ensureBusinessCode -> BUS-YYYYMM-NNNN
    //     -> generateStoreCode   -> STR-BUS-YYYYMM-NNNN-NNN
    //       -> generateOrderNumber -> ORD-STR-BUS-YYYYMM-NNNN-NNN-NNNNNN
    //
    // Reading LaundryBusiness.businessCode prefilled ORD-STR-LND-… and every
    // lookup missed. This is the same resolution the store-creation route uses,
    // so the prefix is built from the SAME context that generated the numbers.
    const canonicalBusinessCode = biz.platformBusinessId
      ? await ensureBusinessCode(biz.platformBusinessId)
      : null

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
    // FIND ONE GARMENT BY ITS CODE.
    //
    // Kept as a standalone filter rather than spread into the where, because it
    // is an OR and two of the bucket queries below carry an OR of their own —
    // spreading silently REPLACED this one and the search vanished for those
    // rows. It is composed under AND instead, which cannot clash.
    //
    // `contains` maps to SQL LIKE, which SQLite evaluates case-insensitively for
    // ASCII, so gar000000000331 finds GAR000000000331 and a partial "331" finds
    // it too. `search` is already trimmed above.
    const searchFilter = search
      ? { OR: [
          { garmentScanCode: { contains: search } },  // GAR — the operator's main handle
          { itemNumber: { contains: search } },       // ITM
          { barcode: { contains: search } },
          { garmentName: { contains: search } },
          { order: { orderNumber: { contains: search } } },
        ] }
      : null

    // Garments in the requested workstation queue + this stage's COMPLETED history.
    let items: unknown[] = []
    let completed: unknown[] = []
    let queueCounts: Record<string, number> = {}
    type WlBucket = { garments: number; weightKg: number; missingWeight: number }
    let workload: { pending: WlBucket; processing: WlBucket; completed: WlBucket } | null = null
    if (stage) {
      // ONE CAPPED QUERY CANNOT FEED THREE COLUMNS.
      //
      // This was a single findMany({ take: 100 }) ordered by receivedAt across
      // every status at the stage. With 467 garments waiting at Washing and 2 in
      // progress, the cap was filled entirely by WAITING rows and the two
      // IN_PROGRESS garments never reached the client: the screen showed
      // "Waiting 100 / In Progress 0" while the scanner — which looks a garment
      // up directly — correctly said "already In Progress".
      //
      // Each bucket is now fetched on its own, so a backlog in one can never
      // starve another out of the payload.
      // The queue itself — no search. The counts below use THIS, so the workload
      // figures keep showing the real department load while an operator is
      // looking one garment up.
      const queueWhere = { order: { businessId: biz.id }, processingStage: stage }
      // The rows to render: the queue, narrowed by the search when there is one.
      const baseWhere = searchFilter ? { ...queueWhere, AND: [searchFilter] } : queueWhere
      const ACTIVE_STATUSES = ["IN_PROGRESS", "PAUSED"]
      const QUEUE_STATUSES = ["WAITING", ...ACTIVE_STATUSES]
      // totalWeightKg is the ORDER's recorded weight (measured at Store Audit).
      // It is a scalar on the order the row already joins, so this adds no
      // query. Sorting shows it per order card; it is never summed from the
      // garments and never derived from their count.
      const rowInclude = { order: { select: { orderNumber: true, customerId: true, totalWeightKg: true } } }
      // Sorting is the garment→bag transition: a partially scanned order MUST stay
      // on the queue until its Sorting work actually completes. The generic page
      // cap (take 200 per bucket, oldest first) silently dropped the NEWEST
      // Sorting orders — exactly the ones being scanned — while Sorting's own
      // rehydration endpoint already reads the whole stage uncapped. Sorting reads
      // the full stage; every other workstation keeps the page cap.
      const rowsTake = stage === "SORTING" ? 5000 : 200
      const [waitingRows, activeRows, otherRows] = await Promise.all([
        prisma.laundryOrderItem.findMany({ where: { ...baseWhere, processingStatus: "WAITING" }, include: rowInclude, orderBy: { receivedAt: "asc" }, take: rowsTake }),
        // Everything an operator has open. In practice a handful; capped only so
        // a pathological queue cannot return unbounded rows.
        prisma.laundryOrderItem.findMany({ where: { ...baseWhere, processingStatus: { in: ACTIVE_STATUSES } }, include: rowInclude, orderBy: { receivedAt: "asc" }, take: rowsTake }),
        // Any other status at this stage (or none yet). Sorting renders every
        // item regardless of status, so dropping these would empty that screen.
        prisma.laundryOrderItem.findMany({
          where: { ...baseWhere, OR: [{ processingStatus: { notIn: QUEUE_STATUSES } }, { processingStatus: null }] },
          include: rowInclude, orderBy: { receivedAt: "asc" }, take: rowsTake,
        }),
      ])
      const rows = [...activeRows, ...waitingRows, ...otherRows]

      // TRUE counts, straight from the database and independent of the caps
      // above — so a column's number is the real number even when its list is
      // showing only the first page of a long queue.
      const queueGrouped = await prisma.laundryOrderItem.groupBy({
        by: ["processingStatus"],
        where: queueWhere,
        _count: true,
      })
      queueCounts = { WAITING: 0, IN_PROGRESS: 0, PAUSED: 0 }
      for (const q of queueGrouped) queueCounts[q.processingStatus ?? "UNSET"] = q._count
      queueCounts.active = (queueCounts.IN_PROGRESS || 0) + (queueCounts.PAUSED || 0)

      // ── WORKLOAD: counts AND weights, aggregated in the database ───────────
      //
      // The summary tiles used to sum the weight of the rows that happened to
      // be on the page, so on a 400-garment queue they described the first 200.
      // These are SQL aggregates over the whole stage, so the figures stay true
      // however long the queue gets.
      //
      // weightKg defaults to 0 in the schema, so "recorded" means a POSITIVE
      // weight and everything else is counted as missing rather than summed as
      // zero — the same rule the client helper applies.
      const stageScope = { order: { businessId: biz.id }, processingStage: { in: workloadStages } }
      const ACTIVE = { in: ["IN_PROGRESS", "PAUSED"] }
      const [liveAgg, liveMissing] = await Promise.all([
        prisma.laundryOrderItem.groupBy({ by: ["processingStatus"], where: stageScope, _count: true, _sum: { weightKg: true } }),
        prisma.laundryOrderItem.groupBy({ by: ["processingStatus"], where: { ...stageScope, weightKg: { lte: 0 } }, _count: true }),
      ])
      const bucket = () => ({ garments: 0, weightKg: 0, missingWeight: 0 })
      const pending = bucket(), processing = bucket(), completedWl = bucket()
      for (const g of liveAgg) {
        const t = g.processingStatus === "WAITING" ? pending : (g.processingStatus === "IN_PROGRESS" || g.processingStatus === "PAUSED") ? processing : null
        if (!t) continue
        t.garments += g._count
        t.weightKg += g._sum.weightKg ?? 0
      }
      for (const g of liveMissing) {
        const t = g.processingStatus === "WAITING" ? pending : (g.processingStatus === "IN_PROGRESS" || g.processingStatus === "PAUSED") ? processing : null
        if (t) t.missingWeight += g._count
      }

      // COMPLETED — the garments that finished at these stages. Distinct by
      // garment (a rework produces two COMPLETE events for one garment), and
      // excluding any that are back in this stage's live queue, so nothing is
      // counted in two buckets at once.
      const doneRows = await prisma.laundryItemEvent.findMany({
        where: { businessId: biz.id, stage: { in: workloadStages }, action: { in: ["COMPLETE", "QC_PASS"] } },
        select: { itemId: true },
        distinct: ["itemId"],
      })
      const doneIds = doneRows.map((d) => d.itemId)
      // Chunked: SQLite caps the number of bound variables in one statement.
      for (let i = 0; i < doneIds.length; i += 400) {
        const slice = doneIds.slice(i, i + 400)
        const where = { id: { in: slice }, NOT: { processingStage: { in: workloadStages } } }
        const [agg, miss] = await Promise.all([
          prisma.laundryOrderItem.aggregate({ where, _count: true, _sum: { weightKg: true } }),
          prisma.laundryOrderItem.count({ where: { ...where, weightKg: { lte: 0 } } }),
        ])
        completedWl.garments += agg._count
        completedWl.weightKg += agg._sum.weightKg ?? 0
        completedWl.missingWeight += miss
      }

      const r2w = (n: number) => Math.round(n * 100) / 100
      workload = {
        pending:    { ...pending,    weightKg: r2w(pending.weightKg) },
        processing: { ...processing, weightKg: r2w(processing.weightKg) },
        completed:  { ...completedWl, weightKg: r2w(completedWl.weightKg) },
      }
      const cid = [...new Set(rows.map((r) => r.order.customerId).filter(Boolean) as string[])]
      const cs = cid.length ? await prisma.customer.findMany({ where: { id: { in: cid } }, select: { id: true, name: true } }) : []
      const cm = new Map(cs.map((c) => [c.id, c.name]))
      items = rows.map((r) => ({
        id: r.id, itemNumber: r.itemNumber, barcode: r.barcode, garmentScanCode: r.garmentScanCode, garmentName: r.garmentName,
        // The garment's OWN service id as well as its name. Sorting groups an
        // order's bags by service, and a name alone cannot tell two services
        // apart reliably once one is renamed.
        serviceId: r.serviceId, serviceName: r.serviceName, quantity: r.quantity, orderId: r.orderId, orderNumber: r.order.orderNumber,
        customer: r.order.customerId ? cm.get(r.order.customerId) || null : null,
        // The ORDER's recorded total weight, repeated on each of its rows so the
        // Sorting card can show it without a second request. Read as stored.
        orderTotalWeightKg: r.order.totalWeightKg,
        processingStage: r.processingStage, processingStatus: r.processingStatus, processFlow: r.processFlow,
        // The garment's OWN recorded weight, in kg, exactly as stored — read
        // only, never derived or defaulted. Feeds the workstation workload
        // summary; nothing writes it here.
        weightKg: r.weightKg,
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
        ? await prisma.laundryOrderItem.findMany({ where: { id: { in: evIds } }, select: { id: true, itemNumber: true, barcode: true, garmentScanCode: true, garmentName: true, serviceName: true, weightKg: true, order: { select: { orderNumber: true } } } })
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
            weightKg: it?.weightKg ?? null,
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

    return NextResponse.json({ success: true, incoming, awaitingBarcode, readyToReturn, stageCounts, items, completed, queueCounts, workload, transportModes, soundEnabled: bizSettings?.workstationScanSound ?? true, businessCode: canonicalBusinessCode })
  } catch (e) {
    console.error("[laundry-processing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
