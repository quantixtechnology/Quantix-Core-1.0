// POST /api/laundry/pricing/simulate
// Pricing Simulator — runs the real Billing Resolver for one line and returns
// the computed bill PLUS the full evaluation trace (why each rule did/didn't
// win). Pricing is never calculated manually; this always calls the resolver.
//
// Body: { businessId, storeId?, customerType?, serviceId?, categoryId?,
//         garmentId?, quantity?, weightKg?, weekend?, express?, pickup?, delivery? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { computeQuote, computeLine, evaluateLine, resolveLineRule, type PricingRule } from "@/lib/laundry-billing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const rules = (await prisma.laundryPricingRule.findMany({ where: { businessId: biz.id } })) as unknown as PricingRule[]

    const ctx = {
      storeId: b.storeId || null,
      customerType: b.customerType || null,
      weekend: !!b.weekend,
      express: !!b.express,
      pickup: !!b.pickup,
      delivery: !!b.delivery,
    }
    const line = {
      serviceId: b.serviceId || null,
      garmentId: b.garmentId || null,
      categoryId: b.categoryId || null,
      quantity: b.quantity != null ? Number(b.quantity) : undefined,
      weightKg: b.weightKg != null ? Number(b.weightKg) : undefined,
    }

    // Same resolver the order billing uses — only active rules are matched.
    const activeRules = rules.filter((r) => r.isActive)
    const quote = computeQuote(activeRules, [line], ctx)
    const winner = resolveLineRule(activeRules, line)
    const computed = computeLine(winner, line, ctx)
    // Trace evaluates ALL rules (incl. inactive) so the owner sees what was skipped.
    const trace = evaluateLine(rules, line)

    return NextResponse.json({
      success: true,
      data: {
        matchedRule: winner
          ? {
              id: winner.id, name: (winner as PricingRule & { name?: string }).name ?? null,
              pricingType: winner.pricingType, priority: winner.priority,
              unitPrice: computed.unitPrice,
            }
          : null,
        line: computed,
        quote,
        trace,
      },
    })
  } catch (e) {
    console.error("[laundry-pricing/simulate] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
