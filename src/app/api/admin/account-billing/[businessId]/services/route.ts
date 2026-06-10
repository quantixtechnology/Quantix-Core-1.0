// GET /api/admin/account-billing/[businessId]/services
// Returns all service lines: subscription plan row + all addon rows.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const [sub, addons] = await Promise.all([
      db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      }),
      db.addon.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } }),
    ])

    const services: Array<Record<string, unknown>> = []

    if (sub) {
      const base = sub.finalAmount ?? sub.customPrice ?? sub.planPrice ?? 0
      services.push({
        id: sub.id,
        serviceType: 'Platform Plan',
        billingType: 'Recurring',
        name: sub.plan.name,
        description: `${sub.plan.tier} tier platform subscription`,
        amount: base,
        cycle: sub.billingCycle,
        status: sub.status,
        startDate: sub.currentPeriodStart,
        renewalDate: sub.nextBillingDate,
        source: 'SUBSCRIPTION',
      })
    }

    for (const a of addons) {
      services.push({
        id: a.id,
        serviceType: 'Add-On',
        billingType: a.billingType === 'ONE_TIME' ? 'One-Time' : 'Recurring',
        name: a.name,
        description: a.description,
        amount: a.amount,
        cycle: a.cycle ?? null,
        status: a.status,
        startDate: a.startDate,
        renewalDate: a.billingType === 'RECURRING' && a.cycle ? null : null,
        source: 'ADDON',
      })
    }

    return NextResponse.json({ success: true, data: services })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
