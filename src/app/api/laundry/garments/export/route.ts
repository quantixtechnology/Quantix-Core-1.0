// GET /api/laundry/garments/export?businessId= — full Garment Master rows for
// Excel export: code, name, category, material, weight, subscription, status,
// created/updated dates + usage flags (used in pricing / orders). Read-only.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { ensureGarmentCodes, garmentUsage } from "@/lib/laundry-garment-codes"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, rows: [] })
    await ensureGarmentCodes(biz.id)

    const garments = await prisma.laundryGarment.findMany({
      where: { businessId: biz.id },
      include: { category: { select: { name: true } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    })
    const usage = await garmentUsage(garments.map((g) => g.id))
    const rows = garments.map((g) => ({
      code: g.code || "",
      name: g.name,
      category: g.category?.name || "",
      material: g.material || "",
      averageWeight: g.averageWeight ?? "",
      subscription: g.subscriptionIncluded ? "Yes" : "No",
      status: g.isActive ? "Active" : "Archived",
      createdAt: g.createdAt.toISOString().slice(0, 10),
      updatedAt: g.updatedAt.toISOString().slice(0, 10),
      usedInPricing: usage.pricing.has(g.id) ? "Yes" : "No",
      usedInOrders: usage.orders.has(g.id) ? "Yes" : "No",
    }))
    return NextResponse.json({ success: true, rows })
  } catch (e) {
    console.error("[laundry-garments-export] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
