// Intake Audit — add garments to a Pickup-First order that has none yet.
// Reuses the Pricing Engine (resolveOrderBilling) to price the recorded
// garments, persists them as LaundryOrderItems, and folds the amounts into the
// order's existing financial snapshot. The order STAYS in PENDING_STORE_AUDIT
// so the existing Store Audit flow (inspection → approval → invoice) continues
// unchanged. No new order, no duplicate audit logic.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveOrderBilling } from "@/lib/laundry-billing-server"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { explodePieces } from "@/lib/laundry-order-items"
import { nextGarScanCode } from "@/lib/laundry-codes"

export const runtime = "nodejs"

interface IntakeItem { serviceId?: string | null; garmentId?: string | null; quantity?: number; weightKg?: number }

const r2 = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const items: IntakeItem[] = Array.isArray(body.items) ? body.items : []
    const clean = items.filter((it) => (Number(it.quantity) || 0) > 0 || (Number(it.weightKg) || 0) > 0)
    if (clean.length === 0) return NextResponse.json({ success: false, error: "Add at least one garment." }, { status: 400 })

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      select: { id: true, businessId: true, orderNumber: true, storeId: true, customerType: true, subtotal: true, gstTotal: true, grandTotal: true, balanceDue: true, amountPaid: true, totalWeightKg: true, billedAt: true, _count: { select: { items: true } } },
    })
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })
    const guard = await requireLaundryPermission(request, order.businessId, "store_ops.store_audit.view")
    if (!guard.ok) return guard.res

    // Price the recorded garments through the SAME Pricing Engine used at booking.
    const { lines } = await resolveOrderBilling(
      order.businessId,
      { storeId: order.storeId, customerType: order.customerType || null, pickup: false, delivery: false },
      clean.map((it) => ({ serviceId: it.serviceId || null, garmentId: it.garmentId || null, quantity: Number(it.quantity) || 0, weightKg: Number(it.weightKg) || 0 })),
    )

    // PER_KG lines bill ₹0 until weighed. The auditor entered a PER-GARMENT weight
    // at intake, so price each PER_KG line by ITS OWN weight × rate (single source
    // of truth) — no separate "total weight" step. Total weight = the sum, stored
    // so the audit never asks for it again. PER_PIECE lines keep their booking price.
    const priced = lines.map((l) => {
      if (l.pricingType === "PER_KG" && (l.weightKg || 0) > 0) {
        const lineAmount = r2(l.unitPrice * l.weightKg)
        const gstAmount = r2((lineAmount * (l.gstPercent || 0)) / 100)
        return { ...l, lineAmount, gstAmount, total: r2(lineAmount + gstAmount) }
      }
      return l
    })
    const addSubtotal = r2(priced.reduce((s, l) => s + l.lineAmount, 0))
    const addGst = r2(priced.reduce((s, l) => s + l.gstAmount, 0))
    const addTotal = r2(addSubtotal + addGst)
    const addWeight = r2(priced.filter((l) => l.pricingType === "PER_KG").reduce((s, l) => s + (l.weightKg || 0), 0))
    const base = order._count.items
    const newGrand = r2(order.grandTotal + addTotal)

    // NORMALIZE to physical garments — identical to createLaundryOrder. Every line
    // with quantity > 1 becomes N individual LaundryOrderItem records (qty 1 each,
    // amounts split to sum exactly), so each garment gets its OWN item id +
    // barcode + processing/QC/delivery lifecycle. Barcode Generation must always
    // operate on per-garment records, never service/cart lines.
    const exploded = explodePieces(priced)

    // Pre-generate GAR codes for every garment (atomic sequence, one per item).
    const garCodes = await Promise.all(exploded.map(() => nextGarScanCode()))
    const updated = await prisma.$transaction(async (tx) => {
      for (let i = 0; i < exploded.length; i++) {
        const l = exploded[i]
        const itemNumber = `ITM-${order.orderNumber}-${String(base + i + 1).padStart(4, "0")}`
        const gar = garCodes[i]
        await tx.laundryOrderItem.create({
          data: {
            orderId: order.id, itemNumber, barcode: gar, garmentScanCode: gar,
            serviceId: l.serviceId, serviceName: l.serviceName, garmentId: l.garmentId, garmentName: l.garmentName,
            categoryId: l.categoryId, pricingRuleId: l.pricingRuleId, pricingType: l.pricingType,
            quantity: l.quantity, weightKg: l.weightKg, unitPrice: l.unitPrice, lineAmount: l.lineAmount,
            gstPercent: l.gstPercent, gstAmount: l.gstAmount, discount: l.discount, total: l.total,
          },
        })
      }
      return tx.laundryOrder.update({
        where: { id: order.id },
        data: {
          subtotal: r2(order.subtotal + addSubtotal),
          gstTotal: r2(order.gstTotal + addGst),
          grandTotal: newGrand,
          balanceDue: r2(Math.max(0, newGrand - (order.amountPaid || 0))),
          totalWeightKg: r2((order.totalWeightKg || 0) + addWeight),
          billedAt: order.billedAt || new Date(),
        },
        select: { id: true, grandTotal: true },
      })
    })
    return NextResponse.json({ success: true, data: { orderId: updated.id, added: exploded.length, grandTotal: updated.grandTotal } }, { status: 201 })
  } catch (e) {
    console.error("[order-intake-items] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
