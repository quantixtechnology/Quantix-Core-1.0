// POST /api/laundry/processing/sorting — the SORTING workstation.
//
// Sorting is the permanent garment→bag transition point of the approved
// operational model. The operator scans EVERY garment of an order (garment
// barcodes are still the tracking identity here); when the scanned set equals
// the expected count, ONE laundry bag is scanned and bound to the order
// (1 order = 1 bag). The system then retires every garment barcode and advances
// every garment past Sorting — from that moment only the bag QR is valid, and
// Iron / Fold / Transit operate on the bag.
//
// Body: { businessId, action, code, actorName?, scanned? }
//   action = "scan"        — validate a GARMENT barcode at Sorting (returns the
//                            resolved garment + the order's expected count)
//   action = "assign_bag"  — verify the scanned set equals the order, bind the
//                            ONE finishing bag, retire garment barcodes, advance
//                            every garment to its next stage
//
// Server enforcements (authoritative, never UI-only):
//   • scanned garment must belong to THIS business and be AT the Sorting stage
//   • garment barcodes are invalid once the order's bag is assigned (retired)
//   • bag assignment requires the scanned set to cover every garment of the order
//   • one active bag per order; the scanned bag must belong to THIS order
//   • scan-mode gate (Bag / Processing Package / Both) is the workspace setting
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { stageLabel, nextStageOf, departmentFor, TERMINAL_STAGE } from "@/lib/laundry-processing"
import { assignFinishingBag, syncPackageLifecycle } from "@/lib/laundry-finishing"
import { orderBags } from "@/lib/laundry-order-bags"
import { activeBagForService, bagAtTime, sortingBagsEver, type SortingBagRow } from "@/lib/laundry-sorting-bags"

export const runtime = "nodejs"

// THE persisted record of "this garment was scanned at Sorting".
//
// Progress used to live only in React state, so a refresh showed 0 / 27 and the
// operator had to scan the order again. It is now one LaundryItemEvent per
// garment — the per-garment event trail this route already writes — which makes
// the server the source of truth, survives a refresh, a new tab, a different
// device and a different operator, and needs no schema change. It is append-only
// and additive: nothing else reads this action, and the garment's own stage and
// status are untouched, so no other workstation, queue or count changes.
const SCAN_ACTION = "SORTING_SCAN"

/** Every garment of these orders already scanned at Sorting, oldest first. */
async function scannedEvents(businessId: string, orderIds: string[]) {
  if (!orderIds.length) return []
  return prisma.laundryItemEvent.findMany({
    where: { businessId, action: SCAN_ACTION, orderId: { in: orderIds } },
    orderBy: { createdAt: "asc" },
    select: { itemId: true, orderId: true, createdAt: true },
  })
}


const ITEM_SELECT = { id: true, itemNumber: true, barcode: true, garmentScanCode: true, garmentName: true, serviceId: true, serviceName: true, quantity: true, processFlow: true, processingStage: true, order: { select: { id: true, orderNumber: true, businessId: true } } } as const

/**
 * GET /api/laundry/processing/sorting?businessId=&recent=
 *
 * REHYDRATION. Everything the workstation needs to come back exactly as the
 * operator left it: which garments are already scanned, the last few scans with
 * their full context, and every order's bags. All of it read from persisted
 * records, so a refresh, a second tab, another device or another operator all
 * see the same state.
 *
 * Read-only: it scans nothing, assigns nothing and advances nothing.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const businessId = url.searchParams.get("businessId")
    const recentLimit = Math.min(Math.max(Number(url.searchParams.get("recent")) || 5, 1), 25)
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "processing.sorting.process")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // ── SORTING HISTORY — successful completions only ────────────────────────
    //
    // THE QUALIFYING RECORD is the LaundryOrderEvent this route writes with
    // action "SORTING_COMPLETE" — the only place in the codebase that writes it,
    // and written LAST: after every server-side gate has passed (every garment
    // at Sorting, every garment scanned), after the bag is bound, and after the
    // garments have actually been advanced out of the stage.
    //
    // It is deliberately NOT LaundryProcessingPackage.bagAssigned. That flag is
    // set by assignFinishingBag(), which has TWO callers: this route, and
    // /api/laundry/processing/finishing-bag, which binds the same bag under the
    // same gates but does NOT advance the garments. An order bound that way has
    // had a bag assigned without completing the stage — it is still at Sorting,
    // and still on the active queue. Keying History on bagAssigned would have
    // listed it as completed and shown it in both places at once.
    //
    // THE BAGS come from LaundryBagAssignment via the shared orderBags() reader,
    // filtered by sortingBagsEver() — every row this order was given AT SORTING,
    // oldest first, including ones since released. A transport or delivery bag is
    // never included and no bag is reconstructed or inferred.
    //
    // Read-only, like the rest of this GET: it scans nothing, assigns nothing,
    // advances nothing and writes nothing.
    if (url.searchParams.get("history")) {
      const search = (url.searchParams.get("search") || "").trim()
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200)

      // A search may name the order or one of its bags. Both resolve to order
      // ids first, because the completion event itself carries neither.
      let scope: string[] | null = null
      if (search) {
        const [byNumber, byBag] = await Promise.all([
          prisma.laundryOrder.findMany({ where: { businessId: biz.id, orderNumber: { contains: search } }, select: { id: true }, take: 200 }),
          prisma.laundryBagAssignment.findMany({
            where: { businessId: biz.id, purpose: "SORTING", bag: { bagNumber: { contains: search } } },
            select: { orderId: true }, take: 200,
          }),
        ])
        scope = [...new Set([...byNumber.map((o) => o.id), ...byBag.map((a) => a.orderId)])]
        if (scope.length === 0) return NextResponse.json({ success: true, history: [] })
      }

      const completions = await prisma.laundryOrderEvent.findMany({
        where: { businessId: biz.id, action: "SORTING_COMPLETE", ...(scope ? { orderId: { in: scope } } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit * 2, // room to collapse any repeats before slicing
        select: { orderId: true, createdAt: true, actorName: true },
      })
      // ONE row per order. A re-submitted completion returns early long before
      // this event is written, but history must not double-count if one ever is.
      const seen = new Set<string>()
      const latest = completions.filter((e) => (seen.has(e.orderId) ? false : (seen.add(e.orderId), true))).slice(0, limit)

      const histOrders = latest.length
        ? await prisma.laundryOrder.findMany({
            where: { id: { in: latest.map((e) => e.orderId) }, businessId: biz.id },
            select: { id: true, orderNumber: true, status: true, customerId: true, _count: { select: { items: true } } },
          })
        : []
      const byOrder = new Map(histOrders.map((o) => [o.id, o]))
      const custIds = [...new Set(histOrders.map((o) => o.customerId).filter(Boolean) as string[])]
      const custNames = new Map(
        (custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : [])
          .map((c) => [c.id, c.name]),
      )

      const history = await Promise.all(latest.map(async (e) => {
        const order = byOrder.get(e.orderId)
        const rows = (await orderBags(biz.id, e.orderId)) as SortingBagRow[]
        // Completion requires every garment to have been scanned at Sorting, so
        // scanned and expected are equal by construction — both are reported so
        // the card can show "18 / 18" without the client inferring either.
        const expected = order?._count.items ?? 0
        return {
          orderId: e.orderId,
          orderNumber: order?.orderNumber ?? null,
          customer: order?.customerId ? custNames.get(order.customerId) || null : null,
          garments: expected,
          expected,
          sortingBags: sortingBagsEver(rows).map((b) => b.bagNumber),
          completedAt: e.createdAt,
          completedBy: e.actorName,
          orderStatus: order?.status ?? null,
          status: "COMPLETED" as const,
        }
      }))

      return NextResponse.json({ success: true, history })
    }

    // The orders currently at Sorting — the only ones this screen shows.
    const atSorting = await prisma.laundryOrderItem.findMany({
      where: { processingStage: "SORTING", order: { businessId: biz.id } },
      select: { id: true, orderId: true },
    })
    const orderIds = [...new Set(atSorting.map((i) => i.orderId))]

    const events = await scannedEvents(biz.id, orderIds)
    // Only garments still AT Sorting count — an order whose bag was bound has
    // moved on, and its events are history rather than progress.
    const live = new Set(atSorting.map((i) => i.id))
    const scanned: Record<string, string[]> = {}
    for (const e of events) {
      if (!live.has(e.itemId)) continue
      ;(scanned[e.orderId] ||= []).push(e.itemId)
    }

    // Every order's bags, in one pass, so the client never has to ask per order.
    const bags: Record<string, SortingBagRow[]> = {}
    await Promise.all(orderIds.map(async (id) => { bags[id] = (await orderBags(biz.id, id)) as SortingBagRow[] }))

    // Scan times per order+service, so each bag can report what it holds.
    const scanTimes: Record<string, string> = {}
    for (const e of events) if (live.has(e.itemId)) scanTimes[e.itemId] = e.createdAt.toISOString()

    // LAST N SCANS, newest first, with everything needed to place the garment.
    const recentEvents = [...events].filter((e) => live.has(e.itemId)).reverse().slice(0, recentLimit)
    const recentItems = recentEvents.length
      ? await prisma.laundryOrderItem.findMany({
          where: { id: { in: recentEvents.map((e) => e.itemId) } },
          select: {
            id: true, garmentName: true, barcode: true, itemNumber: true, garmentScanCode: true,
            serviceId: true, serviceName: true,
            order: { select: { id: true, orderNumber: true, customerId: true } },
          },
        })
      : []
    const customerIds = [...new Set(recentItems.map((i) => i.order.customerId).filter(Boolean) as string[])]
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } })
      : []
    const nameOf = new Map(customers.map((c) => [c.id, c.name]))
    const itemById = new Map(recentItems.map((i) => [i.id, i]))
    // How far the order had got AT THAT MOMENT — counted from the trail itself,
    // so the history reads 23/27, 24/27 … exactly as the operator saw it.
    const progressAt = new Map<string, number>()
    const running: Record<string, number> = {}
    for (const e of events) {
      if (!live.has(e.itemId)) continue
      running[e.orderId] = (running[e.orderId] || 0) + 1
      progressAt.set(e.itemId, running[e.orderId])
    }
    const expectedByOrder: Record<string, number> = {}
    for (const i of atSorting) expectedByOrder[i.orderId] = (expectedByOrder[i.orderId] || 0) + 1

    const recent = recentEvents.flatMap((e) => {
      const it = itemById.get(e.itemId)
      if (!it) return []
      return [{
        itemId: it.id,
        garmentName: it.garmentName,
        gar: it.garmentScanCode || it.barcode || it.itemNumber || "",
        serviceId: it.serviceId,
        serviceName: it.serviceName,
        orderId: it.order.id,
        orderNumber: it.order.orderNumber,
        customer: it.order.customerId ? nameOf.get(it.order.customerId) ?? null : null,
        // The bag that was active WHEN IT WAS SCANNED — never the bag that
        // happens to be active now, so history is not rewritten by a later bag.
        bagNumber: bagAtTime(bags[it.order.id] || [], it.serviceId, it.serviceName, e.createdAt)?.bagNumber ?? null,
        scannedCount: progressAt.get(it.id) ?? 0,
        expected: expectedByOrder[it.order.id] ?? 0,
        at: e.createdAt.toISOString(),
      }]
    })

    return NextResponse.json({ success: true, data: { scanned, bags, recent, scanTimes } })
  } catch (e) {
    console.error("[laundry-sorting] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = String(b.businessId || "")
    const action = String(b.action || "")
    const code = String(b.code || "").trim().toUpperCase()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 })
    if (!code) return NextResponse.json({ error: "Scan a barcode to continue." }, { status: 400 })

    const guard = await requireLaundryPermission(request, businessId, "processing.sorting.process")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const bizRow = await prisma.laundryBusiness.findUnique({ where: { id: biz.id }, select: { processingPackageQrMode: true } })
    const mode = bizRow?.processingPackageQrMode || "GENERATE_NEW"

    if (action === "scan") {
      // ── Garment scan at Sorting ────────────────────────────────────────────
      const item = await prisma.laundryOrderItem.findFirst({
        where: { OR: [{ garmentScanCode: code }, { barcode: code }, { itemNumber: code }] },
        select: ITEM_SELECT,
      })
      if (!item) return NextResponse.json({ success: false, error: `No garment found for barcode "${code}"` }, { status: 404 })
      if (item.order.businessId !== biz.id)
        return NextResponse.json({ success: false, error: "This garment belongs to a different business." }, { status: 404 })
      if (item.processingStage !== "SORTING")
        return NextResponse.json({ success: false, error: `"${item.garmentName}" is not ready for Sorting — it is at ${stageLabel(item.processingStage)}.` }, { status: 409 })

      const expected = await prisma.laundryOrderItem.count({
        where: { orderId: item.order.id, processingStage: "SORTING" },
      })

      // ALREADY SCANNED — answered from the persisted trail, not from whatever
      // the browser happens to remember, so a refresh cannot resurrect a garment
      // and two operators cannot both count the same one.
      const prior = await prisma.laundryItemEvent.findFirst({
        where: { businessId: biz.id, action: SCAN_ACTION, itemId: item.id },
        select: { id: true },
      })
      if (prior) {
        const scannedCount = await prisma.laundryItemEvent.count({
          where: { businessId: biz.id, action: SCAN_ACTION, orderId: item.order.id },
        })
        return NextResponse.json({
          success: false, code: "ALREADY_SCANNED",
          error: `"${item.garmentName}" is already scanned for ${item.order.orderNumber}.`,
          data: { scannedCount, expected },
        }, { status: 409 })
      }

      // Record it BEFORE answering. The operator's count and the database can
      // then never disagree: if this write fails the scan fails, rather than
      // showing progress that disappears on the next refresh.
      const event = await prisma.laundryItemEvent.create({
        data: {
          itemId: item.id, orderId: item.order.id, businessId: biz.id,
          stage: "SORTING", action: SCAN_ACTION, department: departmentFor("SORTING"),
          actorName: b.actorName || null,
          note: `Sorted at Sorting: ${item.garmentName}`,
        },
        select: { createdAt: true },
      })
      const scannedCount = await prisma.laundryItemEvent.count({
        where: { businessId: biz.id, action: SCAN_ACTION, orderId: item.order.id },
      })

      // WHICH BAG this garment goes in, resolved server-side from the order's
      // own assignment rows so every client agrees. Null = this service has no
      // bag yet, which is the BAG REQUIRED prompt.
      const bags = (await orderBags(biz.id, item.order.id)) as SortingBagRow[]
      const bag = activeBagForService(bags, item.serviceId, item.serviceName)

      return NextResponse.json({
        success: true,
        data: {
          itemId: item.id, garmentName: item.garmentName,
          // The GARMENT's own service — what the bag is filed against on a
          // multi-service order. Never the order's first service.
          serviceId: item.serviceId, serviceName: item.serviceName,
          barcode: item.garmentScanCode || item.barcode || item.itemNumber,
          orderId: item.order.id, orderNumber: item.order.orderNumber,
          expected, scannedCount,
          scannedAt: event.createdAt,
          bagNumber: bag?.bagNumber ?? null,
          bags,
        },
      })
    }

    if (action === "assign_bag") {
      // ── Bag assignment at Sorting ──────────────────────────────────────────
      const orderId = String(b.orderId || "")
      const scanned: string[] = Array.isArray(b.scanned) ? b.scanned.map((s: unknown) => String(s)) : []
      if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 })

      const order = await prisma.laundryOrder.findFirst({
        where: { id: orderId, businessId: biz.id },
        select: { id: true, orderNumber: true, status: true, _count: { select: { items: true } } },
      })
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
      if (order.status === "CANCELLED" || order.status === "DELIVERED")
        return NextResponse.json({ error: "This order is no longer in processing." }, { status: 409 })

      // Idempotent re-scan. A double-submit (operator taps twice, network
      // retry) must not fail the stage checks below — the first call has
      // already advanced the garments PAST Sorting, so those checks would
      // report "not every garment has reached Sorting" for an order that in
      // fact completed. Answer with the standing assignment instead.
      const standing = await prisma.laundryProcessingPackage.findFirst({
        where: { orderId: order.id, bagAssigned: true },
        select: { id: true, code: true, bagCode: true },
      })
      if (standing && (standing.bagCode || standing.code || "").toUpperCase() === code) {
        const retired = await prisma.laundryOrderItem.count({ where: { orderId: order.id, barcodeRetired: true } })
        return NextResponse.json({
          success: true,
          data: { packageId: standing.id, code: standing.code, bagCode: standing.bagCode || standing.code, retired, advanced: 0, alreadyAssigned: true },
        })
      }

      // Every garment must be AT Sorting (i.e. has passed Dry & Quality Check)
      // before the bag can be bound — no premature bag assignment.
      const atSorting = await prisma.laundryOrderItem.findMany({
        where: { orderId: order.id, processingStage: "SORTING" },
        select: { id: true },
      })
      if (atSorting.length !== order._count.items)
        return NextResponse.json({ error: "Assign the bag only after every garment in the order has reached Sorting (Dry & Quality Check complete)." }, { status: 409 })

      // Scanned set must cover the WHOLE order — the operator scanned every
      // garment. Compare id sets; a skipped garment blocks the bag.
      //
      // The client's list is UNIONED with the persisted trail rather than
      // replaced by it. The rule is unchanged — every garment at Sorting must
      // have been scanned — but it no longer depends on one browser's memory, so
      // an operator who refreshed, or who finished an order another operator
      // started, can still bind. A persisted id is a real scan, so this can
      // never let an unscanned garment through.
      const persisted = await scannedEvents(biz.id, [order.id])
      const scannedSet = new Set([...scanned, ...persisted.map((e) => e.itemId)])
      const missing = atSorting.filter((g) => !scannedSet.has(g.id))
      if (missing.length > 0)
        return NextResponse.json({ error: `${missing.length} garment(s) have not been scanned at Sorting yet — every garment must be scanned before the bag is assigned.` }, { status: 409 })

      // Bind a finishing bag (validates scan mode, bag ownership, availability).
      // allowMultiple: one order may need more than one physical bag, so a
      // second scan ATTACHES rather than being refused. Every other guard is
      // unchanged and still comes from assignBagToOrder.
      const result = await assignFinishingBag({ orderId: order.id, businessId: biz.id, code, mode, actorName: b.actorName || null, allowMultiple: true })
      if (!result.ok) {
        const status = result.code === "WRONG_ORDER" || result.code === "ALREADY_ASSIGNED" ? 409 : 400
        return NextResponse.json({ success: false, error: result.error }, { status })
      }

      // An ADDITIONAL bag adds capacity to an order whose garments already moved
      // on. Nothing to advance, nothing to retire — report the new bag list.
      if (result.addedBag) {
        return NextResponse.json({ success: true, data: { ...result, advanced: 0, addedBag: result.addedBag, totalBags: result.totalBags } })
      }

      // ── THE COMPLETION ITSELF — ONE TRANSACTION ──────────────────────────
      //
      // Advancing the garments out of Sorting and recording SORTING_COMPLETE are
      // the SAME fact and are now written together: either the order left the
      // stage and the completion is on the record, or neither happened. The
      // event used to be a best-effort write after the loop, so a failure there
      // produced an order that had left Sorting with nothing saying it ever
      // completed — invisible to History and unrecoverable, because the second
      // attempt finds nothing left at SORTING to advance.
      //
      // Every garment advances into its own SNAPSHOTTED route (Iron / Fold /
      // Transit terminal) — never a hardcoded transition. Garment barcodes were
      // retired by assignFinishingBag, so only the bag QR is valid from here on.
      //
      // Nothing here swallows an error any more: inside a transaction a
      // swallowed failure is the one thing that could still commit a half-done
      // completion. A throw rolls the whole thing back and the request fails,
      // which is the honest answer — the operator re-scans and, because the bag
      // binding above is idempotent, the retry completes cleanly.
      //
      // The bag BINDING is deliberately not inside this transaction: it goes
      // through assignBagToOrder(), the single bag writer, which opens its own
      // transaction and is shared with every other bag caller. Threading a
      // client through it would refactor that shared writer, and it is not
      // needed for the invariant — a binding that succeeds while this
      // transaction rolls back leaves the order NOT completed and still at
      // Sorting, which is a valid, retryable state and exactly what the
      // /finishing-bag endpoint already produces.
      let advanced = 0
      await prisma.$transaction(async (tx) => {
        advanced = 0
        const items = await tx.laundryOrderItem.findMany({
          where: { orderId: order.id },
          select: { id: true, processFlow: true, processingStage: true },
        })
        for (const item of items) {
          const flow = (() => { try { const a = JSON.parse(item.processFlow || "null"); return Array.isArray(a) ? a.map(String) : null } catch { return null } })()
          const nxt = flow ? nextStageOf(flow, "SORTING") : null
          const stage = nxt || TERMINAL_STAGE
          const updated = await tx.laundryOrderItem.updateMany({
            where: { id: item.id, processingStage: "SORTING" },
            data: { processingStage: stage, processingStatus: "WAITING", processingDept: departmentFor(stage) },
          })
          if (updated.count) {
            advanced++
            await tx.laundryItemEvent.create({
              data: {
                itemId: item.id, orderId: order.id, businessId: biz.id,
                stage: "SORTING", fromStage: "SORTING", toStage: stage, action: "SORTING_BAG_ASSIGNED",
                department: departmentFor(stage), actorName: b.actorName || null,
                note: `Bag ${code} assigned at Sorting; garment advanced to ${stageLabel(stage)}`,
              },
            })
          }
        }

        // ONE completion per order, enforced where it cannot race: a retry that
        // reaches this far finds the standing event and adds nothing, so History
        // can never show the same order twice.
        const done = await tx.laundryOrderEvent.findFirst({
          where: { orderId: order.id, action: "SORTING_COMPLETE" },
          select: { id: true },
        })
        if (!done) {
          await tx.laundryOrderEvent.create({
            data: {
              orderId: order.id, businessId: biz.id, fromStatus: order.status, toStatus: order.status,
              action: "SORTING_COMPLETE", actorName: b.actorName || null,
              note: `Sorting complete: ${advanced} garment(s) bound to bag ${code}`,
            },
          })
        }
      })

      await syncPackageLifecycle(order.id, biz.id).catch(() => null)

      return NextResponse.json({ success: true, data: { ...result, advanced } })
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
  } catch (e) {
    console.error("[laundry-sorting] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
