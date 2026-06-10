// GET /api/admin/account-billing/summary
// Returns platform-wide billing metrics: MRR, ARR, Outstanding,
// Collection Rate, Pending Verification count, Active Accounts count.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [
      activeSubsRaw,
      pendingVerificationCount,
      totalPaidAgg,
      monthlyAgg,
      overdueAgg,
      overdueAccountsCount,
    ] = await Promise.all([
      // All active subscriptions with amounts
      db.businessSubscription.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          billingCycle: true,
          finalAmount: true,
          customPrice: true,
          planPrice: true,
          nextBillingDate: true,
          business: { select: { id: true, status: true } },
        },
      }),
      // Payments pending verification
      db.billingRecord.count({ where: { acknowledgeStatus: 'PENDING_VERIFICATION' } }),
      // Total lifetime collections
      db.billingRecord.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // This-month collections
      db.billingRecord.aggregate({
        where: { status: 'paid', paidDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      // Overdue amount (pending and past due date)
      db.billingRecord.aggregate({
        where: { status: 'pending', dueDate: { lt: now } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Overdue subscriptions (distinct businessSubscriptionIds)
      db.billingRecord.findMany({
        where: { status: 'pending', dueDate: { lt: now } },
        select: { businessSubscriptionId: true },
        distinct: ['businessSubscriptionId'],
      }),
    ])

    // Compute MRR: normalise each active subscription to monthly
    let mrr = 0
    for (const s of activeSubsRaw) {
      const base = s.finalAmount ?? s.customPrice ?? s.planPrice ?? 0
      switch (s.billingCycle) {
        case 'MONTHLY':     mrr += base; break
        case 'QUARTERLY':   mrr += base / 3; break
        case 'HALF_YEARLY': mrr += base / 6; break
        case 'YEARLY':      mrr += base / 12; break
      }
    }
    const arr = mrr * 12
    const activeAccounts = activeSubsRaw.length
    const outstanding = overdueAgg._sum.amount ?? 0
    const totalCollected = totalPaidAgg._sum.amount ?? 0
    const totalInvoices = (totalPaidAgg._count.id ?? 0) + (overdueAgg._count.id ?? 0)
    const collectionRate = totalInvoices > 0
      ? Math.round(((totalPaidAgg._count.id ?? 0) / totalInvoices) * 100)
      : 100
    const overdueAccounts = overdueAccountsCount.length

    return NextResponse.json({
      success: true,
      data: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        outstanding,
        collectionRate,
        pendingVerification: pendingVerificationCount,
        activeAccounts,
        collectedThisMonth: monthlyAgg._sum.amount ?? 0,
        totalCollected,
        overdueAccounts,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch summary'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
