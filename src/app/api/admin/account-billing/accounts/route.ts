// GET /api/admin/account-billing/accounts
// Paginated list of all business accounts with billing state + health.
// Query params: search, plan, status, cycle, page, limit

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

function computeHealth(params: {
  outstanding: number
  daysOverdue: number
  pendingVerification: number
  subStatus: string
}): { score: 'Excellent' | 'Good' | 'Attention' | 'Critical'; reason: string } {
  const { outstanding, daysOverdue, pendingVerification, subStatus } = params
  if (subStatus === 'SUSPENDED' || subStatus === 'EXPIRED' || subStatus === 'CHURNED') {
    return { score: 'Critical', reason: `Subscription ${subStatus.toLowerCase()}` }
  }
  if (daysOverdue > 30 || outstanding > 50000) {
    return { score: 'Critical', reason: `${daysOverdue > 30 ? `${daysOverdue} days overdue` : `₹${outstanding.toLocaleString('en-IN')} outstanding`}` }
  }
  if (daysOverdue > 7 || outstanding > 10000 || pendingVerification > 0) {
    return { score: 'Attention', reason: daysOverdue > 7 ? `${daysOverdue} days overdue` : pendingVerification > 0 ? 'Payment pending verification' : `₹${outstanding.toLocaleString('en-IN')} outstanding` }
  }
  if (daysOverdue > 0 || outstanding > 0) {
    return { score: 'Good', reason: 'Minor outstanding balance' }
  }
  return { score: 'Excellent', reason: 'All payments up to date' }
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const search  = searchParams.get('search') ?? ''
    const plan    = searchParams.get('plan') ?? ''
    const status  = searchParams.get('status') ?? ''
    const cycle   = searchParams.get('cycle') ?? ''
    const page    = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit   = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')))
    const skip    = (page - 1) * limit

    const whereSubscription: Record<string, unknown> = {}
    if (plan)   whereSubscription.planId = plan
    if (status) whereSubscription.status = status
    if (cycle)  whereSubscription.billingCycle = cycle

    const whereBusiness: Record<string, unknown> = {}
    if (search) whereBusiness.name = { contains: search }

    const [subs, total] = await Promise.all([
      db.businessSubscription.findMany({
        where: {
          ...whereSubscription,
          business: { ...whereBusiness },
        },
        skip,
        take: limit,
        orderBy: { nextBillingDate: 'asc' },
        include: {
          plan: { select: { id: true, name: true, tier: true } },
          business: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
          billingHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              amount: true,
              paidDate: true,
              status: true,
              acknowledgeStatus: true,
            },
          },
        },
      }),
      db.businessSubscription.count({
        where: {
          ...whereSubscription,
          business: { ...whereBusiness },
        },
      }),
    ])

    const now = new Date()

    // Fetch addon counts per subscription
    const bizIds = subs.map(s => s.businessId)
    const addonCounts = await db.addon.groupBy({
      by: ['businessId'],
      where: { businessId: { in: bizIds }, status: 'ACTIVE' },
      _count: { id: true },
    })
    const addonMap = new Map(addonCounts.map(a => [a.businessId, a._count.id]))

    // Pending verification per biz
    const pendingVer = await db.billingRecord.groupBy({
      by: ['businessSubscriptionId'],
      where: { acknowledgeStatus: 'PENDING_VERIFICATION', subscription: { businessId: { in: bizIds } } },
      _count: { id: true },
    })
    const subToBizId = new Map(subs.map(s => [s.id, s.businessId]))
    const pendingVerMap = new Map<string, number>()
    for (const pv of pendingVer) {
      const bizId = subToBizId.get(pv.businessSubscriptionId)
      if (bizId) pendingVerMap.set(bizId, pv._count.id)
    }

    const accounts = subs.map(s => {
      const lastRecord = s.billingHistory[0] ?? null
      const daysOverdue = s.nextBillingDate < now
        ? Math.floor((now.getTime() - s.nextBillingDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const outstanding = (lastRecord?.status === 'pending' && lastRecord.amount) ? lastRecord.amount : 0
      const health = computeHealth({
        outstanding,
        daysOverdue,
        pendingVerification: pendingVerMap.get(s.businessId) ?? 0,
        subStatus: s.status,
      })
      const base = s.finalAmount ?? s.customPrice ?? s.planPrice ?? 0
      return {
        businessId:    s.businessId,
        businessName:  s.business.name,
        businessSlug:  s.business.slug,
        businessStatus: s.business.status,
        contactEmail:  s.business.contactEmail,
        contactPhone:  s.business.contactPhone,
        planId:        s.planId,
        planName:      s.plan.name,
        planTier:      s.plan.tier,
        billingCycle:  s.billingCycle,
        baseAmount:    base,
        nextDueDate:   s.nextBillingDate,
        lastPaymentDate: lastRecord?.paidDate ?? s.lastPaymentDate,
        lastPaymentAmount: lastRecord?.amount ?? s.lastPaymentAmount,
        lastPaymentStatus: lastRecord?.acknowledgeStatus ?? null,
        outstanding,
        daysOverdue,
        activeServices: 1 + (addonMap.get(s.businessId) ?? 0),
        subStatus: s.status,
        health: health.score,
        healthReason: health.reason,
      }
    })

    return NextResponse.json({
      success: true,
      data: accounts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
