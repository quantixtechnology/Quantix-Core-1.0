// POST /api/laundry/orders/[id]/adjustments/[adjustmentId]/void
//
// Void an adjustment that was given in error — a manual discount applied by
// mistake, most often. The row is NOT deleted and NOT edited: its amount,
// reason, note, author and time stay exactly as they were written, because an
// adjustment is a record of something a person did and that record is the
// audit. What changes is that summarise() stops counting it, so from here on
// the order is priced on its Deal Value alone.
//
// This is the reversal mechanism for the existing adjustment infrastructure,
// not a second discount system: no new adjustment is created, no offsetting
// amount is invented, and nothing here touches the pricing or subscription
// engines.
//
// Body: { reason }  — required, and kept on the row as voidReason.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel, Level } from "@/lib/laundry-rbac"
import { canCorrectDealValue } from "@/lib/laundry-dv-correction"

export const runtime = "nodejs"

export async function POST(request: Request, ctx: { params: Promise<{ id: string; adjustmentId: string }> }) {
  try {
    const { id, adjustmentId } = await ctx.params
    const order = await prisma.laundryOrder.findUnique({ where: { id }, select: { businessId: true } })
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    // Business scoping first: which tenant, and may they touch this screen.
    const guard = await requireLaundryLevel(request, order.businessId, "store_ops.payment_collection", Level.EDIT)
    if (!guard.ok) return guard.res
    // Then the same three roles that may correct a Deal Value. Voiding a
    // discount changes what the customer owes just as directly, so it is held
    // to the identical bar — and to the SAME predicate, so the two can never
    // drift apart. Edit rights on the Payments screen are not enough on their
    // own: a Store Manager may take money on this order and still not undo a
    // discount someone granted.
    if (!canCorrectDealValue({ platformRole: guard.ctx.role, isOwner: !!guard.resolved.isOwner, roleCode: guard.resolved.roleCode })) {
      return NextResponse.json(
        { success: false, error: "Only the Quantix Super Admin, the Owner or an Accountant can void a discount.", code: "FORBIDDEN" },
        { status: 403 },
      )
    }

    const b = await request.json().catch(() => ({}))
    const reason = typeof b.reason === "string" ? b.reason.trim() : ""
    // Without a reason the void itself is unauditable, which defeats the point
    // of keeping the original row.
    if (!reason) return NextResponse.json({ success: false, error: "A reason is required to void an adjustment." }, { status: 400 })

    // Scoped to the order, so an id from another order cannot be voided here.
    const adj = await prisma.laundryOrderAdjustment.findFirst({
      where: { id: adjustmentId, orderId: id },
      select: { id: true, amount: true, voidedAt: true, refundStatus: true },
    })
    if (!adj) return NextResponse.json({ success: false, error: "Adjustment not found on this order" }, { status: 404 })
    // Idempotent: voiding twice is a no-op, and the first void's record stands.
    if (adj.voidedAt) return NextResponse.json({ success: false, error: "This adjustment is already voided.", alreadyVoided: true }, { status: 409 })
    // Money that has actually gone back to the customer cannot be un-refunded
    // by a bookkeeping change; that needs a real payment, not a void.
    if (adj.refundStatus === "REFUNDED" || adj.refundStatus === "PROCESSING") {
      return NextResponse.json({ success: false, error: "This adjustment has been refunded and cannot be voided." }, { status: 409 })
    }

    await prisma.laundryOrderAdjustment.update({
      where: { id: adjustmentId },
      data: {
        voidedAt: new Date(),
        voidedBy: guard.ctx.userId ?? null,
        voidedByName: guard.ctx.userName ?? null,
        voidReason: reason,
      },
    })
    return NextResponse.json({ success: true, data: { id: adjustmentId, amount: adj.amount, voidReason: reason } })
  } catch (e) {
    console.error("[adjustment-void] POST", e)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
