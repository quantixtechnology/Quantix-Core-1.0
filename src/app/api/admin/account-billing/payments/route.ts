// GET /api/admin/account-billing/payments
// Cross-account payment listing — all BillingPayment records with business name.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    if (search) {
      const accounts = await db.billingAccount.findMany({
        where: { business: { name: { contains: search } } },
        select: { id: true },
      })
      where.accountId = { in: accounts.map(a => a.id) }
    }

    const [payments, total] = await Promise.all([
      db.billingPayment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip,
        take: limit,
        include: {
          account: {
            include: { business: { select: { name: true, slug: true } } },
          },
          invoice: { select: { invoiceNumber: true, billingPeriod: true } },
        },
      }),
      db.billingPayment.count({ where }),
    ])

    const data = payments.map(p => ({
      id:              p.id,
      businessId:      p.businessId,
      businessName:    p.account.business.name,
      invoiceNumber:   p.invoice.invoiceNumber,
      billingPeriod:   p.invoice.billingPeriod,
      amount:          p.amount,
      paymentMode:     p.paymentMode,
      transactionId:   p.transactionId,
      referenceNumber: p.referenceNumber,
      bankName:        p.bankName,
      status:          p.status,
      paidAt:          p.paidAt,
      recordedByName:  p.recordedByName,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payments'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
