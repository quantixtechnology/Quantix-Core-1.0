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
import { splitAdjustment, validateCompensation, ADJUSTMENT_REASONS, discountAmount, schemeRefusal } from "@/lib/laundry-adjustment"

export const runtime = "nodejs"

const VALID_REASONS = new Set(ADJUSTMENT_REASONS.map((r) => r.value as string))

async function loadOrder(orderId: string, laundryBusinessId: string) {
  return prisma.laundryOrder.findFirst({
    where: { id: orderId, businessId: laundryBusinessId },
    select: { id: true, orderNumber: true, grandTotal: true, amountPaid: true, balanceDue: true, discount: true, subscriptionCoveredAmount: true, customerId: true },
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
    // Everything the Payment Details panel needs, in one round trip: the money,
    // the real payment rows, the adjustments, and the schemes that are usable
    // on THIS order right now (filtered by the Promotion's own conditions).
    const [adjustments, payments, promos, invoice, customer] = await Promise.all([
      prisma.laundryOrderAdjustment.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" } }),
      prisma.laundryPayment.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" } }),
      biz.platformBusinessId
        ? prisma.promotion.findMany({
            where: { businessId: biz.platformBusinessId, OR: [{ workspaceType: "LAUNDRY" }, { workspaceType: null }] },
            orderBy: { createdAt: "desc" }, take: 100,
          })
        : Promise.resolve([]),
      prisma.laundryInvoice.findUnique({ where: { orderId: id }, select: { invoiceNumber: true } }),
      order.customerId ? prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true, phone: true } }) : Promise.resolve(null),
    ])

    const schemes = promos
      .map((p) => ({
        id: p.id, title: p.title, code: p.code, discountType: p.discountType, discountValue: p.discountValue,
        maxDiscount: p.maxDiscount,
        // The refusal reason travels with the scheme so the UI can grey it out
        // and say WHY, instead of silently hiding it.
        refusal: schemeRefusal(p, order.grandTotal),
        amount: discountAmount(p.discountType, p.discountValue, order.grandTotal, p.maxDiscount),
      }))

    return NextResponse.json({ success: true, data: { order, adjustments, payments, schemes, invoiceNumber: invoice?.invoiceNumber ?? null, customer } })
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

    const reason = VALID_REASONS.has(String(b.reason)) ? String(b.reason) : "OTHER"
    const kind = ["COMPENSATION", "MANUAL_DISCOUNT", "SCHEME_DISCOUNT"].includes(String(b.kind)) ? String(b.kind) : "COMPENSATION"

    // THE AMOUNT IS ALWAYS DECIDED HERE. A percentage or a scheme sent from the
    // client is a request, not a figure — the server recomputes it from the
    // order's own total and the promotion's own rules.
    let amount = Math.round((Number(b.amount) || 0) * 100) / 100
    let promotionId: string | null = null
    let promotionCode: string | null = null

    if (kind === "SCHEME_DISCOUNT") {
      const promo = await prisma.promotion.findFirst({
        where: { id: String(b.promotionId || ""), businessId: biz.platformBusinessId ?? undefined },
      })
      if (!promo) return NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 })
      // Every existing Promotion condition still applies; none are re-implemented.
      const refusal = schemeRefusal(promo, order.grandTotal)
      if (refusal) return NextResponse.json({ success: false, error: refusal }, { status: 400 })
      amount = discountAmount(promo.discountType, promo.discountValue, order.grandTotal, promo.maxDiscount)
      promotionId = promo.id
      promotionCode = promo.code
    } else if (kind === "MANUAL_DISCOUNT" && String(b.discountType) === "PERCENT") {
      amount = discountAmount("PERCENT", Number(b.discountValue) || 0, order.grandTotal, null)
    }

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
          orderId: id, businessId: biz.id, amount, reason, kind, promotionId, promotionCode,
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
