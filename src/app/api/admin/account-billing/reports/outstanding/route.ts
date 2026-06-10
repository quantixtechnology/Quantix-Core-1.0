// GET /api/admin/account-billing/reports/outstanding
// Outstanding amounts per business (pending BillingRecords past due date).

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async () => {
  try {
    const now = new Date()

    const records = await db.billingRecord.findMany({
      where: { status: 'pending' },
      orderBy: { dueDate: 'asc' },
      include: {
        subscription: {
          include: {
            business: { select: { id: true, name: true, slug: true, contactEmail: true } },
            plan: { select: { name: true, tier: true } },
          },
        },
      },
    })

    const rows = records.map(r => {
      const daysOverdue = r.dueDate < now
        ? Math.floor((now.getTime() - r.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0
      return {
        businessId:   r.subscription.business.id,
        businessName: r.subscription.business.name,
        businessSlug: r.subscription.business.slug,
        contactEmail: r.subscription.business.contactEmail,
        planName:     r.subscription.plan.name,
        recordId:     r.id,
        invoiceNumber: r.invoiceNumber,
        amount:       r.amount,
        dueDate:      r.dueDate,
        daysOverdue,
        acknowledgeStatus: r.acknowledgeStatus,
        periodLabel:  r.periodLabel,
        createdAt:    r.createdAt,
      }
    })

    const totalOutstanding = rows.reduce((sum, r) => sum + r.amount, 0)

    return NextResponse.json({
      success: true,
      data: rows,
      summary: {
        totalOutstanding,
        count: rows.length,
        overdueCount: rows.filter(r => r.daysOverdue > 0).length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch outstanding report'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
