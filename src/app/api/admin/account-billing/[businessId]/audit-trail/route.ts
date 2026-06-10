// GET /api/admin/account-billing/[businessId]/audit-trail
// Combined audit trail: SubscriptionPaymentAuditLog + RecurringDateOverride events.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    const [paymentLogs, dateOverrides, paymentTotal, overrideTotal] = await Promise.all([
      db.subscriptionPaymentAuditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.recurringDateOverride.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.subscriptionPaymentAuditLog.count({ where: { businessId } }),
      db.recurringDateOverride.count({ where: { businessId } }),
    ])

    const combined = [
      ...paymentLogs.map(l => ({
        id: l.id,
        type: 'PAYMENT_LOG',
        action: l.action,
        user: l.userName,
        userId: l.userId,
        oldValue: l.oldStatus,
        newValue: l.newStatus,
        amount: l.amount,
        referenceNumber: l.referenceNumber,
        attachmentUrl: l.attachmentUrl,
        notes: l.notes,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      ...dateOverrides.map(d => ({
        id: d.id,
        type: 'DATE_OVERRIDE',
        action: 'RECURRING_DATE_EDITED',
        user: d.createdByName,
        userId: d.createdById,
        oldValue: d.originalDueDate.toISOString(),
        newValue: d.overrideDueDate.toISOString(),
        amount: null,
        referenceNumber: null,
        attachmentUrl: null,
        notes: d.overrideReason,
        metadata: JSON.stringify({ overrideUntil: d.overrideUntil, revertedAt: d.revertedAt }),
        createdAt: d.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: combined,
      pagination: {
        page,
        limit,
        total: paymentTotal + overrideTotal,
        pages: Math.ceil((paymentTotal + overrideTotal) / limit),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit trail'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
