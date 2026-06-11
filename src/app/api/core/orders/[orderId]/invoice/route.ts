// POST /api/core/orders/[orderId]/invoice
// Creates (or fetches existing) invoice when an order is marked DELIVERED.
// Body: { paymentStatus: "paid" | "pending", notes?: string }
// Auth: CLIENT_OWNER, STORE_MANAGER, STORE_OPERATOR, BILLING_STAFF, QUANTIX_SUPER_ADMIN

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

function getFinancialYear(date: Date): string {
  const m = date.getMonth(); const y = date.getFullYear()
  const s = m >= 3 ? y : y - 1
  return `${s}-${String((s + 1) % 100).padStart(2, '0')}`
}

async function nextOrderInvoiceNumber(businessId: string, fy: string): Promise<string> {
  const key = `${businessId}:${fy}`
  const seq = await db.invoiceSequence.upsert({
    where: { financialYear: key },
    update: { nextVal: { increment: 1 } },
    create: { financialYear: key, nextVal: 2, updatedAt: new Date() },
  })
  return `INV/${fy}/${String(seq.nextVal - 1).padStart(4, '0')}`
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const body = await req.json() as { paymentStatus?: 'paid' | 'pending'; notes?: string }
    const paymentStatus = body.paymentStatus ?? 'paid'

    const user = req.user!

    const order = await db.order.findFirst({
      where: { id: orderId },
      include: { items: true, customer: true },
    })

    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    if (!user.isPlatformAdmin && order.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Return existing invoice if already created
    const existing = await db.invoice.findUnique({ where: { orderId } })
    if (existing) return NextResponse.json({ success: true, data: existing })

    const now = new Date()
    const fy = getFinancialYear(now)
    const invoiceNumber = await nextOrderInvoiceNumber(order.businessId, fy)

    const isPaid = paymentStatus === 'paid'

    const invoice = await db.invoice.create({
      data: {
        businessId:    order.businessId,
        orderId:       order.id,
        customerId:    order.customerId ?? undefined,
        invoiceNumber,
        invoiceType:   'TAX_INVOICE',
        subtotal:      order.subtotal,
        totalTax:      order.totalTax,
        totalDiscount: order.totalDiscount,
        totalAmount:   order.totalAmount,
        cgstAmount:    order.cgstAmount,
        sgstAmount:    order.sgstAmount,
        igstAmount:    order.igstAmount,
        paidAmount:    isPaid ? order.totalAmount : 0,
        notes:         body.notes ?? undefined,
        status:        isPaid ? 'paid' : 'pending',
        paidAt:        isPaid ? now : undefined,
        dueDate:       isPaid ? undefined : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    // If credit / pending — increment customer's outstanding balance
    if (!isPaid && order.customerId) {
      await db.customer.update({
        where: { id: order.customerId },
        data: { outstandingBalance: { increment: order.totalAmount } },
      })
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

// GET — fetch existing invoice for this order (for admin order detail panel)
export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const user = req.user!
    const invoice = await db.invoice.findUnique({
      where: { orderId },
      include: { order: { include: { items: true } } },
    })

    if (!invoice) return NextResponse.json({ success: false, error: 'No invoice for this order' }, { status: 404 })
    if (!user.isPlatformAdmin && invoice.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
