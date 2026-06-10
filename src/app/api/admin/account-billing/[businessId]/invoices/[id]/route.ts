// GET   /api/admin/account-billing/[businessId]/invoices/[id]   — invoice detail
// PATCH /api/admin/account-billing/[businessId]/invoices/[id]   — status transition

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    const id         = params?.id         as string

    const invoice = await db.billingInvoice.findFirst({
      where: { id, businessId },
      include: {
        items:    true,
        payments: {
          orderBy: { paidAt: 'desc' },
          select: { id: true, amount: true, paidAt: true, paymentMode: true, status: true, transactionId: true, referenceNumber: true, recordedByName: true },
        },
        account: {
          include: {
            business: {
              select: { name: true, contactEmail: true, contactPhone: true, address: true, city: true, state: true, gstNumber: true, logo: true },
            },
          },
        },
      },
    })

    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:            ['SENT', 'CANCELLED'],
  SENT:             ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED'],
  PARTIALLY_PAID:   ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE:          ['PAID', 'PARTIALLY_PAID', 'CANCELLED'],
  PAID:             [],
  CANCELLED:        [],
}

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    const id         = params?.id         as string

    const body = await req.json() as {
      status?:          string
      dueDate?:         string
      notes?:           string
      performedById?:   string
      performedByName?: string
    }

    const invoice = await db.billingInvoice.findFirst({ where: { id, businessId } })
    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    if (body.status) {
      const allowed = VALID_TRANSITIONS[invoice.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ success: false, error: `Cannot transition from ${invoice.status} to ${body.status}` }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status)  { updateData.status = body.status }
    if (body.dueDate) { updateData.dueDate = new Date(body.dueDate) }
    if (body.notes !== undefined) { updateData.notes = body.notes }
    if (body.status === 'SENT')   { updateData.sentAt = new Date() }

    const updated = await db.$transaction(async (tx) => {
      const upd = await tx.billingInvoice.update({ where: { id }, data: updateData })

      if (body.status) {
        await tx.billingAudit.create({
          data: {
            accountId:       invoice.accountId,
            businessId,
            action:          `INVOICE_${body.status}`,
            entityType:      'INVOICE',
            entityId:        id,
            description:     `Invoice ${invoice.invoiceNumber} status → ${body.status}`,
            oldValue:        invoice.status,
            newValue:        body.status,
            performedById:   body.performedById   ?? null,
            performedByName: body.performedByName ?? null,
          },
        })
      }
      return upd
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
