// GET /api/admin/account-billing/[businessId]/payments
// All BillingRecords for a business, newest first.

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

    const sub = await db.businessSubscription.findUnique({ where: { businessId }, select: { id: true } })
    if (!sub) return NextResponse.json({ success: false, error: 'No subscription found' }, { status: 404 })

    const [records, total] = await Promise.all([
      db.billingRecord.findMany({
        where: { businessSubscriptionId: sub.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.billingRecord.count({ where: { businessSubscriptionId: sub.id } }),
    ])

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payments'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
