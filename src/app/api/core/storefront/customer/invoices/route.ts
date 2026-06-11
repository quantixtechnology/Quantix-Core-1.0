// GET /api/core/storefront/customer/invoices
// Returns the logged-in customer's invoice list, newest first.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req) => {
  try {
    const user = req.user!
    const businessId = user.businessId!

    const customer = await db.customer.findFirst({
      where: { userId: user.id, businessId },
    })
    if (!customer) return NextResponse.json({ success: true, data: [] })

    const invoices = await db.invoice.findMany({
      where: { customerId: customer.id, businessId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, invoiceNumber: true, invoiceType: true,
        totalAmount: true, paidAmount: true, status: true,
        paidAt: true, dueDate: true, notes: true, createdAt: true,
        order: { select: { orderNumber: true, deliveredAt: true } },
      },
    })

    return NextResponse.json({ success: true, data: invoices })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list invoices'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
