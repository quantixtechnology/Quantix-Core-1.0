// GET /api/admin/account-billing/[businessId]/ledger
// Chronological ledger from BillingLedger with running balance.
// Always returns empty array — never 404.

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
    const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit') ?? '50')))
    const skip  = (page - 1) * limit

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: true, data: [], currentBalance: 0, pagination: { page, limit, total: 0, pages: 0 } })

    const [entries, total] = await Promise.all([
      db.billingLedger.findMany({
        where:   { accountId: account.id },
        orderBy: { date: 'asc' },
        skip,
        take:    limit,
      }),
      db.billingLedger.count({ where: { accountId: account.id } }),
    ])

    // Current balance = last entry's running balance
    const lastEntry = await db.billingLedger.findFirst({
      where:   { accountId: account.id },
      orderBy: { date: 'desc' },
      select:  { balance: true },
    })

    return NextResponse.json({
      success: true,
      data:    entries,
      currentBalance: lastEntry?.balance ?? 0,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ledger'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
