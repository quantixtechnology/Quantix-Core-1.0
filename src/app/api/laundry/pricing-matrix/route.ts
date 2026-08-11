// Pricing Matrix (GET) — the single garment×service pricing view. Dynamic
// service columns (active services only); each cell derived from the existing
// garment+service base-scope LaundryPricingRule. Historical/inactive-service
// pricing stays in the DB but is not shown. No engine change.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { ensureGarmentCodes } from "@/lib/laundry-garment-codes"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: { services: [], categories: [], garments: [] } })
    const lbId = biz.id
    await ensureGarmentCodes(lbId)

    const [services, categories, garments, rules] = await Promise.all([
      prisma.laundryService.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, subscriptionEligible: true } }),
      prisma.laundryCategory.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
      prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, code: true, name: true, categoryId: true, averageWeight: true, subscriptionIncluded: true, category: { select: { name: true } } } }),
      prisma.laundryPricingRule.findMany({ where: { businessId: lbId, isActive: true, garmentId: { not: null }, serviceId: { not: null }, storeId: null, customerType: null, categoryId: null }, select: { serviceId: true, garmentId: true, pricingType: true, price: true, minWeightKg: true } }),
    ])

    // garmentId → serviceId → cell
    const cellMap = new Map<string, Map<string, { mode: string; price: number; minWeightKg: number | null }>>()
    for (const r of rules) {
      if (!r.garmentId || !r.serviceId) continue
      if (!cellMap.has(r.garmentId)) cellMap.set(r.garmentId, new Map())
      cellMap.get(r.garmentId)!.set(r.serviceId, { mode: r.pricingType, price: r.price, minWeightKg: r.minWeightKg })
    }

    const data = {
      services,
      categories,
      garments: garments.map((g) => {
        const cells: Record<string, { mode: string; price: number; minWeightKg: number | null }> = {}
        const gc = cellMap.get(g.id)
        for (const s of services) cells[s.id] = gc?.get(s.id) || { mode: "NOT_AVAILABLE", price: 0, minWeightKg: null }
        return { id: g.id, code: g.code || "", name: g.name, categoryId: g.categoryId, categoryName: g.category?.name || null, averageWeight: g.averageWeight, subscriptionIncluded: g.subscriptionIncluded, cells }
      }),
    }
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[pricing-matrix] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
