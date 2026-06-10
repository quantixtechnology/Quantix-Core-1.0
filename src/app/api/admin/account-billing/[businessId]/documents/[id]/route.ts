// GET   /api/admin/account-billing/[businessId]/documents/[id]
// PATCH /api/admin/account-billing/[businessId]/documents/[id]
// View or transition a BillingDocument.
// When a PROFORMA reaches "Paid" → auto-generates TAX_INVOICE + PAYMENT_RECEIPT
// and marks the proforma "Converted To Invoice". Updates linked Charge to PAID.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import type { NextRequest } from 'next/server'

const VALID_STATUSES = [
  'Draft', 'Sent', 'Viewed', 'Accepted',
  'Payment Submitted', 'Under Verification',
  'Paid', 'Converted To Invoice',
  'Cancelled', 'Expired',
]

const TRANSITIONS: Record<string, string[]> = {
  'Draft':                ['Sent', 'Cancelled'],
  'Sent':                 ['Viewed', 'Cancelled'],
  'Viewed':               ['Accepted', 'Cancelled', 'Expired'],
  'Accepted':             ['Payment Submitted', 'Cancelled'],
  'Payment Submitted':    ['Under Verification', 'Cancelled'],
  'Under Verification':   ['Paid', 'Cancelled'],
  'Paid':                 [],
  'Converted To Invoice': [],
  'Cancelled':            [],
  'Expired':              [],
}

const TYPE_PREFIXES: Record<string, string> = {
  PROFORMA:        'PF',
  TAX_INVOICE:     'INV',
  CREDIT_NOTE:     'CN',
  DEBIT_NOTE:      'DN',
  PAYMENT_RECEIPT: 'RCPT',
  ADJUSTMENT_NOTE: 'AN',
}

function getFinancialYear(date: Date): string {
  const m = date.getMonth()
  const y = date.getFullYear()
  const startYear = m >= 3 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

async function generateDocNumber(documentType: string, date: Date, invoicePrefix: string): Promise<string> {
  const financialYear = getFinancialYear(date)
  const typePrefix = TYPE_PREFIXES[documentType] ?? documentType.slice(0, 2)
  const prefix = documentType === 'TAX_INVOICE' ? invoicePrefix : typePrefix
  const seq = await db.billingDocumentSequence.upsert({
    where: { financialYear_documentType: { financialYear, documentType } },
    update: { nextVal: { increment: 1 } },
    create: { financialYear, documentType, nextVal: 2 },
  })
  return `${prefix}/${financialYear}/${String(seq.nextVal - 1).padStart(4, '0')}`
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req: NextRequest, context) => {
  try {
    const params = await context?.params
    const { businessId, id } = params as { businessId: string; id: string }

    const doc = await db.billingDocument.findFirst({
      where: { id, businessId },
      include: {
        charge: { select: { id: true, serviceName: true, chargeType: true, status: true } },
      },
    })
    if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch document'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const { businessId, id } = params as { businessId: string; id: string }

    const body = await req.json() as {
      status?: string
      notes?: string
      validUntil?: string
      sentAt?: string
      acceptedAt?: string
      paidDate?: string
    }

    const doc = await db.billingDocument.findFirst({ where: { id, businessId } })
    if (!doc) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })

    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      }
      const allowed = TRANSITIONS[doc.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json({
          success: false,
          error: `Cannot transition from "${doc.status}" to "${body.status}". Allowed: ${allowed.join(', ') || 'none'}`,
        }, { status: 422 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.status)              updateData.status     = body.status
    if (body.notes !== undefined) updateData.notes      = body.notes
    if (body.validUntil)          updateData.validUntil = new Date(body.validUntil)
    if (body.sentAt)              updateData.sentAt     = new Date(body.sentAt)
    if (body.acceptedAt)          updateData.acceptedAt = new Date(body.acceptedAt)
    if (body.paidDate)            updateData.paidDate   = new Date(body.paidDate)

    // Auto-timestamps
    if (body.status === 'Sent'                 && !body.sentAt)     updateData.sentAt     = new Date()
    if (body.status === 'Accepted'             && !body.acceptedAt) updateData.acceptedAt = new Date()
    if (body.status === 'Paid'                 && !body.paidDate)   updateData.paidDate   = new Date()

    // PROFORMA reaching "Paid" triggers:
    //   1. status → "Converted To Invoice"
    //   2. auto-generate TAX_INVOICE + PAYMENT_RECEIPT
    //   3. update linked Charge → PAID (if present)
    if (body.status === 'Paid' && doc.documentType === 'PROFORMA') {
      updateData.status  = 'Converted To Invoice'
      updateData.paidDate = updateData.paidDate ?? new Date()

      const ps   = await getPlatformSettings()
      const now  = new Date()
      const [invNumber, rcptNumber] = await Promise.all([
        generateDocNumber('TAX_INVOICE',     now, ps.invoicePrefix),
        generateDocNumber('PAYMENT_RECEIPT', now, ps.invoicePrefix),
      ])

      await db.$transaction([
        db.billingDocument.create({
          data: {
            documentNumber: invNumber,
            documentType:   'TAX_INVOICE',
            businessId,
            chargeId:       doc.chargeId ?? null,
            linkedDocId:    doc.id,
            status:         'Paid',
            amount:         doc.amount,
            currency:       doc.currency,
            gstRate:        doc.gstRate,
            cgstAmount:     doc.cgstAmount,
            sgstAmount:     doc.sgstAmount,
            igstAmount:     doc.igstAmount,
            totalWithGst:   doc.totalWithGst,
            lineItems:      doc.lineItems,
            issuedDate:     now,
            paidDate:       now,
            createdById:    doc.createdById,
            createdByName:  doc.createdByName,
          },
        }),
        db.billingDocument.create({
          data: {
            documentNumber: rcptNumber,
            documentType:   'PAYMENT_RECEIPT',
            businessId,
            chargeId:       doc.chargeId ?? null,
            linkedDocId:    doc.id,
            status:         'Paid',
            amount:         doc.amount,
            currency:       doc.currency,
            issuedDate:     now,
            paidDate:       now,
            createdById:    doc.createdById,
            createdByName:  doc.createdByName,
          },
        }),
        db.billingDocument.update({ where: { id }, data: updateData }),
        ...(doc.chargeId
          ? [db.charge.update({ where: { id: doc.chargeId }, data: { status: 'PAID' } })]
          : []
        ),
      ])

      return NextResponse.json({
        success: true,
        message: 'Proforma converted: Tax Invoice and Receipt generated',
        data: { proformaId: id, status: 'Converted To Invoice' },
      })
    }

    const updated = await db.billingDocument.update({ where: { id }, data: updateData })
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update document'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
