// GET  /api/laundry/pricing  — list pricing rules (search / filter / sort / paginate)
// POST /api/laundry/pricing  — create a pricing rule (with audit + version)
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { buildRuleData, writeRuleAudit } from "@/lib/laundry-pricing-rule"

export const runtime = "nodejs"

const RULE_INCLUDE = {
  service: { select: { id: true, name: true } },
  garment: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  store: { select: { id: true, storeName: true } },
} as const

const SORTABLE = new Set(["priority", "createdAt", "updatedAt", "price", "gstPercent", "name", "pricingType", "status"])

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const sp = url.searchParams
    const businessId = sp.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.pricing.view")
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: true, data: [], total: 0, page: 1, pageSize: 0 })

    const where: Record<string, unknown> = { businessId: biz.id }
    const status = sp.get("status")
    if (status && status !== "ALL") where.status = status
    const customerType = sp.get("customerType")
    if (customerType && customerType !== "ALL") where.customerType = customerType
    const pricingType = sp.get("pricingType")
    if (pricingType && pricingType !== "ALL") where.pricingType = pricingType
    const storeId = sp.get("storeId")
    if (storeId && storeId !== "ALL") where.storeId = storeId
    const q = sp.get("q")?.trim()
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
        { service: { name: { contains: q } } },
        { garment: { name: { contains: q } } },
        { category: { name: { contains: q } } },
      ]
    }

    const sortBy = SORTABLE.has(sp.get("sortBy") || "") ? (sp.get("sortBy") as string) : "priority"
    const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc"
    const orderBy = sortBy === "priority"
      ? [{ priority: sortDir }, { createdAt: "desc" as const }]
      : [{ [sortBy]: sortDir }]

    const all = sp.get("all") === "1"
    const page = Math.max(1, parseInt(sp.get("page") || "1"))
    const pageSize = all ? undefined : Math.min(100, Math.max(5, parseInt(sp.get("pageSize") || "20")))

    const [data, total] = await Promise.all([
      prisma.laundryPricingRule.findMany({
        where: where as never,
        include: RULE_INCLUDE,
        orderBy: orderBy as never,
        ...(all ? {} : { skip: (page - 1) * (pageSize as number), take: pageSize }),
      }),
      prisma.laundryPricingRule.count({ where: where as never }),
    ])
    return NextResponse.json({ success: true, data, total, page, pageSize: pageSize ?? total })
  } catch (e) {
    console.error("[laundry-pricing] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Charges & Rules must NOT create or override a base service/garment price —
// those come ONLY from Services → Garment → Price (the /services/[id]/prices
// route). This route now configures surcharges only (pickup/delivery/express/
// weekend/minimum + schedule/store/priority). A base unit price is rejected.
function rejectBasePrice(b: Record<string, unknown>): string | null {
  if (b.price !== undefined && Number(b.price) > 0) {
    return "Base service/garment prices are managed in Services → Garment → Price. Charges & Rules configure surcharges only (pickup, delivery, express, weekend, minimum charge)."
  }
  return null
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })
    const guard = await requireLaundryPermission(request, b.businessId, "laundry.pricing.edit_pricing")
    if (!guard.ok) return guard.res
    const baseErr = rejectBasePrice(b)
    if (baseErr) return NextResponse.json({ error: baseErr }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })

    const data = await prisma.laundryPricingRule.create({
      data: {
        businessId: biz.id,
        ...buildRuleData(b),
        version: 1,
        createdById: b.actorId || null,
        createdByName: b.actorName || null,
        modifiedById: b.actorId || null,
        modifiedByName: b.actorName || null,
      },
      include: RULE_INCLUDE,
    })
    await writeRuleAudit(prisma, data, b.action === "DUPLICATE" ? "DUPLICATE" : "CREATE", b.actorId, b.actorName)
    return NextResponse.json({ success: true, data })
  } catch (e) {
    console.error("[laundry-pricing] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
