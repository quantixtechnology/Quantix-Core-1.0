// POST /api/core/orders/[orderId]/invoice
// Called when admin marks order DELIVERED.
// Transitions the existing DRAFT invoice → PAID or PAYMENT_DUE.
// If no DRAFT exists (legacy order), creates the invoice.
// Body: { paymentStatus: "paid" | "pending", notes?: string, adminName?: string }
//
// GET /api/core/orders/[orderId]/invoice
// Fetches the invoice for an order (admin side, includes order items).

import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { db } from '@/lib/db'

function buildLegacyInvoiceNumber(orderNumber: string, storeCode: string | null): string {
  const storePart = (storeCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'MAIN'
  return `${storePart}-${orderNumber}-INV-001`
}

function appendAudit(existing: string, event: string, by?: string): string {
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(existing) } catch { /* start fresh */ }
  const log: Array<{event: string; ts: string; by?: string}> = (meta.auditLog as Array<{event: string; ts: string; by?: string}>) || []
  log.push({ event, ts: new Date().toISOString(), ...(by ? { by } : {}) })
  return JSON.stringify({ ...meta, auditLog: log })
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const body = await req.json() as { paymentStatus?: 'paid' | 'partial' | 'pending'; paidAmount?: number; notes?: string; adminName?: string }
    const paymentStatus = body.paymentStatus ?? 'paid'
    const adminName = body.adminName

    const user = req.user!

    const order = await db.order.findFirst({
      where:   { id: orderId },
      include: {
        customer: true,
        store:    { select: { id: true, code: true } },
        business: { select: { id: true, slug: true } },
      },
    })

    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    if (!user.isPlatformAdmin && order.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const now = new Date()
    const isPaid    = paymentStatus === 'paid'
    const isPartial = paymentStatus === 'partial'
    const paidAmt   = isPaid ? order.totalAmount : isPartial ? (body.paidAmount ?? 0) : 0
    const newStatus = isPaid ? 'PAID' : 'PAYMENT_DUE'

    // Find existing DRAFT invoice
    const existing = await db.invoice.findUnique({ where: { orderId } })

    if (existing) {
      const updatedMeta = appendAudit(existing.metadata, newStatus, adminName)
      const invoice = await db.invoice.update({
        where: { id: existing.id },
        data: {
          status:     newStatus,
          paidAmount: paidAmt,
          notes:      body.notes ?? existing.notes ?? undefined,
          paidAt:     isPaid ? now : null,
          dueDate:    isPaid ? null : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          metadata:   updatedMeta,
        },
      })

      // Credit accounts: update outstanding balance for unpaid/partial
      if (!isPaid && order.customerId) {
        const outstanding = order.totalAmount - paidAmt
        await db.customer.update({
          where: { id: order.customerId },
          data: { outstandingBalance: { increment: outstanding } },
        }).catch(() => {})
      }

      return NextResponse.json({ success: true, data: invoice })
    }

    // No existing invoice (legacy order) — create one now
    const invoiceNumber = buildLegacyInvoiceNumber(order.orderNumber, order.store?.code ?? null)
    const meta = appendAudit('{}', 'CREATED')
    const metaWithStatus = appendAudit(meta, newStatus, adminName)

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
        paidAmount:    paidAmt,
        notes:         body.notes ?? undefined,
        status:        newStatus,
        paidAt:        isPaid ? now : undefined,
        dueDate:       isPaid ? undefined : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        metadata:      metaWithStatus,
      },
    })

    if (!isPaid && order.customerId) {
      const outstanding = order.totalAmount - paidAmt
      await db.customer.update({
        where: { id: order.customerId },
        data: { outstandingBalance: { increment: outstanding } },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create/update invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

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
        customer: { select: { id: true, name: true, phone: true, email: true, accountType: true } },
      },
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

// PATCH — record payment / mark invoice paid manually
export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const orderId = params?.orderId as string
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 })

    const body = await req.json() as { paidAmount?: number; notes?: string; adminName?: string }
    const user = req.user!

    const invoice = await db.invoice.findUnique({ where: { orderId } })
    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    if (!user.isPlatformAdmin && invoice.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const now = new Date()
    const newPaid = body.paidAmount ?? invoice.totalAmount
    const fullyPaid = newPaid >= invoice.totalAmount
    const updatedMeta = appendAudit(invoice.metadata, 'PAYMENT_RECORDED', body.adminName)

    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        status:     fullyPaid ? 'PAID' : invoice.status,
        paidAt:     fullyPaid ? now : invoice.paidAt,
        notes:      body.notes ?? invoice.notes ?? undefined,
        metadata:   updatedMeta,
      },
    })

    // Reduce outstanding balance if BUSINESS account
    if (invoice.customerId && newPaid > invoice.paidAmount) {
      const diff = newPaid - invoice.paidAmount
      await db.customer.update({
        where: { id: invoice.customerId },
        data: { outstandingBalance: { decrement: diff } },
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
