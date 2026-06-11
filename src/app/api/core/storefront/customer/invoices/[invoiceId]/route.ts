// GET /api/core/storefront/customer/invoices/[invoiceId]
// Returns full invoice detail with order items for the logged-in customer.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const invoiceId = params?.invoiceId as string
    if (!invoiceId) return NextResponse.json({ success: false, error: 'invoiceId required' }, { status: 400 })

    const user = req.user!
    const businessId = user.businessId!

    const customer = await db.customer.findFirst({
      where: { userId: user.id, businessId },
    })
    if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, customerId: customer.id, businessId },
      include: {
        order: {
          include: {
            items: {
              select: {
                id: true, itemName: true, variantName: true,
                quantity: true, unitPrice: true, totalPrice: true,
                gstRate: true, gstAmount: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
