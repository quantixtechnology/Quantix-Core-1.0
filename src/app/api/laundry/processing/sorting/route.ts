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

export const runtime = "nodejs"

const ITEM_SELECT = { id: true, itemNumber: true, barcode: true, garmentScanCode: true, garmentName: true, serviceName: true, quantity: true, processFlow: true, processingStage: true, order: { select: { id: true, orderNumber: true, businessId: true } } } as const

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
      return NextResponse.json({
        success: true,
        data: {
          itemId: item.id, garmentName: item.garmentName, serviceName: item.serviceName,
          barcode: item.garmentScanCode || item.barcode || item.itemNumber,
          orderId: item.order.id, orderNumber: item.order.orderNumber,
          expected,
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
      const scannedSet = new Set(scanned)
      const missing = atSorting.filter((g) => !scannedSet.has(g.id))
      if (missing.length > 0)
        return NextResponse.json({ error: `${missing.length} garment(s) have not been scanned at Sorting yet — every garment must be scanned before the bag is assigned.` }, { status: 409 })

      // Bind the ONE finishing bag (validates scan mode, bag ownership, single-bag).
      const result = await assignFinishingBag({ orderId: order.id, businessId: biz.id, code, mode, actorName: b.actorName || null })
      if (!result.ok) {
        const status = result.code === "WRONG_ORDER" || result.code === "ALREADY_ASSIGNED" ? 409 : 400
        return NextResponse.json({ success: false, error: result.error }, { status })
      }

      // Advance every garment past Sorting to its next stage in its own
      // SNAPSHOTTED route (Iron / Fold / Transit terminal) — never a hardcoded
      // transition. Garment barcodes were retired by assignFinishingBag, so only
      // the bag QR is valid from here on.
      const items = await prisma.laundryOrderItem.findMany({
        where: { orderId: order.id },
        select: { id: true, processFlow: true, processingStage: true },
      })
      let advanced = 0
      for (const item of items) {
        const flow = (() => { try { const a = JSON.parse(item.processFlow || "null"); return Array.isArray(a) ? a.map(String) : null } catch { return null } })()
        const nxt = flow ? nextStageOf(flow, "SORTING") : null
        const stage = nxt || TERMINAL_STAGE
        const updated = await prisma.laundryOrderItem.updateMany({
          where: { id: item.id, processingStage: "SORTING" },
          data: { processingStage: stage, processingStatus: "WAITING", processingDept: departmentFor(stage) },
        })
        if (updated.count) {
          advanced++
          await prisma.laundryItemEvent.create({
            data: {
              itemId: item.id, orderId: order.id, businessId: biz.id,
              stage: "SORTING", fromStage: "SORTING", toStage: stage, action: "SORTING_BAG_ASSIGNED",
              department: departmentFor(stage), actorName: b.actorName || null,
              note: `Bag ${code} assigned at Sorting; garment advanced to ${stageLabel(stage)}`,
            },
          }).catch(() => null)
        }
      }

      await prisma.laundryOrderEvent.create({
        data: {
          orderId: order.id, businessId: biz.id, fromStatus: order.status, toStatus: order.status,
          action: "SORTING_COMPLETE", actorName: b.actorName || null,
          note: `Sorting complete: ${advanced} garment(s) bound to bag ${code}`,
        },
      }).catch(() => null)

      await syncPackageLifecycle(order.id, biz.id).catch(() => null)

      return NextResponse.json({ success: true, data: { ...result, advanced } })
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
  } catch (e) {
    console.error("[laundry-sorting] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
