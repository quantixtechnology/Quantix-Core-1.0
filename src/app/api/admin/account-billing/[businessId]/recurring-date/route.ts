// PATCH /api/admin/account-billing/[businessId]/recurring-date
// Admin-editable recurring due date with full audit trail.
// Stores override in RecurringDateOverride and updates BusinessSubscription.nextBillingDate.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const body = await req.json() as {
      newDueDate: string
      overrideUntil?: string  // NEXT_BILLING_ONLY | PERMANENT (default: NEXT_BILLING_ONLY)
      reason: string
      createdById?: string
      createdByName?: string
    }

    if (!body.newDueDate) return NextResponse.json({ success: false, error: 'newDueDate required' }, { status: 400 })
    if (!body.reason?.trim()) return NextResponse.json({ success: false, error: 'reason required' }, { status: 400 })

    const sub = await db.businessSubscription.findUnique({ where: { businessId } })
    if (!sub) return NextResponse.json({ success: false, error: 'No subscription found' }, { status: 404 })

    const newDueDate = new Date(body.newDueDate)
    const overrideUntil = body.overrideUntil === 'PERMANENT' ? 'PERMANENT' : 'NEXT_BILLING_ONLY'

    const [override] = await Promise.all([
      db.recurringDateOverride.create({
        data: {
          businessSubscriptionId: sub.id,
          businessId,
          originalDueDate: sub.nextBillingDate,
          overrideDueDate: newDueDate,
          overrideReason: body.reason.trim(),
          overrideUntil,
          createdById: body.createdById ?? null,
          createdByName: body.createdByName ?? null,
          appliedAt: new Date(),
        },
      }),
      db.businessSubscription.update({
        where: { id: sub.id },
        data: { nextBillingDate: newDueDate },
      }),
      db.subscriptionPaymentAuditLog.create({
        data: {
          businessSubscriptionId: sub.id,
          businessId,
          userId: body.createdById ?? null,
          userName: body.createdByName ?? null,
          action: 'RECURRING_DATE_EDITED',
          oldStatus: sub.nextBillingDate.toISOString(),
          newStatus: newDueDate.toISOString(),
          notes: body.reason.trim(),
          metadata: JSON.stringify({ overrideUntil, originalDate: sub.nextBillingDate }),
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Recurring due date updated',
      data: {
        originalDueDate: sub.nextBillingDate,
        newDueDate,
        overrideUntil,
        overrideId: override.id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update recurring date'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
