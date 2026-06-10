// GET  /api/admin/account-billing/[businessId]/documents
// POST /api/admin/account-billing/[businessId]/documents
// BillingDocument engine: create and list documents for a business.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import type { NextRequest } from 'next/server'

const VALID_TYPES = ['PROFORMA', 'TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'PAYMENT_RECEIPT', 'ADJUSTMENT_NOTE']
const VALID_STATUSES = [
  'Draft', 'Sent', 'Viewed', 'Accepted',
  'Payment Submitted', 'Under Verification',
  'Paid', 'Converted To Invoice',
  'Cancelled', 'Expired',
]

function getFinancialYear(date: Date): string {
  const m = date.getMonth()
  const y = date.getFullYear()
  const startYear = m >= 3 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

const TYPE_PREFIXES: Record<string, string> = {
  PROFORMA: 'PF',
  TAX_INVOICE: 'INV',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  PAYMENT_RECEIPT: 'RCPT',
  ADJUSTMENT_NOTE: 'AN',
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
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const documentType = searchParams.get('type') ?? ''
    const status       = searchParams.get('status') ?? ''
    const page  = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    const where: Record<string, unknown> = { businessId }
    if (documentType) where.documentType = documentType
    if (status)       where.status = status

    const [docs, total] = await Promise.all([
      db.billingDocument.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      db.billingDocument.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: docs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch documents'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const body = await req.json() as {
      documentType: string
      status?: string
      amount: number
      currency?: string
      chargeId?: string
      gstRate?: number
      cgstAmount?: number
      sgstAmount?: number
      igstAmount?: number
      totalWithGst?: number
      lineItems?: unknown[]
      notes?: string
      validUntil?: string
      issuedDate?: string
      billingRecordId?: string
      linkedDocId?: string
      createdById?: string
      createdByName?: string
      metadata?: Record<string, unknown>
    }

    if (!body.documentType || !VALID_TYPES.includes(body.documentType)) {
      return NextResponse.json({ success: false, error: `documentType must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 })
    }

    const biz = await db.business.findUnique({ where: { id: businessId }, select: { id: true } })
    if (!biz) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    const ps = await getPlatformSettings()
    const issuedDate = body.issuedDate ? new Date(body.issuedDate) : new Date()
    const documentNumber = await generateDocNumber(body.documentType, issuedDate, ps.invoicePrefix)
    const initialStatus = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'Draft'

    const doc = await db.billingDocument.create({
      data: {
        documentNumber,
        documentType:   body.documentType,
        businessId,
        chargeId:       body.chargeId ?? null,
        billingRecordId: body.billingRecordId ?? null,
        linkedDocId:    body.linkedDocId ?? null,
        status:         initialStatus,
        amount:         body.amount,
        currency:       body.currency ?? 'INR',
        gstRate:        body.gstRate ?? null,
        cgstAmount:     body.cgstAmount ?? null,
        sgstAmount:     body.sgstAmount ?? null,
        igstAmount:     body.igstAmount ?? null,
        totalWithGst:   body.totalWithGst ?? null,
        lineItems:      body.lineItems ? JSON.stringify(body.lineItems) : '[]',
        notes:          body.notes ?? null,
        validUntil:     body.validUntil ? new Date(body.validUntil) : null,
        issuedDate,
        createdById:    body.createdById ?? null,
        createdByName:  body.createdByName ?? null,
        metadata:       body.metadata ? JSON.stringify(body.metadata) : '{}',
      },
    })

    return NextResponse.json({ success: true, data: doc })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create document'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
