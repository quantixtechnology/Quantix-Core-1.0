// Audit & Barcode Generation for a received package.
// GET  — package summary + garments (with barcode/generated flag) for the screen
// POST — { action: "GENERATE_ALL" | "MOVE_TO_PROCESSING", actorName? }
//   GENERATE_ALL: marks every garment's barcode label generated.
//   MOVE_TO_PROCESSING: gated — requires ALL garments barcoded — then routes each
//   garment into its first department queue (Wash/Dry Clean/Iron/…).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveFlow, departmentFor, stageLabel } from "@/lib/laundry-processing"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await prisma.laundryOrder.findUnique({
    where: { id },
    select: {
      id: true, orderNumber: true, status: true, storeId: true, customerId: true, businessId: true, grandTotal: true, expectedDeliveryDate: true,
      items: { orderBy: { itemNumber: "asc" }, select: { id: true, itemNumber: true, barcode: true, barcodeGenerated: true, printCount: true, lastPrintedBy: true, garmentName: true, serviceName: true, quantity: true, processingStage: true, condition: true, defects: true, inspectionNotes: true } },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
  const guard = await requireLaundryPermission(request, order.businessId, "processing.audit_barcode.view")
  if (!guard.ok) return guard.res
  const [store, customer] = await Promise.all([
    order.storeId ? prisma.laundryStore.findUnique({ where: { id: order.storeId }, select: { storeName: true, storeCode: true } }) : null,
    order.customerId ? prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true, phone: true } }) : null,
  ])
  const totalItems = order.items.length
  const barcoded = order.items.filter((i) => i.barcodeGenerated).length
  return NextResponse.json({ success: true, data: { order: { id: order.id, orderNumber: order.orderNumber, status: order.status, grandTotal: order.grandTotal, expectedDeliveryDate: order.expectedDeliveryDate }, store, customer, items: order.items.map((i) => ({ ...i, stageLabel: stageLabel(i.processingStage) })), totalItems, barcoded, allBarcoded: totalItems > 0 && barcoded === totalItems } })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const action = String(b.action || "").toUpperCase()
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { id: true, businessId: true, paymentStatus: true, items: { select: { id: true, serviceId: true, serviceName: true, garmentName: true, pricingType: true, weightKg: true, barcodeGenerated: true, processingStage: true, processFlow: true } } } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "processing.audit_barcode.operate")
    if (!guard.ok) return guard.res

    if (action === "GENERATE_ALL") {
      const pending = order.items.filter((i) => !i.barcodeGenerated)
      for (const it of pending) {
        await prisma.laundryOrderItem.update({ where: { id: it.id }, data: { barcodeGenerated: true, barcodePrintedAt: new Date() } })
        await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "BARCODE_GENERATED", department: "Audit & Barcode", actorName: b.actorName || null } })
      }
      return NextResponse.json({ success: true, data: { generated: pending.length } })
    }

    if (action === "MOVE_TO_PROCESSING") {
      const notBarcoded = order.items.filter((i) => !i.barcodeGenerated)
      if (order.items.length === 0 || notBarcoded.length > 0) {
        return NextResponse.json({ error: `All garments must have a barcode before processing (${notBarcoded.length} pending).`, code: "BARCODES_PENDING" }, { status: 409 })
      }
      // WEIGHT_REQUIRED gate: a PER_KG garment cannot advance without a measured
      // weight (> 0) — otherwise it would bill ₹0. Backend enforcement; the UI
      // shows "Weight Pending" but the server is authoritative.
      const missingWeight = order.items.filter((i) => String(i.pricingType || "").toUpperCase() === "PER_KG" && !(i.weightKg != null && i.weightKg > 0))
      if (missingWeight.length > 0) {
        const first = missingWeight[0]
        return NextResponse.json({
          error: `Measured weight is required for ${first.garmentName || "garment"} — ${first.serviceName || "service"} before pricing can be finalized.`,
          code: "WEIGHT_REQUIRED",
          items: missingWeight.map((i) => ({ id: i.id, garment: i.garmentName, service: i.serviceName })),
        }, { status: 422 })
      }
      // Payment policy: only ADVANCE_REQUIRED blocks processing before payment.
      // BEFORE_DELIVERY / SUBSCRIPTION / CUSTOM allow processing (payment is
      // enforced at delivery instead).
      const paid = order.paymentStatus === "PAID" || order.paymentStatus === "SUBSCRIPTION"
      if (!paid) {
        const biz = await prisma.laundryBusiness.findUnique({ where: { id: order.businessId }, select: { paymentPolicy: true } })
        if (biz?.paymentPolicy === "ADVANCE_REQUIRED") {
          return NextResponse.json({ error: "This workspace requires advance payment before processing.", code: "PAYMENT_PENDING" }, { status: 402 })
        }
      }
      // Resolve each garment's route from the tenant's SERVICE CONFIGURATION
      // (fallback: legacy name heuristic) and SNAPSHOT it onto the garment so
      // later config changes never rewrite an in-progress garment's history.
      const serviceIds = [...new Set(order.items.map((i) => i.serviceId).filter(Boolean) as string[])]
      const services = serviceIds.length
        ? await prisma.laundryService.findMany({ where: { id: { in: serviceIds } }, select: { id: true, processFlow: true } })
        : []
      const cfgMap = new Map(services.map((s) => [s.id, s.processFlow]))

      let moved = 0
      for (const it of order.items) {
        if (it.processingStage !== "RECEIVED") continue // idempotent — already routed
        const flow = resolveFlow(it, it.serviceId ? cfgMap.get(it.serviceId) : null)
        const stage = flow[0]
        await prisma.laundryOrderItem.update({
          where: { id: it.id },
          data: { processFlow: JSON.stringify(flow), processingStage: stage, processingStatus: "WAITING", processingDept: departmentFor(stage) },
        })
        await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "MOVED_TO_PROCESSING", fromStage: "RECEIVED", toStage: stage, department: departmentFor(stage), actorName: b.actorName || null, note: `Route: ${flow.join(" → ")}` } })
        moved++
      }
      return NextResponse.json({ success: true, data: { moved } })
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
  } catch (e) {
    console.error("[laundry-barcodes] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
