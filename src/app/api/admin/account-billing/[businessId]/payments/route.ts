// GET  /api/admin/account-billing/[businessId]/payments
// POST /api/admin/account-billing/[businessId]/payments
// Clean payment CRUD against BillingInvoice. Always returns empty array — never 404.

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
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } })

    const [payments, total] = await Promise.all([
      db.billingPayment.findMany({
        where:   { accountId: account.id },
        orderBy: { paidAt: 'desc' },
        skip,
        take:    limit,
        include: {
          invoice: { select: { invoiceNumber: true, billingPeriod: true, totalAmount: true } },
        },
      }),
      db.billingPayment.count({ where: { accountId: account.id } }),
    ])

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payments'
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
      invoiceId:        string
      amount:           number
      paymentMode?:     string
      transactionId?:   string
      referenceNumber?: string
      bankName?:        string
      paidAt?:          string
      notes?:           string
      proofUrl?:        string
      proofFileType?:   string
      status?:          string
      recordedById?:    string
      recordedByName?:  string
    }

    if (!body.invoiceId) return NextResponse.json({ success: false, error: 'invoiceId required' }, { status: 400 })
    if (!body.amount || body.amount <= 0) return NextResponse.json({ success: false, error: 'amount must be > 0' }, { status: 400 })

    const account = await db.billingAccount.upsert({ where: { businessId }, create: { businessId }, update: {} })

    const invoice = await db.billingInvoice.findFirst({ where: { id: body.invoiceId, accountId: account.id } })
    if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })

    const paidAt  = body.paidAt ? new Date(body.paidAt) : new Date()
    const status  = body.status ?? 'COMPLETED'

    const result = await db.$transaction(async (tx) => {
      // Create payment
      const payment = await tx.billingPayment.create({
        data: {
          accountId:      account.id,
          businessId,
          invoiceId:      body.invoiceId,
          amount:         body.amount,
          paymentMode:    body.paymentMode    ?? null,
          transactionId:  body.transactionId  ?? null,
          referenceNumber: body.referenceNumber ?? null,
          bankName:       body.bankName        ?? null,
          status,
          notes:          body.notes           ?? null,
          proofUrl:       body.proofUrl        ?? null,
          proofFileType:  body.proofFileType   ?? null,
          paidAt,
          recordedById:   body.recordedById    ?? null,
          recordedByName: body.recordedByName  ?? null,
        },
      })

      // Update invoice paidAmount and status
      const newPaidAmount = Math.round((invoice.paidAmount + (status === 'COMPLETED' ? body.amount : 0)) * 100) / 100
      let newInvoiceStatus = invoice.status
      if (status === 'COMPLETED') {
        if (newPaidAmount >= invoice.totalAmount) {
          newInvoiceStatus = 'PAID'
        } else if (newPaidAmount > 0) {
          newInvoiceStatus = 'PARTIALLY_PAID'
        }
      }
      await tx.billingInvoice.update({
        where: { id: body.invoiceId },
        data:  { paidAmount: newPaidAmount, status: newInvoiceStatus },
      })

      // Ledger entry: PAYMENT_RECEIVED (credit)
      if (status === 'COMPLETED') {
        const lastEntry = await tx.billingLedger.findFirst({
          where:   { accountId: account.id },
          orderBy: { createdAt: 'desc' },
          select:  { balance: true },
        })
        const prevBalance = lastEntry?.balance ?? 0
        await tx.billingLedger.create({
          data: {
            accountId:       account.id,
            businessId,
            entryType:       'PAYMENT_RECEIVED',
            description:     `Payment for ${invoice.invoiceNumber}${body.paymentMode ? ' via ' + body.paymentMode : ''}`,
            debit:           0,
            credit:          body.amount,
            balance:         Math.round((prevBalance - body.amount) * 100) / 100,
            referenceType:   'PAYMENT',
            referenceId:     payment.id,
            referenceNumber: body.referenceNumber ?? body.transactionId ?? null,
            date:            paidAt,
          },
        })
      }

      // Audit
      await tx.billingAudit.create({
        data: {
          accountId:       account.id,
          businessId,
          action:          status === 'PENDING_VERIFICATION' ? 'PAYMENT_RECORDED' : 'PAYMENT_RECEIVED',
          entityType:      'PAYMENT',
          entityId:        payment.id,
          description:     `₹${body.amount.toLocaleString('en-IN')} ${status === 'PENDING_VERIFICATION' ? 'pending verification' : 'received'} for ${invoice.invoiceNumber}`,
          newValue:        JSON.stringify({ amount: body.amount, paymentMode: body.paymentMode, status }),
          performedById:   body.recordedById   ?? null,
          performedByName: body.recordedByName ?? null,
        },
      })

      return payment
    })

    return NextResponse.json({ success: true, data: result, message: `Payment of ₹${body.amount.toLocaleString('en-IN')} recorded` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
