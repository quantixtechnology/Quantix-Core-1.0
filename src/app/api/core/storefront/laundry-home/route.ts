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
import { resolveImageUrl } from "@/lib/image-url"

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
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, description: true, icon: true, image: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } }),
      prisma.subscriptionPlan.findMany({ where: { businessId: platformId, serviceType: "LAUNDRY", isActive: true }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] }),
    ])

    // Resolve every (service × garment) unit price through the Billing Resolver.
    const rulesTyped = rules as unknown as PricingRule[]
    const ruleById = new Map(rulesTyped.map((r) => [r.id, r]))
    // A garment row is only "priced" when the winning rule actually TARGETS that
    // garment — either its garmentId, or its categoryId (category pricing). A
    // rule that matches only via service/store/customer scope (garmentId AND
    // categoryId both null) is garment-agnostic: it must NOT populate every
    // garment row at one price (that is the pricing-leakage bug). Such garments
    // are shown as "Price unavailable" on the customer listing. (The Billing
    // Resolver itself is unchanged — order totals still honour generic rules.)
    const serviceCards = services.map((svc) => {
      // Weight-based service? A service-scoped PER_KG rule (no garment) defines it.
      const perKgRule = rules.find((r) => r.serviceId === svc.id && r.garmentId == null && r.categoryId == null && r.storeId == null && r.customerType == null && r.pricingType === "PER_KG" && r.isActive)

      const lineInputs = garments.map((g) => ({ serviceId: svc.id, garmentId: g.id, categoryId: g.categoryId, quantity: 1 }))
      const quote = computeQuote(rulesTyped, lineInputs, { storeId: storeId || null, customerType: null })
      // CUSTOMER CATALOG: only garments with an ACTIVE configured price for THIS
      // service (the winning rule must target the garment or its category). The
      // full Garment Master is admin-only — never shown to customers. Garments
      // with no service pricing are omitted entirely (no "Price unavailable" rows).
      const items = quote.lines.map((l, i) => {
        const g = garments[i]
        const rule = l.matchedRuleId ? ruleById.get(l.matchedRuleId) : null
        const targetsGarment = !!rule && rule.pricingType !== "PER_KG" && (rule.garmentId === g.id || (rule.categoryId != null && rule.categoryId === g.categoryId))
        if (!(l.matchedRuleId != null && targetsGarment)) return null
        return {
          garmentId: g.id, garmentName: g.name, categoryName: g.category?.name || null,
          available: true, unitPrice: l.unitPrice, pricingType: l.pricingType,
          unit: unitFor(l.pricingType), gstPercent: l.gstPercent,
        }
      }).filter((it): it is NonNullable<typeof it> => it != null)

      const prices = items.map((it) => it.unitPrice).filter((p) => p > 0)
      const pricingMode = perKgRule ? "PER_KG" : "PER_GARMENT"
      const fromPrice = perKgRule ? perKgRule.price : (prices.length ? Math.min(...prices) : null)
      return {
        id: svc.id, name: svc.name, description: svc.description, icon: svc.icon,
        imageUrl: svc.image ? resolveImageUrl(svc.image) : null,
        pricingMode,
        items, // only configured, orderable garments (PER_GARMENT services)
        perKg: perKgRule ? { price: perKgRule.price, minWeightKg: perKgRule.minWeightKg, gstPercent: perKgRule.gstPercent } : null,
        pricedCount: perKgRule ? 1 : items.length,
        fromPrice,
        fromUnit: perKgRule ? "kg" : (items[0]?.unit || "piece"),
      }
    })

    const planCards = plans.map((p) => {
      let features: string[] = []
      try { features = JSON.parse(p.features || "[]") } catch { features = [] }
      return {
        id: p.id, name: p.name, slug: p.slug, description: p.description,
        imageUrl: p.image ? resolveImageUrl(p.image) : null,
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
        // Customer catalog: only services with at least one active orderable price
        // (per-garment) OR an active PER_KG price. Services with no configured
        // customer price (e.g. Wash, Iron Only) are omitted from the public
        // catalog — the admin Services screen still shows them. Filtered
        // server-side; the Billing Resolver remains authoritative.
        services: serviceCards.filter((s) => s.pricedCount > 0),
        popularServices: serviceCards.filter((s) => s.pricedCount > 0),
        plans: planCards,
      },
    })
  } catch (e) {
    console.error("[laundry-home] GET", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed to load" }, { status: 500 })
  }
}
