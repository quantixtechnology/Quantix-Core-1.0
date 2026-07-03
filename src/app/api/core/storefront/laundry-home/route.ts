// GET /api/core/storefront/laundry-home?businessId=&storeId=
//
// The customer website's data source for a LAUNDRY workspace. It is driven by
// Laundry Services + Garments + Categories + Pricing Rules + Subscription Plans
// — NOT ecommerce Product/ProductCategory records.
//
// Every garment price is resolved through the SAME Billing Resolver the POS and
// order flow use (computeQuote) — prices are never fabricated. When no pricing
// rule matches a service/garment, the item is marked unavailable (the UI shows
// "Price unavailable", never ₹0).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { computeQuote, type PricingRule } from "@/lib/laundry-billing"

export const runtime = "nodejs"

const unitFor = (t: string | null) => (t === "PER_KG" ? "kg" : t === "FIXED" ? "fixed" : "piece")

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const storeId = searchParams.get("storeId")
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId

    const [business, rules, services, garments, plans] = await Promise.all([
      prisma.business.findUnique({ where: { id: platformId }, select: { name: true, businessType: true, isOnline: true } }),
      prisma.laundryPricingRule.findMany({ where: { businessId: lbId, isActive: true } }),
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, description: true, icon: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } }),
      prisma.subscriptionPlan.findMany({ where: { businessId: platformId, serviceType: "LAUNDRY", isActive: true }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] }),
    ])

    // Resolve every (service × garment) unit price through the Billing Resolver.
    const rulesTyped = rules as unknown as PricingRule[]
    const serviceCards = services.map((svc) => {
      const lineInputs = garments.map((g) => ({ serviceId: svc.id, garmentId: g.id, categoryId: g.categoryId, quantity: 1 }))
      const quote = computeQuote(rulesTyped, lineInputs, { storeId: storeId || null, customerType: null })
      const items = quote.lines.map((l, i) => {
        const g = garments[i]
        const available = l.matchedRuleId != null
        return {
          garmentId: g.id,
          garmentName: g.name,
          categoryName: g.category?.name || null,
          available,
          unitPrice: available ? l.unitPrice : null,
          pricingType: available ? l.pricingType : null,
          unit: available ? unitFor(l.pricingType) : null,
          gstPercent: available ? l.gstPercent : null,
        }
      }).filter((it) => it.available) // only priced garments appear on a service
      const prices = items.map((it) => it.unitPrice!).filter((p) => p > 0)
      return {
        id: svc.id, name: svc.name, description: svc.description, icon: svc.icon,
        items,
        fromPrice: prices.length ? Math.min(...prices) : null,
        fromUnit: items[0]?.unit || "piece",
      }
    })

    const planCards = plans.map((p) => {
      let features: string[] = []
      try { features = JSON.parse(p.features || "[]") } catch { features = [] }
      return {
        id: p.id, name: p.name, slug: p.slug, description: p.description,
        price: p.price, billingCycle: p.billingCycle,
        totalCredits: p.totalCredits, creditLabel: p.creditLabel || "clothes",
        allowanceType: p.allowanceType, maxOrdersPerCycle: p.maxOrdersPerCycle,
        features, isFeatured: p.isFeatured,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        business: { name: business?.name || "Laundry", businessType: business?.businessType || "LAUNDRY", isOnline: business?.isOnline ?? false },
        services: serviceCards,
        popularServices: serviceCards.filter((s) => s.items.length > 0),
        plans: planCards,
      },
    })
  } catch (e) {
    console.error("[laundry-home] GET", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed to load" }, { status: 500 })
  }
}
