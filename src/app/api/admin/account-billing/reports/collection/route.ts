// GET /api/admin/account-billing/reports/collection
// Collections grouped by month for the last 12 months.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const records = await db.billingRecord.findMany({
      where: {
        status: 'paid',
        paidDate: { gte: twelveMonthsAgo },
      },
      select: {
        amount: true,
        paidDate: true,
        subscription: {
          select: {
            plan: { select: { name: true, tier: true } },
          },
        },
      },
      orderBy: { paidDate: 'asc' },
    })

    // Group by YYYY-MM
    const byMonth = new Map<string, { amount: number; count: number }>()
    for (const r of records) {
      if (!r.paidDate) continue
      const key = `${r.paidDate.getFullYear()}-${String(r.paidDate.getMonth() + 1).padStart(2, '0')}`
      const existing = byMonth.get(key) ?? { amount: 0, count: 0 }
      byMonth.set(key, { amount: existing.amount + r.amount, count: existing.count + 1 })
    }

    // Build 12-month series (fill gaps with 0)
    const series: Array<{ month: string; label: string; amount: number; count: number }> = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      series.push({ month: key, label, ...( byMonth.get(key) ?? { amount: 0, count: 0 }) })
    }

    const totalCollected = records.reduce((sum, r) => sum + r.amount, 0)

    return NextResponse.json({
      success: true,
      data: series,
      summary: { totalCollected, totalPayments: records.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch collection report'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
