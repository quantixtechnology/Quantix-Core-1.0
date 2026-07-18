// POST /api/laundry/garments/bulk — bulk archive or delete.
//   { businessId, ids: string[], action: "archive" | "delete" }
// Archive  → set isActive=false (always allowed; stays searchable/historical).
// Delete   → hard-delete ONLY garments that are never referenced (pricing,
//            orders, subscriptions). Referenced garments are archived instead and
//            reported back, so nothing used in transactions is ever destroyed.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { garmentUsage } from "@/lib/laundry-garment-codes"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const action = b.action === "delete" ? "delete" : "archive"
    const perm = action === "delete" ? "laundry.pricing.delete_rules" : "laundry.pricing.edit_pricing"
    const guard = await requireLaundryPermission(request, b.businessId, perm)
    if (!guard.ok) return guard.res
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const ids: string[] = (Array.isArray(b.ids) ? b.ids : []).filter((x: unknown) => typeof x === "string")
    if (!ids.length) return NextResponse.json({ success: false, error: "No garments selected" }, { status: 400 })

    // Only operate on garments that actually belong to this business.
    const owned = await prisma.laundryGarment.findMany({ where: { id: { in: ids }, businessId: biz.id }, select: { id: true } })
    const ownedIds = owned.map((g) => g.id)
    if (!ownedIds.length) return NextResponse.json({ success: false, error: "No matching garments" }, { status: 404 })

    if (action === "archive") {
      await prisma.laundryGarment.updateMany({ where: { id: { in: ownedIds } }, data: { isActive: false } })
      return NextResponse.json({ success: true, archived: ownedIds.length, deleted: 0 })
    }

    // Delete: split into deletable (unreferenced) vs must-archive (referenced).
    const usage = await garmentUsage(ownedIds)
    const referenced = new Set<string>([...usage.pricing, ...usage.orders, ...usage.subs])
    const deletable = ownedIds.filter((id) => !referenced.has(id))
    const archived = ownedIds.filter((id) => referenced.has(id))

    if (deletable.length) {
      // Unreferenced garments have no orders/subscriptions; clear any stray
      // config-only pricing rows explicitly, then delete.
      await prisma.laundryPricingRule.deleteMany({ where: { garmentId: { in: deletable } } })
      await prisma.laundryGarment.deleteMany({ where: { id: { in: deletable } } })
    }
    if (archived.length) {
      await prisma.laundryGarment.updateMany({ where: { id: { in: archived } }, data: { isActive: false } })
    }
    return NextResponse.json({ success: true, deleted: deletable.length, archived: archived.length })
  } catch (e) {
    console.error("[laundry-garments-bulk] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
