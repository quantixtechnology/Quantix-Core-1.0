// GET  /api/admin/account-billing/[businessId]/charges
// POST /api/admin/account-billing/[businessId]/charges
//
// Account-centric billing workflow entry point.
// Creating a Charge auto-generates a PROFORMA document.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import type { NextRequest } from 'next/server'

const CHARGE_TYPES  = ['ONE_TIME', 'RECURRING', 'IMPLEMENTATION', 'CREDIT', 'ADJUSTMENT']
const CHARGE_STATUS = ['PENDING', 'INVOICED', 'PAID', 'CANCELLED', 'WAIVED']

function getFinancialYear(date: Date): string {
  const m = date.getMonth()
  const y = date.getFullYear()
  const startYear = m >= 3 ? y : y - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

async function generateDocNumber(documentType: string, date: Date, invoicePrefix: string): Promise<string> {
  const PREFIXES: Record<string, string> = {
    PROFORMA: 'PF', TAX_INVOICE: 'INV', CREDIT_NOTE: 'CN',
    DEBIT_NOTE: 'DN', PAYMENT_RECEIPT: 'RCPT', ADJUSTMENT_NOTE: 'AN',
  }
  const financialYear = getFinancialYear(date)
  const prefix = documentType === 'TAX_INVOICE' ? invoicePrefix : (PREFIXES[documentType] ?? documentType.slice(0, 2))
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
    const status     = searchParams.get('status') ?? ''
    const page       = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit      = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '25')))
    const skip       = (page - 1) * limit

    const where: Record<string, unknown> = { businessId }
    if (status && CHARGE_STATUS.includes(status)) where.status = status

    const [charges, total] = await Promise.all([
      db.charge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          documents: {
            select: { id: true, documentNumber: true, documentType: true, status: true, amount: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      db.charge.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: charges,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch charges'
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
      serviceName:   string
      description?:  string
      amount:        number
      currency?:     string
      chargeType?:   string
      serviceId?:    string
      dueDate?:      string
      periodStart?:  string
      periodEnd?:    string
      notes?:        string
      validDays?:    number  // proforma valid-until days (default 7)
      createdById?:  string
      createdByName?: string
    }

    if (!body.serviceName?.trim()) {
      return NextResponse.json({ success: false, error: 'serviceName is required' }, { status: 400 })
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 })
    }
    const chargeType = body.chargeType && CHARGE_TYPES.includes(body.chargeType) ? body.chargeType : 'ONE_TIME'

    const biz = await db.business.findUnique({ where: { id: businessId }, select: { id: true } })
    if (!biz) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    const ps = await getPlatformSettings()
    const now = new Date()
    const proformaNumber = await generateDocNumber('PROFORMA', now, ps.invoicePrefix)

    // Proforma valid-until: default 7 days
    const validDays = body.validDays && body.validDays > 0 ? body.validDays : 7
    const validUntil = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000)

    // Create charge + proforma in one transaction
    const [charge, proforma] = await db.$transaction(async (tx) => {
      const c = await tx.charge.create({
        data: {
          businessId,
          serviceId:    body.serviceId    ?? null,
          serviceName:  body.serviceName.trim(),
          description:  body.description  ?? null,
          amount:       body.amount,
          currency:     body.currency     ?? 'INR',
          chargeType,
          status:       'INVOICED',  // charge becomes INVOICED once proforma is raised
          dueDate:      body.dueDate     ? new Date(body.dueDate)     : null,
          periodStart:  body.periodStart ? new Date(body.periodStart) : null,
          periodEnd:    body.periodEnd   ? new Date(body.periodEnd)   : null,
          notes:        body.notes       ?? null,
          createdById:  body.createdById  ?? null,
          createdByName: body.createdByName ?? null,
        },
      })

      const p = await tx.billingDocument.create({
        data: {
          documentNumber: proformaNumber,
          documentType:   'PROFORMA',
          businessId,
          chargeId:       c.id,
          status:         'Draft',
          amount:         body.amount,
          currency:       body.currency ?? 'INR',
          lineItems:      JSON.stringify([{
            description: body.serviceName.trim(),
            quantity:    1,
            unitPrice:   body.amount,
            amount:      body.amount,
          }]),
          notes:        body.notes ?? null,
          validUntil,
          issuedDate:   now,
          createdById:  body.createdById  ?? null,
          createdByName: body.createdByName ?? null,
        },
      })

      return [c, p]
    })

    return NextResponse.json({
      success: true,
      data: { charge, proforma },
      message: `Charge created · Proforma ${proformaNumber} drafted`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create charge'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
