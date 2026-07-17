// POST /api/core/marketing/apply — validate a coupon for a cart and RECORD the
// redemption in the append-only ledger (single source for reports + limits).
// Laundry → status PENDING_AUDIT with amount 0 (finalized after Store Audit).
// Commerce → status APPLIED with the computed amount. No order/pricing engine
// change: this only writes the Marketing tables.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkEligibility, buildBenefit } from "@/lib/marketing"
import { resolveMarketingBusinessId, buildContext, loadPromotionByCode, customerRedemptionCount } from "@/lib/marketing-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !body.code) return NextResponse.json({ error: "Missing businessId or code" }, { status: 400 })
    const bizId = await resolveMarketingBusinessId(String(body.businessId))
    const customerId = body.customerId ? String(body.customerId) : null

    const promo = await loadPromotionByCode(bizId, String(body.code))
    if (!promo) return NextResponse.json({ success: false, error: "Invalid coupon code." })

    const ctx = await buildContext(body)
    const elig = checkEligibility(promo, ctx)
    if (!elig.eligible) return NextResponse.json({ success: false, error: elig.reason })

    if (promo.maxUsesPerCustomer != null) {
      const used = await customerRedemptionCount(promo.id, customerId)
      if (used >= promo.maxUsesPerCustomer) return NextResponse.json({ success: false, error: "You have already used this coupon." })
    }

    const benefit = buildBenefit(promo, ctx)
    const redemption = await prisma.$transaction(async (tx) => {
      const r = await tx.promotionRedemption.create({
        data: {
          promotionId: promo.id, businessId: bizId, customerId, orderId: body.orderId || null,
          status: benefit.status, amount: benefit.pending ? 0 : benefit.discount,
          workspaceType: promo.workspaceType || (body.workspaceType as string) || null,
          meta: JSON.stringify({ code: promo.code, orderValue: ctx.orderValue, applyTo: ctx.applyTo }),
        },
      })
      await tx.promotion.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } })
      return r
    })

    return NextResponse.json({ success: true, data: { ...benefit, redemptionId: redemption.id } })
  } catch (e) {
    console.error("[marketing-apply] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
