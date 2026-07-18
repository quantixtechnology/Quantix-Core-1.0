// POST /api/laundry/pricing-matrix/bulk-delete — remove pricing in bulk. Only
// touches the base-scope Pricing Matrix rows (LaundryPricingRule); GARMENTS are
// never deleted, and order-frozen prices (on LaundryOrderItem) are untouched, so
// history stays intact.
//   { businessId, scope: "all" | "service" | "category" | "garments",
//     serviceId?, categoryId?, garmentIds?: string[] }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.delete_rules")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const lbId = biz.id

    // Base-scope matrix rows only.
    const base = { businessId: lbId, garmentId: { not: null } as const, serviceId: { not: null } as const, storeId: null, customerType: null, categoryId: null }

    let where: Record<string, unknown>
    switch (b.scope) {
      case "all":
        where = { ...base }
        break
      case "service":
        if (!b.serviceId) return NextResponse.json({ error: "serviceId required" }, { status: 400 })
        where = { ...base, serviceId: b.serviceId }
        break
      case "category": {
        if (!b.categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 })
        const garments = await prisma.laundryGarment.findMany({ where: { businessId: lbId, categoryId: b.categoryId }, select: { id: true } })
        const ids = garments.map((g) => g.id)
        if (!ids.length) return NextResponse.json({ success: true, deleted: 0 })
        where = { ...base, garmentId: { in: ids } }
        break
      }
      case "garments": {
        const ids: string[] = (Array.isArray(b.garmentIds) ? b.garmentIds : []).filter((x: unknown) => typeof x === "string")
        if (!ids.length) return NextResponse.json({ error: "garmentIds required" }, { status: 400 })
        where = { ...base, garmentId: { in: ids } }
        break
      }
      default:
        return NextResponse.json({ error: "Invalid scope" }, { status: 400 })
    }

    const res = await prisma.laundryPricingRule.deleteMany({ where: where as never })
    return NextResponse.json({ success: true, deleted: res.count })
  } catch (e) {
    console.error("[pricing-matrix-bulk-delete] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
