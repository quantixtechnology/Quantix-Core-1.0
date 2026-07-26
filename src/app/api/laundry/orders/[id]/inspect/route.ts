// PUT /api/laundry/orders/[id]/inspect
// Store Audit — the official verification + BILLING stage. Persists garment
// inspection (condition/defects/notes) and, for KG billing, the SINGLE TOTAL
// ORDER WEIGHT measured here (never at booking). Billing is done ONCE via the
// PER_KG strategy (total weight × rate); garment quantities stay for inventory /
// tracking / barcode / QC / delivery. This is the invoice trigger for KG orders;
// PER_PIECE lines were billed at booking and are left untouched.
//
// Body: { businessId, totalWeightKg?, auditNotes?, auditPhotos?: string[],
//         auditedBy?, items: [{ itemId, condition?, defects?: string[], notes? }] }
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { perKgStrategy } from "@/lib/laundry-billing-strategies"
import { applySubscriptionToOrder } from "@/lib/laundry-subscription-server"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round((n || 0) * 100) / 100

interface InspItem { itemId: string; condition?: string; defects?: string[]; notes?: string }

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
    const hasWeight = b.totalWeightKg !== undefined && b.totalWeightKg !== null && b.totalWeightKg !== ""
    const totalWeightKg = hasWeight ? Math.max(0, Number(b.totalWeightKg) || 0) : 0

    const writes: Prisma.PrismaPromise<unknown>[] = []

    // ── Bill KG ONCE via the PER_KG strategy: total order weight × rate, allocated
    // across the PER_KG garment lines (quantities kept for inventory only). Runs
    // only when a total weight is submitted; PER_PIECE lines are never touched. ──
    const kgItems = order.items.filter((it) => it.pricingType === "PER_KG")
    if (hasWeight && kgItems.length > 0) {
      const priced = perKgStrategy.price(
        kgItems.map((it) => ({ pricingType: "PER_KG", quantity: it.quantity, unitPrice: it.unitPrice, gstPercent: it.gstPercent })),
        { totalWeightKg },
      )
      kgItems.forEach((item, j) => {
        const p = priced[j]
        // Persist each line's share of the weighed KG total (see perKgStrategy):
        // subscription KG allowance is consumed per line, so the weight must land
        // on the item, not only the order.
        writes.push(prisma.laundryOrderItem.update({ where: { id: item.id }, data: { lineAmount: p.lineAmount, gstAmount: p.gstAmount, total: p.total, weightKg: p.weightKg ?? 0 } }))
        item.lineAmount = p.lineAmount; item.gstAmount = p.gstAmount; item.total = p.total
      })
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
    // order-level charges. This is the invoice for KG orders (billed at audit).
    const subtotal = r2(order.items.reduce((s, l) => s + (l.lineAmount || 0), 0))
    const gstTotal = r2(order.items.reduce((s, l) => s + (l.gstAmount || 0), 0))
    const grandTotal = r2(subtotal + gstTotal + (order.pickupCharge || 0) + (order.deliveryCharge || 0) + (order.expressCharge || 0) - (order.discount || 0))
    const repriced = hasWeight && kgItems.length > 0

    writes.push(prisma.laundryOrder.update({
      where: { id: order.id },
      data: {
        auditNotes: b.auditNotes ?? null,
        auditPhotos: Array.isArray(b.auditPhotos) ? JSON.stringify(b.auditPhotos) : null,
        auditedBy: b.auditedBy ?? null,
        auditedAt: now,
        ...(hasWeight ? { totalWeightKg } : {}),
        ...(repriced ? { subtotal, gstTotal, grandTotal, balanceDue: r2(Math.max(0, grandTotal - (order.amountPaid || 0))), billedAt: now } : {}),
      },
    }))

    await prisma.$transaction(writes)

    // Now that the KG lines carry their weight + price, consume any subscription
    // allowance the customer holds. Subscribed garments must NOT be billed — the
    // eligible portion is settled from the allowance and only the uncovered extra
    // stays as balance due. `force` re-derives coverage: booking-time apply ran
    // before the order was weighed (so KG coverage was 0). No-ops for walk-ins
    // (no customer) and for customers without an eligible active subscription.
    let coverage: { coveredAmount: number; extraAmount: number } | undefined
    if (repriced) {
      try {
        const applied = await applySubscriptionToOrder(order.id, { force: true, actorName: b.auditedBy || null })
        if (applied.ok) coverage = { coveredAmount: applied.coveredAmount, extraAmount: applied.extraAmount }
      } catch (e) { console.error("[laundry-order-inspect] subscription apply", e) }
    }
    return NextResponse.json({ success: true, data: { repriced, subtotal, gstTotal, grandTotal, coverage } })
  } catch (e) {
    console.error("[laundry-order-inspect] PUT", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
