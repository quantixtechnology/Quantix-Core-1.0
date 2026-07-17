// POST /api/core/marketing/evaluate — the ONE place the rule engine runs.
// Given a cart context (+ optional code), returns the applicable benefit.
// Read-only: it decides, it does NOT record a redemption (see /apply). Laundry
// benefits come back as "pending" (applied after Store Audit).
import { NextResponse } from "next/server"
import { checkEligibility, buildBenefit, bestPromotion } from "@/lib/marketing"
import { resolveMarketingBusinessId, buildContext, loadPromotionByCode, loadLivePromotions } from "@/lib/marketing-server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const bizId = await resolveMarketingBusinessId(String(body.businessId))
    const ctx = await buildContext(body)

    // Explicit code → validate that specific coupon.
    if (body.code) {
      const promo = await loadPromotionByCode(bizId, String(body.code))
      if (!promo) return NextResponse.json({ success: false, error: "Invalid coupon code." })
      const elig = checkEligibility(promo, ctx)
      if (!elig.eligible) return NextResponse.json({ success: false, error: elig.reason })
      return NextResponse.json({ success: true, data: buildBenefit(promo, ctx) })
    }

    // No code → best automatic offer for this cart.
    const promos = await loadLivePromotions(bizId)
    const best = bestPromotion(promos, ctx)
    if (!best) return NextResponse.json({ success: true, data: null })
    return NextResponse.json({ success: true, data: best.benefit })
  } catch (e) {
    console.error("[marketing-evaluate] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
