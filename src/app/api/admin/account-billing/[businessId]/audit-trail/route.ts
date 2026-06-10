// GET /api/admin/account-billing/[businessId]/audit-trail
// Paginated audit trail from BillingAudit model.

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
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } })

    const [entries, total] = await Promise.all([
      db.billingAudit.findMany({
        where:   { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
      }),
      db.billingAudit.count({ where: { accountId: account.id } }),
    ])

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit trail'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
