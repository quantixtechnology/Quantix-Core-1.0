// GET /api/laundry/scan?barcode=   — identify a garment by its barcode/item ID.
// Scanning anywhere instantly returns the full context (business, store,
// customer, order, garment, service, current stage/status) + the item timeline
// so operators never have to search.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { stageLabel, departmentFor } from "@/lib/laundry-processing"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const code = (new URL(request.url).searchParams.get("barcode") || "").trim()
    if (!code) return NextResponse.json({ error: "Missing barcode" }, { status: 400 })

    // Barcode == itemNumber. Accept either (both stored on the item).
    const item = await prisma.laundryOrderItem.findFirst({
      where: { OR: [{ barcode: code }, { itemNumber: code }] },
      include: { order: { select: { id: true, orderNumber: true, status: true, businessId: true, storeId: true, customerId: true, grandTotal: true, expectedDeliveryDate: true } } },
    })
    if (!item) return NextResponse.json({ success: false, error: `No garment found for barcode "${code}"` }, { status: 404 })

    const [store, customer, business, events] = await Promise.all([
      item.order.storeId ? prisma.laundryStore.findUnique({ where: { id: item.order.storeId }, select: { storeName: true, storeCode: true } }) : null,
      item.order.customerId ? prisma.customer.findUnique({ where: { id: item.order.customerId }, select: { name: true, phone: true, customerCode: true } }) : null,
      prisma.laundryBusiness.findUnique({ where: { id: item.order.businessId }, select: { businessName: true, businessCode: true } }),
      prisma.laundryItemEvent.findMany({ where: { itemId: item.id }, orderBy: { createdAt: "asc" } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        item: {
          id: item.id, itemNumber: item.itemNumber, barcode: item.barcode,
          garmentName: item.garmentName, serviceName: item.serviceName, quantity: item.quantity,
          processingStage: item.processingStage, processingStatus: item.processingStatus,
          processFlow: item.processFlow, qcFailCount: item.qcFailCount,
          department: item.processingDept, stageLabel: stageLabel(item.processingStage),
          condition: item.condition, defects: item.defects,
        },
        business, store, customer,
        order: item.order,
        currentDepartment: departmentFor(item.processingStage),
        timeline: events,
      },
    })
  } catch (e) {
    console.error("[laundry-scan] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
