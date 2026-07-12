// PUT /api/laundry/orders/[id]/inspect
// Store Audit — persists garment inspection against the order's EXISTING items
// (no garment re-entry) plus order-level audit notes/photos. Does not change
// the order status; the caller transitions separately via the workflow engine.
//
// Body: { businessId, auditNotes?, auditPhotos?: string[], auditedBy?,
//         items: [{ itemId, condition?, defects?: string[], notes? }] }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.store_audit.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({ where: { id, businessId: biz.id }, select: { id: true } })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const now = new Date()
    const items = Array.isArray(b.items) ? b.items : []
    // Update each inspected item (scoped to this order).
    await prisma.$transaction([
      prisma.laundryOrder.update({
        where: { id: order.id },
        data: {
          auditNotes: b.auditNotes ?? null,
          auditPhotos: Array.isArray(b.auditPhotos) ? JSON.stringify(b.auditPhotos) : null,
          auditedBy: b.auditedBy ?? null,
          auditedAt: now,
        },
      }),
      ...items.map((it: { itemId: string; condition?: string; defects?: string[]; notes?: string }) =>
        prisma.laundryOrderItem.updateMany({
          where: { id: it.itemId, orderId: order.id },
          data: {
            condition: it.condition || null,
            defects: Array.isArray(it.defects) && it.defects.length ? it.defects.join(",") : null,
            inspectionNotes: it.notes || null,
            inspectedAt: now,
          },
        }),
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[laundry-order-inspect] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
