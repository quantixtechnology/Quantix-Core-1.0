// POST /api/laundry/pricing-matrix/bulk-delete — clear the pricing MASTER in
// bulk.
//
// It deletes base-scope Pricing Matrix rows (LaundryPricingRule) and, with
// `removeGarments`, also takes the garments out of the current master. This is
// a pricing-master deletion, NEVER a history deletion:
//
//   • garments are ARCHIVED (isActive = false), never destroyed, so no order
//     item is orphaned, no foreign key breaks, and re-importing the same code
//     brings the same garment back rather than creating a second one;
//   • LaundryOrderItem carries its own garmentName and frozen price, so a past
//     order reads exactly as it was processed whatever happens here;
//   • orders, invoices, payments, packets and reports are not touched at all.
//
//   { businessId, scope: "all" | "service" | "category" | "garments",
//     serviceId?, categoryId?, garmentIds?: string[], removeGarments?: boolean }
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

    // Captured BEFORE the rules go, because for "category" and "all" the
    // garments are identified through the rules being removed.
    let garmentIds: string[] = []
    if (b.removeGarments && b.scope !== "service") {
      if (b.scope === "garments") {
        garmentIds = (Array.isArray(b.garmentIds) ? b.garmentIds : []).filter((x: unknown) => typeof x === "string")
      } else if (b.scope === "category") {
        const gs = await prisma.laundryGarment.findMany({ where: { businessId: lbId, categoryId: b.categoryId }, select: { id: true } })
        garmentIds = gs.map((g) => g.id)
      } else {
        const gs = await prisma.laundryGarment.findMany({ where: { businessId: lbId, isActive: true }, select: { id: true } })
        garmentIds = gs.map((g) => g.id)
      }
    }

    const res = await prisma.laundryPricingRule.deleteMany({ where: where as never })

    let archived = 0
    if (garmentIds.length) {
      // Scoped to this tenant in the same statement, so a garment id from
      // anywhere else simply matches nothing.
      const upd = await prisma.laundryGarment.updateMany({
        where: { id: { in: garmentIds }, businessId: lbId },
        data: { isActive: false },
      })
      archived = upd.count
    }

    return NextResponse.json({ success: true, deleted: res.count, archived })
  } catch (e) {
    console.error("[pricing-matrix-bulk-delete] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
