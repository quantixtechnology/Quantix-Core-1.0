// GET / POST /api/laundry/orders/[id]/adjustments — customer compensation.
//
// A goodwill adjustment sits BESIDE the invoice, never inside it. This endpoint
// never touches grandTotal and never touches a LaundryPayment row: those are the
// historical record of what was invoiced and what money actually moved.
//
// It changes exactly one thing on the order — balanceDue — and only by the part
// of the adjustment that was never paid in the first place. Money already taken
// can only come back as a refund, which is a separate, explicit action.
//
// Permission reuses the existing financial screen (laundry.payment_collection);
// no new role and no new permission key.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel } from "@/lib/laundry-rbac"
import { Level } from "@/lib/laundry-rbac-registry"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { splitAdjustment, validateCompensation, ADJUSTMENT_REASONS } from "@/lib/laundry-adjustment"

export const runtime = "nodejs"

const VALID_REASONS = new Set(ADJUSTMENT_REASONS.map((r) => r.value as string))

async function loadOrder(orderId: string, laundryBusinessId: string) {
  return prisma.laundryOrder.findFirst({
    where: { id: orderId, businessId: laundryBusinessId },
    select: { id: true, grandTotal: true, amountPaid: true, balanceDue: true },
  })
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const businessId = new URL(request.url).searchParams.get("businessId")
    // Viewing the financial picture needs the same screen, at view level.
    const guard = await requireLaundryLevel(request, businessId, "laundry.payment_collection", Level.VIEW)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const order = await loadOrder(id, biz.id)
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    const adjustments = await prisma.laundryOrderAdjustment.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" } })
    return NextResponse.json({ success: true, data: { order, adjustments } })
  } catch (e) {
    console.error("[order-adjustments] GET", e)
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 })
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const b = await request.json().catch(() => ({}))
    // Issuing money back is an EDIT on the financial screen — a viewer cannot.
    const guard = await requireLaundryLevel(request, b.businessId, "laundry.payment_collection", Level.EDIT)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const order = await loadOrder(id, biz.id)
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })

    const amount = Math.round((Number(b.amount) || 0) * 100) / 100
    const reason = VALID_REASONS.has(String(b.reason)) ? String(b.reason) : "OTHER"

    // Re-validated server-side against the CURRENT rows, inside the same
    // transaction that writes, so two managers acting at once cannot both pass.
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.laundryOrderAdjustment.findMany({
        where: { orderId: id },
        select: { amount: true, appliedToDue: true, refundable: true, refundStatus: true },
      })
      const err = validateCompensation(order, existing, amount)
      if (err) throw new Error(err)

      const { refundable, appliedToDue } = splitAdjustment(order, existing, amount)
      const row = await tx.laundryOrderAdjustment.create({
        data: {
          orderId: id, businessId: biz.id, amount, reason,
          note: typeof b.note === "string" ? b.note.slice(0, 500) : null,
          appliedToDue, refundable,
          // Nothing is owed back when the money was never collected.
          refundStatus: refundable > 0 ? "PENDING" : "NOT_REQUIRED",
          createdBy: guard.ctx?.userId ?? null,
          createdByName: guard.ctx?.userName ?? null,
        },
      })
      // The ONLY order field touched. grandTotal and amountPaid are untouched,
      // so the invoice and the payment history stay exactly as they were.
      if (appliedToDue > 0) {
        await tx.laundryOrder.update({
          where: { id },
          data: { balanceDue: Math.max(0, Math.round((order.balanceDue - appliedToDue) * 100) / 100) },
        })
      }
      return row
    })

    return NextResponse.json({ success: true, data: created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    console.error("[order-adjustments] POST", e)
    // Validation messages are safe to surface; anything else is not.
    const isValidation = /exceed|greater than zero|fully compensated/i.test(msg)
    return NextResponse.json({ success: false, error: isValidation ? msg : "Failed" }, { status: isValidation ? 400 : 500 })
  }
}
