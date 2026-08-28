// GET  /api/laundry/processing/transit?businessId= — orders ready to leave the
//      Processing Center: every garment finished its route (Transit terminal /
//      legacy Packed, DONE) and the order has its finishing bag bound at Sorting.
// POST /api/laundry/processing/transit — BAG-BASED dispatch to store.
//      Body: { businessId, code, actorName?, note? }
//      Scan the order's finishing bag (Laundry Bag / Processing Packet / reused
//      Pickup bag — per Workspace Scan Mode) to resolve the order and dispatch it
//      to the origin store. Garment barcodes are retired after Sorting and are
//      NEVER accepted at Transit.
//
// Server enforcements (authoritative):
//   • the scanned code must resolve to THIS business's finishing bag
//   • garment barcode formats (GAR-/ITM-/BAG-less codes) are rejected outright
//   • every garment must have finished its route (terminal + DONE)
//   • the order moves to RETURN_IN_TRANSIT (Store receives it at Store Receive)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { guardStatusWrite } from "@/lib/laundry-order-state"
import { isProcessingTerminal, TERMINAL_STAGE } from "@/lib/laundry-processing"
import { isBagCode, isProcessingPackageCode } from "@/lib/laundry-finishing"
import { syncPackageLifecycle } from "@/lib/laundry-finishing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "processing.transit.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, ready: [], count: 0 })

    const orders = await prisma.laundryOrder.findMany({
      where: { businessId: biz.id, status: "PROCESSING" },
      select: {
        id: true, orderNumber: true, customerId: true,
        store: { select: { storeName: true } },
        items: { select: { processingStage: true, processingStatus: true } },
      },
      orderBy: { createdAt: "asc" }, take: 100,
    })
    const custIds = [...new Set(orders.map((o) => o.customerId).filter(Boolean) as string[])]
    const custs = custIds.length ? await prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } }) : []
    const cm = new Map(custs.map((c) => [c.id, c.name]))
    const orderIds = orders.map((o) => o.id)
    const pkgs = orderIds.length
      ? await prisma.laundryProcessingPackage.findMany({ where: { orderId: { in: orderIds }, bagAssigned: true }, select: { orderId: true, code: true, bagCode: true } })
      : []
    const pkgByOrder = new Map(pkgs.map((p) => [p.orderId, p]))

    const ready = orders
      .filter((o) => o.items.length > 0 && o.items.every((i) => isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE"))
      .map((o) => {
        const pkg = pkgByOrder.get(o.id)
        return {
          id: o.id, orderNumber: o.orderNumber, customer: o.customerId ? cm.get(o.customerId) || null : null,
          items: o.items.length, toStore: o.store?.storeName || null,
          bagCode: pkg?.bagCode || pkg?.code || null,
        }
      })
    return NextResponse.json({ success: true, ready, count: ready.length })
  } catch (e) {
    console.error("[laundry-transit] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}))
    const businessId = String(b.businessId || "")
    const code = String(b.code || "").trim().toUpperCase()
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    if (!code) return NextResponse.json({ error: "Scan the finishing bag to dispatch." }, { status: 400 })

    // Garment barcodes are retired after Sorting — Transit only accepts bag /
    // processing-packet codes. Reject garment-style codes before any lookup.
    const looksLikeGarment = /^(GAR|ITM|ITM-)/.test(code)
    if (looksLikeGarment || (!isBagCode(code) && !isProcessingPackageCode(code)))
      return NextResponse.json({ error: "Transit operates on the finishing bag only — garment barcodes were retired at Sorting." }, { status: 409 })

    const guard = await requireLaundryPermission(request, businessId, "processing.transit.process")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    // Resolve the order from its finishing container (bag code / package code / QR).
    const pkg = await prisma.laundryProcessingPackage.findFirst({
      where: { businessId: biz.id, OR: [{ code }, { bagCode: code }, { qrValue: code }] },
      select: { id: true, code: true, orderId: true, bagAssigned: true },
    })
    if (!pkg)
      return NextResponse.json({ error: `No finishing bag "${code}" found — scan the bag assigned to this order at Sorting.` }, { status: 404 })

    const order = await prisma.laundryOrder.findUnique({
      where: { id: pkg.orderId },
      select: {
        id: true, orderNumber: true, status: true,
        packet: { select: { id: true } },
        items: { select: { id: true, processingStage: true, processingStatus: true } },
      },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    if (order.status === "RETURN_IN_TRANSIT")
      return NextResponse.json({ error: "Order already dispatched to store" }, { status: 409 })
    if (order.status !== "PROCESSING")
      return NextResponse.json({ error: `Order is not in processing (current: ${order.status})` }, { status: 409 })

    const unfinished = order.items.filter((i) => !(isProcessingTerminal(i.processingStage) && i.processingStatus === "DONE"))
    if (unfinished.length > 0) {
      return NextResponse.json({ error: `${unfinished.length} garment(s) have not completed processing & QC — the order cannot return to store yet.`, pending: unfinished.length }, { status: 409 })
    }

    const now = new Date()
    // STATE INVARIANTS — shared server guard (src/lib/laundry-order-state.ts).
    // The operational checks above own the physical action; this owns the
    // workflow claim, so no endpoint can advance an order past work that
    // never happened.
    const stateGate = await guardStatusWrite({ orderId: order.id, businessId: biz.id, from: "PROCESSING", to: "RETURN_IN_TRANSIT", allowInternal: true, custodyAction: true })
    if (!stateGate.ok) return NextResponse.json({ error: stateGate.error, code: stateGate.code }, { status: 409 })

    const advanced = await prisma.laundryOrder.updateMany({
      where: { id: order.id, status: "PROCESSING" },
      data: { status: "RETURN_IN_TRANSIT" },
    })
    if (advanced.count === 0) return NextResponse.json({ error: "Order already dispatched to store" }, { status: 409 })

    if (order.packet) {
      await prisma.laundryPacket.update({
        where: { id: order.packet.id },
        data: { status: "RETURN_IN_TRANSIT", returnDispatchedBy: b.actorName || null, returnDispatchedAt: now },
      })
    }

    await prisma.laundryOrderEvent.create({
      data: {
        orderId: order.id, businessId: biz.id,
        fromStatus: "PROCESSING", toStatus: "RETURN_IN_TRANSIT", action: "DISPATCH_TO_STORE",
        actorId: b.actorId || null, actorName: b.actorName || null,
        note: b.note || `Dispatched to store in bag ${pkg.code} — ${order.items.length} garment(s)`,
      },
    }).catch(() => null)

    await syncPackageLifecycle(order.id, biz.id).catch(() => null)

    return NextResponse.json({ success: true, data: { orderNumber: order.orderNumber, items: order.items.length, bagCode: pkg.code } })
  } catch (e) {
    console.error("[laundry-transit] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
