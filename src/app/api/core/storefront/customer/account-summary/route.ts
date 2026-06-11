// GET /api/core/storefront/customer/account-summary
// Returns customer account type, credit limit, outstanding balance and invoice stats.

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
      select: {
        id: true, accountType: true, creditLimit: true, outstandingBalance: true,
      },
    })
    if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const [total, paid, pending] = await Promise.all([
      db.invoice.count({ where: { customerId: customer.id, businessId } }),
      db.invoice.count({ where: { customerId: customer.id, businessId, status: 'paid' } }),
      db.invoice.count({ where: { customerId: customer.id, businessId, status: 'pending' } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        accountType:        customer.accountType,
        creditLimit:        customer.creditLimit,
        outstandingBalance: customer.outstandingBalance,
        invoiceStats: { total, paid, pending },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch account summary'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
