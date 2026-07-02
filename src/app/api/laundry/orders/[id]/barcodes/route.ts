// Audit & Barcode Generation for a received package.
// GET  — package summary + garments (with barcode/generated flag) for the screen
// POST — { action: "GENERATE_ALL" | "MOVE_TO_PROCESSING", actorName? }
//   GENERATE_ALL: marks every garment's barcode label generated.
//   MOVE_TO_PROCESSING: gated — requires ALL garments barcoded — then routes each
//   garment into its first department queue (Wash/Dry Clean/Iron/…).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { firstStage, departmentFor, stageLabel } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await prisma.laundryOrder.findUnique({
    where: { id },
    select: {
      id: true, orderNumber: true, status: true, storeId: true, customerId: true, grandTotal: true, expectedDeliveryDate: true,
      items: { orderBy: { itemNumber: "asc" }, select: { id: true, itemNumber: true, barcode: true, barcodeGenerated: true, printCount: true, lastPrintedBy: true, garmentName: true, serviceName: true, quantity: true, processingStage: true, condition: true, defects: true, inspectionNotes: true } },
    },
  })
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
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
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { id: true, businessId: true, paymentStatus: true, items: { select: { id: true, serviceName: true, barcodeGenerated: true, processingStage: true } } } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

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
      // Business rule: block processing until payment is collected (unless the
      // workspace allows processing before payment). SUBSCRIPTION orders are ok.
      const paid = order.paymentStatus === "PAID" || order.paymentStatus === "SUBSCRIPTION"
      if (!paid) {
        const biz = await prisma.laundryBusiness.findUnique({ where: { id: order.businessId }, select: { allowProcessingBeforePayment: true } })
        if (!biz?.allowProcessingBeforePayment) {
          return NextResponse.json({ error: "Payment pending — collect payment before moving to processing.", code: "PAYMENT_PENDING" }, { status: 402 })
        }
      }
      for (const it of order.items) {
        const stage = firstStage(it.serviceName)
        await prisma.laundryOrderItem.update({ where: { id: it.id }, data: { processingStage: stage, processingStatus: "WAITING", processingDept: departmentFor(stage) } })
        await prisma.laundryItemEvent.create({ data: { itemId: it.id, orderId: order.id, businessId: order.businessId, action: "MOVED_TO_PROCESSING", fromStage: "RECEIVED", toStage: stage, department: departmentFor(stage), actorName: b.actorName || null } })
      }
      return NextResponse.json({ success: true, data: { moved: order.items.length } })
    }

    return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 })
  } catch (e) {
    console.error("[laundry-barcodes] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
