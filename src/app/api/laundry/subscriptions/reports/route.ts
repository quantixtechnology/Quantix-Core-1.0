// GET /api/laundry/subscriptions/reports?businessId=
// Subscription reporting (Part 12) — every figure is a LIVE aggregate:
// plans, active/expired subscriptions, renewals, consumption, remaining
// KG/Pieces, and subscription revenue. Nothing hardcoded.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    const [plans, subs, ledger, revenueAgg] = await Promise.all([
      prisma.subscriptionPlan.findMany({ where: { businessId: platformId, serviceType: "LAUNDRY" }, select: { id: true, name: true, isActive: true, price: true, allowanceKg: true, allowancePieces: true, currentSubscribers: true } }),
      prisma.customerSubscription.findMany({ where: { businessId: platformId }, select: { status: true, remainingKg: true, remainingPieces: true, usedKg: true, usedPieces: true, currentPeriodEnd: true } }),
      prisma.subscriptionLedgerEntry.groupBy({ by: ["entryType", "unit"], where: { businessId: platformId }, _sum: { delta: true }, _count: { _all: true } }),
      prisma.subscriptionPurchase.aggregate({ where: { businessId: platformId, status: "ACTIVATED" }, _sum: { amountPaid: true } }),
    ])

    const byStatus = (s: string) => subs.filter((x) => x.status === s).length
    const activeSubs = subs.filter((s) => s.status === "ACTIVE" || s.status === "GRACE")
    const sumBy = (type: string, unit: string) => Math.abs(r2(ledger.find((l) => l.entryType === type && l.unit === unit)?._sum.delta || 0))
    const renewalEntries = ledger.filter((l) => l.entryType === "RENEWAL").reduce((n, l) => n + l._count._all, 0)

    return NextResponse.json({ success: true, data: {
      plans: { total: plans.length, active: plans.filter((p) => p.isActive).length, inactive: plans.filter((p) => !p.isActive).length, list: plans },
      subscriptions: {
        active: byStatus("ACTIVE"), grace: byStatus("GRACE"), expired: byStatus("EXPIRED"),
        suspended: byStatus("SUSPENDED"), cancelled: byStatus("CANCELLED"), total: subs.length,
      },
      renewals: renewalEntries,
      consumption: { kg: sumBy("CONSUMPTION", "KG"), pieces: sumBy("CONSUMPTION", "PIECE") },
      remaining: {
        kg: r2(activeSubs.reduce((n, s) => n + s.remainingKg, 0)),
        pieces: activeSubs.reduce((n, s) => n + s.remainingPieces, 0),
      },
      revenue: r2(revenueAgg._sum.amountPaid || 0),
    } })
  } catch (e) {
    console.error("[laundry-subscription-reports] GET", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
