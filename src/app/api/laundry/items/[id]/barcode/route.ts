// POST /api/laundry/items/[id]/barcode  { action?: "GENERATE" | "REPRINT" }
// Generate (or reprint) a single garment's barcode label. Records a timeline
// event. The barcode VALUE is the permanent itemNumber (set at order creation).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json().catch(() => ({}))
    const reprint = String(b.action || "").toUpperCase() === "REPRINT"
    const item = await prisma.laundryOrderItem.findUnique({ where: { id }, select: { id: true, orderId: true, itemNumber: true, barcode: true, order: { select: { businessId: true } } } })
    if (!item) return NextResponse.json({ error: "Garment not found" }, { status: 404 })

    await prisma.laundryOrderItem.update({ where: { id }, data: { barcodeGenerated: true, barcodePrintedAt: new Date(), printCount: { increment: 1 }, lastPrintedBy: b.actorName || null } })
    await prisma.laundryItemEvent.create({ data: { itemId: id, orderId: item.orderId, businessId: item.order.businessId, action: reprint ? "BARCODE_REPRINT" : "BARCODE_GENERATED", department: "Audit & Barcode", actorName: b.actorName || null } })

    return NextResponse.json({ success: true, data: { id, barcode: item.barcode || item.itemNumber, barcodeGenerated: true } })
  } catch (e) {
    console.error("[laundry-item-barcode] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
