// POST /api/laundry/orders/[id]/payments/[paymentId]/correct
//
// Correct a payment that was entered in error — staff marked the order paid
// when the customer never handed anything over. This is not a refund and not a
// reversal of real money: nothing is paid back, because nothing was received.
// The row stays exactly as it was entered and stops counting as money; see
// lib/laundry-payment-correction for what that means and why.
//
// Restricted to the same three roles that may correct a Deal Value, using the
// SAME predicate, and enforced HERE: hiding the button is a convenience, this
// is the control.
//
// Body: { reason }  — required, and kept on the row as correctionReason.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"
import { canCorrectDealValue, roleLabelFor } from "@/lib/laundry-dv-correction"
import { correctErroneousPayment } from "@/lib/laundry-payment-correction"

export const runtime = "nodejs"

export async function POST(request: Request, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { id, paymentId } = await ctx.params
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { businessId: true } })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    // Business scoping first: which tenant, and may they touch this screen. A
    // caller from another business must never learn anything about this order,
    // whatever their role is in their own.
    const guard = await requireLaundryLevel(request, order.businessId, "store_ops.payment_collection", Level.EDIT)
    if (!guard.ok) return guard.res
    // Then the role gate. Removing a recorded payment changes what the customer
    // owes as directly as correcting a Deal Value does, so it is held to the
    // identical bar — and to the same predicate, so the two can never drift
    // apart. Edit rights on the Payments screen are not enough: the roles that
    // take money on this screen are exactly the ones whose entries this undoes.
    const who = { platformRole: guard.ctx.role, isOwner: !!guard.resolved.isOwner, roleCode: guard.resolved.roleCode }
    if (!canCorrectDealValue(who)) {
      return NextResponse.json(
        { success: false, error: "Only the Quantix Super Admin, the Owner or an Accountant can correct a payment.", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    const b = await request.json().catch(() => ({}))
    const res = await correctErroneousPayment(id, paymentId, {
      reason: b.reason,
      actorId: guard.ctx.userId ?? null,
      actorName: guard.ctx.userName ?? null,
      role: roleLabelFor(who),
    })

    if (!res.ok) {
      // Already corrected is a conflict, not a bad request: the caller may act,
      // and the first correction's record stands.
      if (res.alreadyCorrected) {
        return NextResponse.json({ success: false, error: res.error, alreadyCorrected: true }, { status: 409 })
      }
      const notFound = res.error === "Order not found" || res.error === "Payment not found on this order"
      return NextResponse.json({ success: false, error: res.error }, { status: notFound ? 404 : 400 })
    }
    return NextResponse.json({ success: true, data: res })
  } catch (e) {
    console.error("[payment-correction] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
