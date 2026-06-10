// GET /api/admin/account-billing/[businessId]
// Full account detail: subscription + addons + latest billing record + health.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

function computeHealth(params: {
  outstanding: number
  daysOverdue: number
  pendingVerification: number
  subStatus: string
}): { score: string; reason: string } {
  const { outstanding, daysOverdue, pendingVerification, subStatus } = params
  if (['SUSPENDED', 'EXPIRED', 'CHURNED'].includes(subStatus)) {
    return { score: 'Critical', reason: `Subscription ${subStatus.toLowerCase()}` }
  }
  if (daysOverdue > 30 || outstanding > 50000) {
    return { score: 'Critical', reason: daysOverdue > 30 ? `${daysOverdue} days overdue` : `₹${outstanding.toLocaleString('en-IN')} outstanding` }
  }
  if (daysOverdue > 7 || outstanding > 10000 || pendingVerification > 0) {
    return { score: 'Attention', reason: daysOverdue > 7 ? `${daysOverdue} days overdue` : pendingVerification > 0 ? 'Payment pending verification' : `₹${outstanding.toLocaleString('en-IN')} outstanding` }
  }
  if (daysOverdue > 0 || outstanding > 0) return { score: 'Good', reason: 'Minor outstanding balance' }
  return { score: 'Excellent', reason: 'All payments up to date' }
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const [sub, addons, lastRecord, pendingCount, lifetimeAgg, recentDocs] = await Promise.all([
      db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true, business: { select: { id: true, name: true, slug: true, status: true, logo: true, gstNumber: true, address: true, city: true, state: true, pincode: true, contactEmail: true, contactPhone: true } } },
      }),
      db.addon.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } }),
      db.billingRecord.findFirst({ where: { subscription: { businessId } }, orderBy: { createdAt: 'desc' } }),
      db.billingRecord.count({ where: { acknowledgeStatus: 'PENDING_VERIFICATION', subscription: { businessId } } }),
      db.billingRecord.aggregate({ where: { status: 'paid', subscription: { businessId } }, _sum: { amount: true } }),
      db.billingDocument.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 3 }),
    ])

    if (!sub) return NextResponse.json({ success: false, error: 'No subscription found' }, { status: 404 })

    const now = new Date()
    const daysOverdue = sub.nextBillingDate < now
      ? Math.floor((now.getTime() - sub.nextBillingDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0
    const outstanding = lastRecord?.status === 'pending' ? (lastRecord.amount ?? 0) : 0
    const health = computeHealth({ outstanding, daysOverdue, pendingVerification: pendingCount, subStatus: sub.status })
    const base = sub.finalAmount ?? sub.customPrice ?? sub.planPrice ?? 0

    return NextResponse.json({
      success: true,
      data: {
        businessId,
        businessName:   sub.business.name,
        businessSlug:   sub.business.slug,
        businessStatus: sub.business.status,
        logo:           sub.business.logo,
        gstNumber:      sub.business.gstNumber,
        address:        sub.business.address,
        city:           sub.business.city,
        state:          sub.business.state,
        pincode:        sub.business.pincode,
        contactEmail:   sub.business.contactEmail,
        contactPhone:   sub.business.contactPhone,
        subscription: {
          id: sub.id,
          status: sub.status,
          planId: sub.planId,
          planName: sub.plan.name,
          planTier: sub.plan.tier,
          billingCycle: sub.billingCycle,
          billingCycleDay: sub.billingCycleDay,
          baseAmount: base,
          finalAmount: sub.finalAmount,
          discountAmount: sub.discountAmount,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          nextBillingDate: sub.nextBillingDate,
          lastPaymentDate: sub.lastPaymentDate,
          lastPaymentAmount: sub.lastPaymentAmount,
        },
        addons: addons.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          amount: a.amount,
          billingType: a.billingType,
          cycle: a.cycle,
          status: a.status,
          startDate: a.startDate,
        })),
        activeAddonCount: addons.filter(a => a.status === 'ACTIVE').length,
        lastRecord: lastRecord ? {
          id: lastRecord.id,
          amount: lastRecord.amount,
          status: lastRecord.status,
          acknowledgeStatus: lastRecord.acknowledgeStatus,
          paidDate: lastRecord.paidDate,
          invoiceNumber: lastRecord.invoiceNumber,
        } : null,
        outstanding,
        daysOverdue,
        pendingVerification: pendingCount,
        lifetimeRevenue: lifetimeAgg._sum.amount ?? 0,
        health: health.score,
        healthReason: health.reason,
        recentDocuments: recentDocs,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch account'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
