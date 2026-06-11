// GET /api/admin/account-billing/invoices
// Cross-account invoice listing — all BillingInvoice records with business name.

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
      // Filter by business name via account relation
      const accounts = await db.billingAccount.findMany({
        where: { business: { name: { contains: search } } },
        select: { id: true },
      })
      where.accountId = { in: accounts.map(a => a.id) }
    }

    const [invoices, total] = await Promise.all([
      db.billingInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          account: {
            include: { business: { select: { name: true, slug: true, contactPhone: true, contactEmail: true } } },
          },
        },
      }),
      db.billingInvoice.count({ where }),
    ])

    const data = invoices.map(inv => ({
      id:             inv.id,
      invoiceNumber:  inv.invoiceNumber,
      businessId:     inv.businessId,
      businessName:   inv.account.business.name,
      businessSlug:   inv.account.business.slug,
      businessPhone:  inv.account.business.contactPhone,
      businessEmail:  inv.account.business.contactEmail,
      status:         inv.status,
      billingPeriod:  inv.billingPeriod,
      totalAmount:    inv.totalAmount,
      paidAmount:     inv.paidAmount,
      dueDate:        inv.dueDate,
      issuedDate:     inv.issuedDate,
      createdAt:      inv.createdAt,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoices'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
