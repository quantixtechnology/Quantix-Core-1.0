// POST /api/laundry/orders/[id]/adjustments/[adjustmentId]/refund
//
// Records that a refund actually happened. There is no automated laundry refund
// call today — LaundryPaymentGateway stores credentials but nothing in the
// laundry engine calls a provider — so this marks what a human did, and refuses
// to claim more than that.
//
// The refund is recorded as its OWN LaundryPayment row with a negative amount,
// so Payment History reads as a true ledger: the original ₹500 stays ₹500 and a
// ₹-100 refund appears beside it. The original transaction is never edited.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryLevel } from "@/lib/laundry-rbac"
import { Level } from "@/lib/laundry-rbac-registry"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { canRefund } from "@/lib/laundry-adjustment"

export const runtime = "nodejs"

const VALID = new Set(["PROCESSING", "REFUNDED", "FAILED"])

export async function POST(request: Request, ctx: { params: Promise<{ id: string; adjustmentId: string }> }) {
  try {
    const { id, adjustmentId } = await ctx.params
    const b = await request.json().catch(() => ({}))
    const guard = await requireLaundryLevel(request, b.businessId, "laundry.payment_collection", Level.EDIT)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })

    const status = VALID.has(String(b.status)) ? String(b.status) : "REFUNDED"

    const updated = await prisma.$transaction(async (tx) => {
      const adj = await tx.laundryOrderAdjustment.findFirst({ where: { id: adjustmentId, orderId: id, businessId: biz.id } })
      if (!adj) throw new Error("NOT_FOUND")
      // PROCESSING may be reached from PENDING; a settled refund is final.
      if (!canRefund(adj.refundStatus) && !(adj.refundStatus === "PROCESSING" && status !== "PENDING")) {
        throw new Error("This refund has already been completed.")
      }
      if (adj.refundable <= 0) throw new Error("This adjustment has nothing to refund.")

      const row = await tx.laundryOrderAdjustment.update({
        where: { id: adjustmentId },
        data: {
          refundStatus: status,
          refundReference: typeof b.reference === "string" ? b.reference.slice(0, 120) : adj.refundReference,
          // Stamped only on the transition that means the money left.
          refundedAt: status === "REFUNDED" ? new Date() : null,
        },
      })

      // A real money movement, so it belongs in the real money ledger.
      if (status === "REFUNDED") {
        await tx.laundryPayment.create({
          data: {
            orderId: id, businessId: biz.id, method: "REFUND", amount: -adj.refundable,
            reference: typeof b.reference === "string" ? b.reference.slice(0, 120) : null,
            note: "Customer compensation refund",
            createdBy: guard.ctx?.userName ?? null,
          },
        })
      }
      return row
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed"
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error: "Adjustment not found" }, { status: 404 })
    console.error("[adjustment-refund] POST", e)
    const isValidation = /already been completed|nothing to refund/i.test(msg)
    return NextResponse.json({ success: false, error: isValidation ? msg : "Failed" }, { status: isValidation ? 400 : 500 })
  }
}
