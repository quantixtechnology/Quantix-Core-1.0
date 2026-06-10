// GET /api/admin/account-billing/accounts
// Paginated list of ALL businesses with billing state.
// Every business appears regardless of whether a subscription exists.
// Query params: search, status (business status), cycle (subscription billingCycle), page, limit

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

function computeHealth(params: {
  outstanding: number
  daysOverdue: number
  pendingVerification: number
  subStatus: string | null
}): { score: 'Excellent' | 'Good' | 'Attention' | 'Critical'; reason: string } {
  const { outstanding, daysOverdue, pendingVerification, subStatus } = params
  if (subStatus === 'SUSPENDED' || subStatus === 'EXPIRED' || subStatus === 'CHURNED') {
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
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const search  = searchParams.get('search') ?? ''
    const status  = searchParams.get('status') ?? ''   // business status
    const cycle   = searchParams.get('cycle') ?? ''    // subscription billingCycle filter
    const page    = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit   = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')))
    const skip    = (page - 1) * limit

    const bizWhere: Record<string, unknown> = {}
    if (search) bizWhere.name = { contains: search }
    if (status) bizWhere.status = status

    // When cycle filter is applied, restrict to businesses that have a matching subscription
    let filteredBizIds: string[] | null = null
    if (cycle) {
      const matchingSubs = await db.businessSubscription.findMany({
        where: { billingCycle: cycle as never },
        select: { businessId: true },
      })
      filteredBizIds = matchingSubs.map(s => s.businessId)
      if (filteredBizIds.length === 0) {
        return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } })
      }
    }

    const finalWhere: Record<string, unknown> = { ...bizWhere }
    if (filteredBizIds) finalWhere.id = { in: filteredBizIds }

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where: finalWhere,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, slug: true, status: true,
          contactEmail: true, contactPhone: true,
        },
      }),
      db.business.count({ where: finalWhere }),
    ])

    if (businesses.length === 0) {
      return NextResponse.json({ success: true, data: [], pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
    }

    const bizIds = businesses.map(b => b.id)

    // Fetch subscriptions for these businesses
    const subs = await db.businessSubscription.findMany({
      where: { businessId: { in: bizIds } },
      include: {
        plan: { select: { id: true, name: true, tier: true } },
        billingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { amount: true, paidDate: true, status: true, acknowledgeStatus: true },
        },
      },
    })
    const subMap = new Map(subs.map(s => [s.businessId, s]))

    // Addon counts
    const addonCounts = await db.addon.groupBy({
      by: ['businessId'],
      where: { businessId: { in: bizIds }, status: 'ACTIVE' },
      _count: { id: true },
    })
    const addonMap = new Map(addonCounts.map(a => [a.businessId, a._count.id]))

    // Pending verification per business (via subscription ID)
    const pendingVer = await db.billingRecord.groupBy({
      by: ['businessSubscriptionId'],
      where: { acknowledgeStatus: 'PENDING_VERIFICATION', subscription: { businessId: { in: bizIds } } },
      _count: { id: true },
    })
    const subIdToBizId = new Map(subs.map(s => [s.id, s.businessId]))
    const pendingVerMap = new Map<string, number>()
    for (const pv of pendingVer) {
      const bizId = subIdToBizId.get(pv.businessSubscriptionId)
      if (bizId) pendingVerMap.set(bizId, pv._count.id)
    }

    const now = new Date()

    const accounts = businesses.map(b => {
      const sub = subMap.get(b.id) ?? null
      const lastRecord = sub?.billingHistory[0] ?? null

      const daysOverdue = sub?.nextBillingDate && sub.nextBillingDate < now
        ? Math.floor((now.getTime() - sub.nextBillingDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const outstanding = lastRecord?.status === 'pending' && lastRecord.amount ? lastRecord.amount : 0
      const health = computeHealth({
        outstanding,
        daysOverdue,
        pendingVerification: pendingVerMap.get(b.id) ?? 0,
        subStatus: sub?.status ?? null,
      })
      const base = sub ? (sub.finalAmount ?? sub.customPrice ?? sub.planPrice ?? 0) : 0

      return {
        businessId:        b.id,
        businessName:      b.name,
        businessSlug:      b.slug,
        businessStatus:    b.status,
        contactEmail:      b.contactEmail,
        contactPhone:      b.contactPhone,
        planId:            sub?.planId ?? null,
        planName:          sub?.plan?.name ?? 'Not Assigned',
        planTier:          sub?.plan?.tier ?? null,
        billingCycle:      sub?.billingCycle ?? null,
        baseAmount:        base,
        nextDueDate:       sub?.nextBillingDate ?? null,
        lastPaymentDate:   lastRecord?.paidDate ?? sub?.lastPaymentDate ?? null,
        lastPaymentAmount: lastRecord?.amount ?? sub?.lastPaymentAmount ?? null,
        lastPaymentStatus: lastRecord?.acknowledgeStatus ?? null,
        outstanding,
        daysOverdue,
        activeServices:    sub ? 1 + (addonMap.get(b.id) ?? 0) : (addonMap.get(b.id) ?? 0),
        subStatus:         sub?.status ?? null,
        health:            health.score,
        healthReason:      health.reason,
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
