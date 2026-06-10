// GET /api/admin/account-billing/reports/mrr-arr
// MRR and ARR breakdown by plan tier and billing cycle.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

function toMonthly(amount: number, cycle: string): number {
  switch (cycle) {
    case 'MONTHLY':     return amount
    case 'QUARTERLY':   return amount / 3
    case 'HALF_YEARLY': return amount / 6
    case 'YEARLY':      return amount / 12
    default:            return 0
  }
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const subs = await db.businessSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: { select: { name: true, tier: true } } },
    })

    const byPlan = new Map<string, { planName: string; tier: string; mrr: number; count: number }>()

    let totalMrr = 0
    for (const s of subs) {
      const base = s.finalAmount ?? s.customPrice ?? s.planPrice ?? 0
      const mrr = toMonthly(base, s.billingCycle)
      totalMrr += mrr

      const key = s.planId
      const existing = byPlan.get(key) ?? { planName: s.plan.name, tier: s.plan.tier, mrr: 0, count: 0 }
      byPlan.set(key, { ...existing, mrr: existing.mrr + mrr, count: existing.count + 1 })
    }

    const planBreakdown = Array.from(byPlan.entries()).map(([planId, data]) => ({
      planId,
      planName: data.planName,
      tier: data.tier,
      mrr: Math.round(data.mrr * 100) / 100,
      arr: Math.round(data.mrr * 12 * 100) / 100,
      accountCount: data.count,
    })).sort((a, b) => b.mrr - a.mrr)

    // Cycle breakdown
    const byCycle = new Map<string, number>()
    for (const s of subs) {
      const base = s.finalAmount ?? s.customPrice ?? s.planPrice ?? 0
      const mrr = toMonthly(base, s.billingCycle)
      byCycle.set(s.billingCycle, (byCycle.get(s.billingCycle) ?? 0) + mrr)
    }

    return NextResponse.json({
      success: true,
      data: {
        mrr: Math.round(totalMrr * 100) / 100,
        arr: Math.round(totalMrr * 12 * 100) / 100,
        activeAccounts: subs.length,
        planBreakdown,
        cycleBreakdown: Array.from(byCycle.entries()).map(([cycle, mrr]) => ({
          cycle,
          mrr: Math.round(mrr * 100) / 100,
          arr: Math.round(mrr * 12 * 100) / 100,
        })),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch MRR/ARR report'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
