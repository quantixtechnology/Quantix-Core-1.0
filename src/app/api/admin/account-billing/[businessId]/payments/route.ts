// GET /api/admin/account-billing/[businessId]/payments
// Payment history: BillingRecords (legacy) + paid BillingDocuments (new flow).
// Returns empty array when no records exist — never 404.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const page  = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    // Legacy: BillingRecords linked to subscription
    const sub = await db.businessSubscription.findUnique({ where: { businessId }, select: { id: true } })

    const [records, legacyTotal] = sub
      ? await Promise.all([
          db.billingRecord.findMany({
            where: { businessSubscriptionId: sub.id },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          db.billingRecord.count({ where: { businessSubscriptionId: sub.id } }),
        ])
      : [[], 0]

    // New flow: paid BillingDocuments (PAYMENT_RECEIPT type)
    const [receipts, receiptTotal] = await Promise.all([
      db.billingDocument.findMany({
        where: { businessId, documentType: 'PAYMENT_RECEIPT' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, documentNumber: true, documentType: true, status: true,
          amount: true, currency: true, paidDate: true, createdAt: true,
          notes: true, createdByName: true,
        },
      }),
      db.billingDocument.count({ where: { businessId, documentType: 'PAYMENT_RECEIPT' } }),
    ])

    // Normalise both into a unified shape
    const legacyRows = records.map(r => ({
      id:              r.id,
      source:          'BILLING_RECORD',
      date:            r.paidDate ?? r.dueDate ?? r.createdAt,
      amount:          r.amountReceived ?? r.amount,
      paymentMode:     r.paymentMode,
      transactionNumber: r.transactionNumber ?? r.receiptReference,
      acknowledgeStatus: r.acknowledgeStatus,
      invoiceNumber:   r.invoiceNumber,
      paidDate:        r.paidDate,
      recordedByName:  null,
      proofUrl:        null,
    }))

    const receiptRows = receipts.map(r => ({
      id:              r.id,
      source:          'BILLING_DOCUMENT',
      date:            r.paidDate ?? r.createdAt,
      amount:          r.amount,
      paymentMode:     null,
      transactionNumber: r.documentNumber,
      acknowledgeStatus: 'PAYMENT_DONE',
      invoiceNumber:   r.documentNumber,
      paidDate:        r.paidDate,
      recordedByName:  r.createdByName,
      proofUrl:        null,
    }))

    const combined = [...legacyRows, ...receiptRows].sort(
      (a, b) => new Date(b.date as Date).getTime() - new Date(a.date as Date).getTime()
    )

    return NextResponse.json({
      success: true,
      data:    combined,
      pagination: { page, limit, total: legacyTotal + receiptTotal, pages: Math.ceil((legacyTotal + receiptTotal) / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payments'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
