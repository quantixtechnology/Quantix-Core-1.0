// GET /api/laundry/subscriptions?businessId=  — Laundry business subscription
// management: tenant-scoped summary + list of customer subscriptions (active)
// and pending purchases. All figures are real (derived from CustomerSubscription
// / SubscriptionUsage / SubscriptionPurchase) — nothing hardcoded.
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveLaundryBusiness } from "@/lib/laundry-business"

export const runtime = "nodejs"
const r2 = (n: number) => Math.round(n * 100) / 100

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId")
    if (!businessId) return NextResponse.json({ success: false, error: "businessId is required" }, { status: 400 })
    const biz = await resolveLaundryBusiness(businessId)
    if (!biz) return NextResponse.json({ success: false, error: "Laundry business not found" }, { status: 404 })
    const platformId = biz.platformBusinessId || businessId

    const [subs, pendingPurchases] = await Promise.all([
      prisma.customerSubscription.findMany({
        where: { businessId: platformId },
        include: { plan: { select: { name: true, maxOrdersPerCycle: true } }, customer: { select: { name: true, phone: true, email: true } }, usages: { select: { creditsUsed: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscriptionPurchase.findMany({
        where: { businessId: platformId, status: { in: ["INITIATED", "PAYMENT_PENDING"] } },
        orderBy: { createdAt: "desc" },
      }),
    ])
    const planIds = [...new Set(pendingPurchases.map((p) => p.planId))]
    const custIds = [...new Set(pendingPurchases.map((p) => p.customerId))]
    const [pPlans, pCusts] = await Promise.all([
      prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } }),
      prisma.customer.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true, phone: true, email: true } }),
    ])
    const planMap = new Map(pPlans.map((p) => [p.id, p.name]))
    const custMap = new Map(pCusts.map((c) => [c.id, c]))
    const now = Date.now()
    const soon = now + 7 * 24 * 60 * 60 * 1000

    const activeRows = subs.map((s) => {
      const used = s.usages.reduce((a, u) => a + (u.creditsUsed || 0), 0)
      const expiring = s.status === "ACTIVE" && s.currentPeriodEnd.getTime() <= soon
      return {
        id: s.id, type: "SUBSCRIPTION" as const, customerName: s.customer?.name || "—", customerPhone: s.customer?.phone || null, customerEmail: s.customer?.email || null,
        planName: s.plan.name, status: s.status,
        clothesUsed: used, allowance: s.totalCredits, ordersUsed: s.usages.length, maxOrders: s.plan.maxOrdersPerCycle,
        cycleStart: s.currentPeriodStart, cycleEnd: s.currentPeriodEnd, amountDue: 0, expiring,
      }
    })
    const pendingRows = pendingPurchases.map((p) => {
      const c = custMap.get(p.customerId)
      return {
        id: p.id, type: "PURCHASE" as const, customerName: c?.name || "—", customerPhone: c?.phone || null, customerEmail: c?.email || null,
        planName: planMap.get(p.planId) || "Subscription", status: "PAYMENT_PENDING",
        clothesUsed: 0, allowance: 0, ordersUsed: 0, maxOrders: null,
        cycleStart: null, cycleEnd: null, amountDue: r2(p.amount - p.amountPaid), expiring: false,
      }
    })

    const rows = [...pendingRows, ...activeRows]
    const summary = {
      active: activeRows.filter((r) => r.status === "ACTIVE").length,
      pendingPayment: pendingRows.length,
      expiringSoon: activeRows.filter((r) => r.expiring).length,
      outstandingDue: r2(pendingRows.reduce((a, r) => a + r.amountDue, 0)),
    }
    return NextResponse.json({ success: true, data: { summary, rows } })
  } catch (e) {
    console.error("[laundry-subscriptions] GET", e)
    return NextResponse.json({ success: false, error: "Failed to load subscriptions" }, { status: 500 })
  }
}
