// GET /api/core/storefront/orders/[orderId]/invoice
// Returns the invoice for a specific order, visible to the order's customer.
// Admin roles (CLIENT_OWNER, STORE_MANAGER) may access without customer-ownership check.

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

export const GET = withMiddleware({
  requireAuth:   true,
  requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER'],
})(async (req, context) => {
  try {
    const params  = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const user       = req.user!
    const businessId = user.businessId!

    const isAdmin = user.isPlatformAdmin || ['CLIENT_OWNER', 'STORE_MANAGER'].includes(user.role as string)

    if (!isAdmin) {
      // Customer: verify the order belongs to them
      const customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
        select: { id: true },
      })
      if (!customer) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })

      const order = await db.order.findFirst({
        where: { id: orderId, customerId: customer.id, businessId },
        select: { id: true },
      })
      if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const invoice = await db.invoice.findUnique({
      where: { orderId },
      select: {
        id: true, invoiceNumber: true, status: true,
        totalAmount: true, paidAmount: true, subtotal: true,
        totalTax: true, totalDiscount: true,
        pdfUrl: true,
        dueDate: true, paidAt: true, createdAt: true, notes: true,
        order: { select: { id: true, orderNumber: true } },
      },
    })

    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
