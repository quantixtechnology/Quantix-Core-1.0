// POST /api/laundry/seed-storefront  — DEMO/DEV seed for the customer website.
//
// Idempotently creates the two documented mock offerings for ONE tenant only:
//   1) NORMAL service — "Wash & Iron" with Shirt ₹40/pc and Pant ₹40/pc
//      (garments live under the "Men" category, following the existing master
//      convention). Pricing is a real Pricing Engine rule (All Customers / All
//      Stores) — the storefront resolves it through the Billing Resolver.
//   2) SUBSCRIPTION — "Monthly 70 Clothes Plan" (₹2,000/mo DEMO price, 70-cloth
//      allowance, max 2 orders/cycle, extras billed at normal rates).
//
// Nothing is global: masters are keyed to this tenant's LaundryBusiness and the
// plan to its platform Business. Safe to run repeatedly. The demo price and the
// isOnline flip are explicit demo-setup actions (not hidden in render logic).
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

const DEMO_PLAN_PRICE = 2000 // ₹/month — DEMO ONLY. Admin can edit the plan price later.

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const businessId = body.businessId as string | undefined
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })

    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id
    const platformId = biz.platformBusinessId || businessId

    const created: string[] = []
    const existing: string[] = []

    // 1) Category — "Men" (existing-master convention for Shirt/Pant)
    let men = await prisma.laundryCategory.findFirst({ where: { businessId: lbId, name: "Men" } })
    if (!men) { men = await prisma.laundryCategory.create({ data: { businessId: lbId, name: "Men", displayOrder: 1 } }); created.push("category:Men") }
    else existing.push("category:Men")

    // 2) Garments — Shirt, Pant under Men
    const ensureGarment = async (name: string) => {
      let g = await prisma.laundryGarment.findFirst({ where: { businessId: lbId, name } })
      if (!g) { g = await prisma.laundryGarment.create({ data: { businessId: lbId, name, categoryId: men!.id, defaultUnit: "PIECE" } }); created.push(`garment:${name}`) }
      else {
        if (!g.categoryId) g = await prisma.laundryGarment.update({ where: { id: g.id }, data: { categoryId: men!.id } })
        existing.push(`garment:${name}`)
      }
      return g
    }
    const shirt = await ensureGarment("Shirt")
    const pant = await ensureGarment("Pant")

    // 3) Service — Wash & Iron
    let svc = await prisma.laundryService.findFirst({ where: { businessId: lbId, name: "Wash & Iron" } })
    if (!svc) { svc = await prisma.laundryService.create({ data: { businessId: lbId, name: "Wash & Iron", description: "Fresh wash and professional ironing.", defaultPricingType: "PER_PIECE", defaultGstPercent: 0 } }); created.push("service:Wash & Iron") }
    else existing.push("service:Wash & Iron")

    // 4) Pricing rules — Wash & Iron × {Shirt,Pant} @ ₹40/pc, All Customers / All Stores
    const ensureRule = async (name: string, garmentId: string) => {
      const rule = await prisma.laundryPricingRule.findFirst({
        where: { businessId: lbId, serviceId: svc!.id, garmentId, customerType: null, storeId: null },
      })
      if (!rule) {
        await prisma.laundryPricingRule.create({
          data: { businessId: lbId, name, serviceId: svc!.id, garmentId, categoryId: null, storeId: null, customerType: null, pricingType: "PER_PIECE", price: 40, gstPercent: 0, priority: 0, status: "ACTIVE", isActive: true },
        })
        created.push(`rule:${name}`)
      } else {
        // Keep the demo rule at the documented ₹40 without disturbing scope.
        if (rule.price !== 40 || !rule.isActive) await prisma.laundryPricingRule.update({ where: { id: rule.id }, data: { price: 40, isActive: true, status: "ACTIVE" } })
        existing.push(`rule:${name}`)
      }
    }
    await ensureRule("Wash & Iron — Shirt", shirt.id)
    await ensureRule("Wash & Iron — Pant", pant.id)

    // 5) Subscription plan — Monthly 70 Clothes Plan (platform Business scope)
    const slug = "monthly-70-clothes"
    let plan = await prisma.subscriptionPlan.findFirst({ where: { businessId: platformId, slug } })
    const planData = {
      name: "Monthly 70 Clothes Plan",
      description: "70 clothes per month, usable across up to 2 pickups. Extra clothes billed at normal service rates.",
      serviceType: "LAUNDRY" as const,
      billingCycle: "MONTHLY" as const,
      price: DEMO_PLAN_PRICE,
      totalCredits: 70,
      creditLabel: "clothes",
      allowanceType: "CLOTH_ALLOWANCE",
      maxOrdersPerCycle: 2,
      features: JSON.stringify([
        "70 clothes included",
        "Up to 2 orders per month",
        "Use allowance across both orders",
        "Extra clothes charged at normal rates",
      ]),
      isFeatured: true,
      isActive: true,
    }
    if (!plan) { plan = await prisma.subscriptionPlan.create({ data: { businessId: platformId, slug, ...planData } }); created.push("plan:Monthly 70 Clothes Plan") }
    else { plan = await prisma.subscriptionPlan.update({ where: { id: plan.id }, data: planData }); existing.push("plan:Monthly 70 Clothes Plan") }

    // 6) Demo tenant online (explicit demo-setup action, clearly not render logic)
    await prisma.business.update({ where: { id: platformId }, data: { isOnline: true } }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        platformBusinessId: platformId, laundryBusinessId: lbId,
        created, existing,
        ids: { categoryMen: men.id, shirt: shirt.id, pant: pant.id, service: svc.id, plan: plan.id },
        demoPlanPrice: DEMO_PLAN_PRICE,
      },
    })
  } catch (e) {
    console.error("[seed-storefront] POST", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Seed failed" }, { status: 500 })
  }
}
