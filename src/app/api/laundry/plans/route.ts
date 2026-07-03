// Laundry Subscription Plan administration (Business → Customer plans).
// GET  /api/laundry/plans?businessId=   — list this tenant's laundry plans
// POST /api/laundry/plans               — create a plan
//
// Uses the existing SubscriptionPlan domain (serviceType LAUNDRY). Cloth
// allowance (totalCredits) and maxOrdersPerCycle are admin-configured per plan
// — never hardcoded. The plan is the single source of truth for subscription
// price + allowance; it is NOT a LaundryPricingRule.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "plan"

function serialize(p: Record<string, unknown>) {
  let features: string[] = []
  try { features = JSON.parse((p.features as string) || "[]") } catch { features = [] }
  return { ...p, features }
}

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId
    const plans = await prisma.subscriptionPlan.findMany({
      where: { businessId: platformId, serviceType: "LAUNDRY" },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { subscriptions: true } } },
    })
    return NextResponse.json({ success: true, data: plans.map(serialize) })
  } catch (e) {
    console.error("[laundry-plans] GET", e)
    return NextResponse.json({ success: false, error: "Failed to load plans" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, description, price, billingCycle, totalCredits, maxOrdersPerCycle, features, isActive } = body
    if (!businessId || !name?.trim()) return NextResponse.json({ success: false, error: "businessId and name are required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    // Unique slug within the tenant.
    let slug = slugify(name)
    let n = 1
    while (await prisma.subscriptionPlan.findFirst({ where: { businessId: platformId, slug } })) slug = `${slugify(name)}-${++n}`

    const plan = await prisma.subscriptionPlan.create({
      data: {
        businessId: platformId, name: name.trim(), slug, description: description || null,
        serviceType: "LAUNDRY", billingCycle: billingCycle || "MONTHLY",
        price: Number(price) || 0, totalCredits: Math.max(0, Math.floor(Number(totalCredits) || 0)),
        creditLabel: "clothes", allowanceType: "CLOTH_ALLOWANCE",
        maxOrdersPerCycle: maxOrdersPerCycle == null || maxOrdersPerCycle === "" ? null : Math.max(1, Math.floor(Number(maxOrdersPerCycle))),
        features: JSON.stringify(Array.isArray(features) ? features : []),
        isActive: isActive !== false,
      },
    })
    return NextResponse.json({ success: true, data: serialize(plan) }, { status: 201 })
  } catch (e) {
    console.error("[laundry-plans] POST", e)
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Create failed" }, { status: 500 })
  }
}
