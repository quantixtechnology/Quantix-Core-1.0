// ============================================================================
// GET /api/laundry/orders/stats?businessId=&storeId=
// Operational workload counts for the Store Counter dashboard — real DB
// aggregation (groupBy status + today's intake), not generic KPIs.
// ============================================================================

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"
import { requireLaundryPermission } from "@/lib/laundry-rbac"
import { getFeedbackSummary } from "@/lib/laundry-feedback"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId")
    const storeId = searchParams.get("storeId")

    if (!businessId) {
      return NextResponse.json({ error: "Missing businessId parameter" }, { status: 400 })
    }
    const guard = await requireLaundryPermission(request, businessId, "laundry.orders.view")
    if (!guard.ok) return guard.res

    const resolved = await resolveLaundryBusiness(businessId)
    if (!resolved) {
      return NextResponse.json({ success: true, data: { byStatus: {}, today: 0, total: 0 } })
    }

    const where: Record<string, unknown> = { businessId: resolved.id }
    if (storeId) where.storeId = storeId

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [grouped, todayCount, total, ratingSummary] = await Promise.all([
      prisma.laundryOrder.groupBy({
        by: ["status"],
        where: where as never,
        _count: { _all: true },
      }),
      prisma.laundryOrder.count({ where: { ...where, createdAt: { gte: startOfToday } } as never }),
      prisma.laundryOrder.count({ where: where as never }),
      getFeedbackSummary(resolved.id, storeId),
    ])

    const byStatus: Record<string, number> = {}
    for (const g of grouped) byStatus[g.status as string] = g._count._all

    return NextResponse.json({ success: true, data: { byStatus, today: todayCount, total, rating: ratingSummary } })
  } catch (error) {
    console.error("[laundry-orders/stats] GET Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
