// PUT /api/laundry/orders/[id]/inspect
// Store Audit — the official verification + BILLING stage. Persists garment
// inspection (condition/defects/notes) against the order's EXISTING items and,
// for PER_KG garments, the MEASURED WEIGHT entered here (never at booking).
// Entering weight reprices the PER_KG lines (amount = weight × rate) and refreshes
// the order's financial snapshot — Store Audit is the invoice trigger for KG
// services. PER_PIECE lines were billed at booking and are left untouched.
//
// Body: { businessId, auditNotes?, auditPhotos?: string[], auditedBy?,
//         items: [{ itemId, condition?, defects?: string[], notes?, weightKg? }] }
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round((n || 0) * 100) / 100

interface InspItem { itemId: string; condition?: string; defects?: string[]; notes?: string; weightKg?: number | string | null }

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "store_ops.store_audit.operate")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const order = await prisma.laundryOrder.findFirst({
      where: { id, businessId: biz.id },
      select: {
        id: true, discount: true, pickupCharge: true, deliveryCharge: true, expressCharge: true, amountPaid: true,
        items: { select: { id: true, pricingType: true, quantity: true, unitPrice: true, gstPercent: true, weightKg: true, lineAmount: true, gstAmount: true, total: true } },
      },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

    const now = new Date()
    const inItems: InspItem[] = Array.isArray(b.items) ? b.items : []
    const weightByItem = new Map<string, number>()
    for (const it of inItems) {
      if (it.weightKg !== undefined && it.weightKg !== null && it.weightKg !== "") {
        const w = Math.max(0, Number(it.weightKg) || 0)
        weightByItem.set(it.itemId, w)
      }
    }

    // ── Reprice: a PER_KG line bills weight × unitPrice (the rate). Only lines
    // whose weight is (re)entered here change; PER_PIECE lines are untouched. ──
    const writes: Prisma.PrismaPromise<unknown>[] = []
    for (const item of order.items) {
      const isKg = item.pricingType === "PER_KG"
      const newW = weightByItem.get(item.id)
      if (isKg && newW !== undefined) {
        const lineAmount = r2(item.unitPrice * newW)
        const gstAmount = r2(lineAmount * (item.gstPercent || 0) / 100)
        const total = r2(lineAmount + gstAmount)
        writes.push(prisma.laundryOrderItem.update({ where: { id: item.id }, data: { weightKg: newW, lineAmount, gstAmount, total } }))
        item.weightKg = newW; item.lineAmount = lineAmount; item.gstAmount = gstAmount; item.total = total
      }
    }

    // Inspection fields (condition/defects/notes) per item.
    for (const it of inItems) {
      writes.push(prisma.laundryOrderItem.updateMany({
        where: { id: it.itemId, orderId: order.id },
        data: {
          condition: it.condition || null,
          defects: Array.isArray(it.defects) && it.defects.length ? it.defects.join(",") : null,
          inspectionNotes: it.notes || null,
          inspectedAt: now,
        },
      }))
    }

    // Refresh the order financial snapshot from the (repriced) items + the stored
    // order-level charges. This is the invoice for KG services (billed at audit).
    const subtotal = r2(order.items.reduce((s, l) => s + (l.lineAmount || 0), 0))
    const gstTotal = r2(order.items.reduce((s, l) => s + (l.gstAmount || 0), 0))
    const grandTotal = r2(subtotal + gstTotal + (order.pickupCharge || 0) + (order.deliveryCharge || 0) + (order.expressCharge || 0) - (order.discount || 0))
    const repriced = weightByItem.size > 0

    writes.push(prisma.laundryOrder.update({
      where: { id: order.id },
      data: {
        auditNotes: b.auditNotes ?? null,
        auditPhotos: Array.isArray(b.auditPhotos) ? JSON.stringify(b.auditPhotos) : null,
        auditedBy: b.auditedBy ?? null,
        auditedAt: now,
        ...(repriced ? { subtotal, gstTotal, grandTotal, balanceDue: r2(Math.max(0, grandTotal - (order.amountPaid || 0))), billedAt: now } : {}),
      },
    }))

    await prisma.$transaction(writes)
    return NextResponse.json({ success: true, data: { repriced, subtotal, gstTotal, grandTotal } })
  } catch (e) {
    console.error("[laundry-order-inspect] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
