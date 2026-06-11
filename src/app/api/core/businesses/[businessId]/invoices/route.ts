// GET /api/core/businesses/[businessId]/invoices
// Paginated invoice list for the business admin with search.
// Query params: page, limit, search (invoice number, order number, customer name/phone), status

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const user = req.user!
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page   = Math.max(1, Number(searchParams.get('page')   ?? '1'))
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')  ?? '25')))
    const skip   = (page - 1) * limit
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''

    // Build where clause
    const where: Record<string, unknown> = { businessId }
    if (status) where.status = status

    // Search: invoice number, order number, customer name, phone
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
      ]
    }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, invoiceNumber: true, invoiceType: true,
          totalAmount: true, paidAmount: true, status: true,
          paidAt: true, dueDate: true, notes: true, metadata: true, createdAt: true,
          order: { select: { id: true, orderNumber: true, deliveredAt: true } },
          customer: { select: { id: true, name: true, phone: true, accountType: true } },
        },
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list invoices'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
