// GET  /api/admin/account-billing/[businessId]/invoices   — paginated invoice list
// POST /api/admin/account-billing/[businessId]/invoices   — create one invoice
//
// One invoice per billing period. Line items come from selected services.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

function getFinancialYear(date: Date): string {
  const m = date.getMonth(); const y = date.getFullYear()
  const s = m >= 3 ? y : y - 1
  return `${s}-${String((s + 1) % 100).padStart(2, '0')}`
}

async function nextInvoiceNumber(fy: string): Promise<string> {
  const seq = await db.billingInvoiceSeq.upsert({
    where: { financialYear: fy },
    update: { nextVal: { increment: 1 } },
    create: { financialYear: fy, nextVal: 2, updatedAt: new Date() },
  })
  return `INV/${fy}/${String(seq.nextVal - 1).padStart(4, '0')}`
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
    const page  = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip  = (page - 1) * limit

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } })

    const [invoices, total] = await Promise.all([
      db.billingInvoice.findMany({
        where:   { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take:    limit,
        include: {
          payments: { select: { id: true, amount: true, status: true, paidAt: true, paymentMode: true } },
        },
      }),
      db.billingInvoice.count({ where: { accountId: account.id } }),
    ])

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch invoices'
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
      billingPeriod?:  string       // "June 2026"
      periodStart?:    string
      periodEnd?:      string
      dueDate?:        string
      taxRate?:        number       // 0 | 5 | 12 | 18 | 28
      cgstRate?:       number
      sgstRate?:       number
      igstRate?:       number
      notes?:          string
      lineItems: Array<{
        serviceId?:    string
        name:          string
        description?:  string
        quantity:      number
        unitPrice:     number
      }>
      createdById?:    string
      createdByName?:  string
    }

    if (!body.lineItems?.length) return NextResponse.json({ success: false, error: 'lineItems required' }, { status: 400 })

    const now = new Date()
    const fy  = getFinancialYear(now)
    const invoiceNumber = await nextInvoiceNumber(fy)

    const account = await db.billingAccount.upsert({ where: { businessId }, create: { businessId }, update: {} })

    const taxRate   = body.taxRate  ?? 18
    const cgstRate  = body.cgstRate ?? (body.igstRate ? 0 : taxRate / 2)
    const sgstRate  = body.sgstRate ?? (body.igstRate ? 0 : taxRate / 2)
    const igstRate  = body.igstRate ?? 0

    const subtotal    = body.lineItems.reduce((s, li) => s + li.quantity * li.unitPrice, 0)
    const cgstAmount  = Math.round(subtotal * cgstRate / 100 * 100) / 100
    const sgstAmount  = Math.round(subtotal * sgstRate / 100 * 100) / 100
    const igstAmount  = Math.round(subtotal * igstRate / 100 * 100) / 100
    const taxAmount   = cgstAmount + sgstAmount + igstAmount
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100

    const lineItemsJson = JSON.stringify(
      body.lineItems.map(li => ({
        serviceId:   li.serviceId ?? null,
        name:        li.name,
        description: li.description ?? null,
        quantity:    li.quantity,
        unitPrice:   li.unitPrice,
        amount:      Math.round(li.quantity * li.unitPrice * 100) / 100,
      }))
    )

    const result = await db.$transaction(async (tx) => {
      const invoice = await tx.billingInvoice.create({
        data: {
          invoiceNumber,
          accountId:    account.id,
          businessId,
          status:       'DRAFT',
          billingPeriod: body.billingPeriod ?? null,
          periodStart:   body.periodStart ? new Date(body.periodStart) : null,
          periodEnd:     body.periodEnd   ? new Date(body.periodEnd)   : null,
          lineItems:     lineItemsJson,
          subtotal,
          taxRate,
          cgstRate, sgstRate, igstRate,
          cgstAmount, sgstAmount, igstAmount,
          taxAmount,
          totalAmount,
          paidAmount:   0,
          issuedDate:   now,
          dueDate:      body.dueDate ? new Date(body.dueDate) : null,
          notes:        body.notes ?? null,
          createdById:  body.createdById   ?? null,
          createdByName: body.createdByName ?? null,
        },
      })

      // Create normalised BillingInvoiceItem rows
      if (body.lineItems.length > 0) {
        await tx.billingInvoiceItem.createMany({
          data: body.lineItems.map(li => ({
            invoiceId:   invoice.id,
            serviceId:   li.serviceId ?? null,
            name:        li.name,
            description: li.description ?? null,
            quantity:    li.quantity,
            unitPrice:   li.unitPrice,
            amount:      Math.round(li.quantity * li.unitPrice * 100) / 100,
          })),
        })
      }

      // Ledger entry: INVOICE_RAISED (debit)
      const currentBalance = await tx.billingLedger.findFirst({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        select: { balance: true },
      })
      const prevBalance = currentBalance?.balance ?? 0
      await tx.billingLedger.create({
        data: {
          accountId:       account.id,
          businessId,
          entryType:       'INVOICE_RAISED',
          description:     `Invoice ${invoiceNumber}${body.billingPeriod ? ' — ' + body.billingPeriod : ''}`,
          debit:           totalAmount,
          credit:          0,
          balance:         Math.round((prevBalance + totalAmount) * 100) / 100,
          referenceType:   'INVOICE',
          referenceId:     invoice.id,
          referenceNumber: invoiceNumber,
          date:            now,
        },
      })

      // Audit
      await tx.billingAudit.create({
        data: {
          accountId:       account.id,
          businessId,
          action:          'INVOICE_CREATED',
          entityType:      'INVOICE',
          entityId:        invoice.id,
          description:     `Invoice ${invoiceNumber} created — ₹${totalAmount.toLocaleString('en-IN')}${body.billingPeriod ? ' for ' + body.billingPeriod : ''}`,
          newValue:        JSON.stringify({ invoiceNumber, totalAmount, status: 'DRAFT' }),
          performedById:   body.createdById   ?? null,
          performedByName: body.createdByName ?? null,
        },
      })

      return invoice
    })

    return NextResponse.json({
      success: true,
      data:    result,
      message: `Invoice ${invoiceNumber} created — ₹${totalAmount.toLocaleString('en-IN')}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create invoice'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
