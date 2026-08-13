// POST /api/laundry/billing/quote
// The single billing endpoint. Resolves every line's price from the Pricing
// Engine (no hardcoded prices anywhere) and returns the itemized bill.
//
// Body: { businessId, storeId?, customerType?, weekend?, express?, pickup?,
//         delivery?, items: [{ serviceId?, garmentId?, categoryId?, quantity?, weightKg? }] }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { computeQuote, type PricingRule } from "@/lib/laundry-billing"
import { applyChargesConfig } from "@/lib/laundry-billing-server"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, storeId, customerType, weekend, express, pickup, delivery, items } = body
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    // Tenant isolation: authenticated AND a member of THIS business —
    // knowing a businessId is not authorization.
    const _guard = await requireLaundryMember(request, businessId)
    if (!_guard.ok) return _guard.res
    if (!Array.isArray(items)) return NextResponse.json({ error: "items must be an array" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const rules = await prisma.laundryPricingRule.findMany({
      where: { businessId: biz.id, isActive: true },
    })

    const ctx = await applyChargesConfig(biz.id, { storeId: storeId || null, customerType: customerType || null, weekend: !!weekend, express: !!express, pickup: !!pickup, delivery: !!delivery })
    const quote = computeQuote(rules as unknown as PricingRule[], items, ctx)

    return NextResponse.json({ success: true, data: quote })
  } catch (e) {
    console.error("[laundry-billing/quote] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
