// Admin — Phase 1 coupon report counts (total/active/expired/redeemed).
// Additive; RBAC-guarded. Derived from the promotion + redemption ledgers.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireLaundryPermission } from "@/lib/laundry-rbac"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 })
    const guard = await requireLaundryPermission(request, businessId, "laundry.settings.view")
    if (!guard.ok) return guard.res
    const bizId = guard.platformBusinessId
    const now = new Date()

    const [total, active, expired, redeemed] = await Promise.all([
      prisma.promotion.count({ where: { businessId: bizId, status: { not: "CANCELLED" } } }),
      prisma.promotion.count({ where: { businessId: bizId, status: "ACTIVE", enabled: true } }),
      prisma.promotion.count({ where: { businessId: bizId, OR: [{ status: "EXPIRED" }, { endAt: { lt: now } }] } }),
      prisma.promotionRedemption.count({ where: { businessId: bizId, status: { in: ["APPLIED", "PENDING_AUDIT", "FINALIZED"] } } }),
    ])
    return NextResponse.json({ success: true, data: { total, active, expired, redeemed } })
  } catch (e) {
    console.error("[marketing-reports] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
