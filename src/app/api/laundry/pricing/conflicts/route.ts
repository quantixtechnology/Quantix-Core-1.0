// POST /api/laundry/pricing/conflicts
// Conflict detection — before saving, find ACTIVE rules with the same scope
// tuple (service/garment/category/store/customerType) and an overlapping
// effective-date window. The UI warns and requires confirmation.
//
// Body: { businessId, excludeId?, serviceId?, garmentId?, categoryId?,
//         storeId?, customerType?, effectiveFrom?, effectiveTo? }
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryMember } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

const norm = (v: unknown) => (v === "" || v === undefined ? null : v)

// Two open-ended date windows overlap unless one ends before the other starts.
function windowsOverlap(aFrom: Date | null, aTo: Date | null, bFrom: Date | null, bTo: Date | null) {
  if (aTo && bFrom && aTo < bFrom) return false
  if (bTo && aFrom && bTo < aFrom) return false
  return true
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    if (!b.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const biz = await resolveLaundryBusiness(b.businessId)
    if (!biz) return NextResponse.json({ success: true, conflicts: [] })

    const scope = {
      serviceId: norm(b.serviceId),
      garmentId: norm(b.garmentId),
      categoryId: norm(b.categoryId),
      storeId: norm(b.storeId),
      customerType: norm(b.customerType),
    }

    // Same scope tuple + active. Date overlap is checked in JS (SQLite/null-safe).
    const candidates = await prisma.laundryPricingRule.findMany({
      where: {
        businessId: biz.id,
        status: "ACTIVE",
        ...(b.excludeId ? { id: { not: b.excludeId } } : {}),
        serviceId: scope.serviceId as string | null,
        garmentId: scope.garmentId as string | null,
        categoryId: scope.categoryId as string | null,
        storeId: scope.storeId as string | null,
        customerType: scope.customerType as string | null,
      },
      include: {
        service: { select: { name: true } },
        garment: { select: { name: true } },
        category: { select: { name: true } },
        store: { select: { storeName: true } },
      },
    })

    const from = b.effectiveFrom ? new Date(b.effectiveFrom) : null
    const to = b.effectiveTo ? new Date(b.effectiveTo) : null
    const conflicts = candidates.filter((c) => windowsOverlap(from, to, c.effectiveFrom, c.effectiveTo))

    return NextResponse.json({ success: true, conflicts })
  } catch (e) {
    console.error("[laundry-pricing/conflicts] POST", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
