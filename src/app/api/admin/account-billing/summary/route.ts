// GET /api/admin/account-billing/summary
// Platform-wide billing metrics derived from the new BillingAccount architecture.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

function mrrFromServices(services: { billingType: string; billingCycle: string | null; unitPrice: number; quantity: number; status: string }[]): number {
  const cycleMonths: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
  return services
    .filter(s => s.billingType === 'RECURRING' && s.status === 'ACTIVE')
    .reduce((sum, s) => {
      const months = cycleMonths[s.billingCycle ?? 'MONTHLY'] ?? 1
      return sum + (s.unitPrice * s.quantity) / months
    }, 0)
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [services, unpaidInvoices, payments, overdueCount, pendingVerifCount, activeAccounts] =
      await Promise.all([
        db.billingService.findMany({
          where: { status: 'ACTIVE' },
          select: { billingType: true, billingCycle: true, unitPrice: true, quantity: true, status: true },
        }),
        db.billingInvoice.findMany({
          where: { status: { notIn: ['CANCELLED', 'PAID'] } },
          select: { totalAmount: true, paidAmount: true },
        }),
        db.billingPayment.findMany({
          where: { status: 'COMPLETED', paidAt: { gte: startOfMonth, lte: endOfMonth } },
          select: { amount: true },
        }),
        db.billingInvoice.count({ where: { status: 'OVERDUE' } }),
        db.billingPayment.count({ where: { status: 'PENDING_VERIFICATION' } }),
        db.billingAccount.count(),
      ])

    const mrr = Math.round(mrrFromServices(services))
    const arr = mrr * 12
    const outstanding = Math.round(
      unpaidInvoices.reduce((s, inv) => s + Math.max(0, inv.totalAmount - inv.paidAmount), 0)
    )
    const collectedThisMonth = Math.round(payments.reduce((s, p) => s + p.amount, 0))

    return NextResponse.json({
      success: true,
      data: {
        mrr, arr, outstanding, collectedThisMonth,
        pendingVerification: pendingVerifCount,
        overdueAccounts:     overdueCount,
        activeAccounts,
        collectionRate:  0,
        totalCollected:  0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load summary'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
