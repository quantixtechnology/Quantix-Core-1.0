// ============================================================================
// POST /api/admin/billing/[businessId]/record-payment
// Comprehensive payment recording replacing the old mark-received one-shot.
// Creates a BillingRecord with full acknowledgement workflow, generates an
// invoice, writes an audit log, and advances the subscription period when the
// payment is RECEIVED or WAIVED.
// ============================================================================

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'

const EXTRA_STORE_RATE = 1999

// Statuses that mean "money is confirmed → mark paid + advance period"
const ADVANCE_STATUSES = new Set(['RECEIVED', 'WAIVED'])
// Statuses that create a billing record but keep period unchanged
const PENDING_STATUSES = new Set(['PARTIALLY_RECEIVED', 'PENDING_VERIFICATION'])
// Statuses that log the action but set status = "pending" (no period advance)
const REJECTED_STATUSES = new Set(['REJECTED'])

function getFinancialYear(date: Date): string {
  const m = date.getMonth()
  const y = date.getFullYear()
  const startYear = m >= 3 ? y : y - 1
  const endYear = (startYear + 1) % 100
  return `${startYear}-${String(endYear).padStart(2, '0')}`
}

async function generateInvoiceNumber(date: Date, prefix: string): Promise<string> {
  const financialYear = getFinancialYear(date)
  const seq = await db.invoiceSequence.upsert({
    where: { financialYear },
    update: { nextVal: { increment: 1 } },
    create: { financialYear, nextVal: 2 },
  })
  return `${prefix}/${financialYear}/${String(seq.nextVal - 1).padStart(4, '0')}`
}

function addPeriod(date: Date, cycle: string): Date {
  const d = new Date(date)
  switch (cycle) {
    case 'MONTHLY':     d.setMonth(d.getMonth() + 1); break
    case 'QUARTERLY':   d.setMonth(d.getMonth() + 3); break
    case 'HALF_YEARLY': d.setMonth(d.getMonth() + 6); break
    case 'YEARLY':      d.setFullYear(d.getFullYear() + 1); break
  }
  return d
}

function billingStatus(acknowledgeStatus: string): string {
  if (ADVANCE_STATUSES.has(acknowledgeStatus)) return 'paid'
  if (acknowledgeStatus === 'PARTIALLY_RECEIVED') return 'paid'
  return 'pending'
}

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })
    }

    const body = (await req.json()) as {
      acknowledgeStatus: string
      amount: number
      amountReceived?: number
      paymentDate?: string
      paymentMode: string
      transactionNumber?: string
      receiptReference?: string
      bankName?: string
      paidBy?: string
      remarks?: string
      periodLabel?: string
      periodYear?: number
      proofUrl?: string
      proofFileType?: string
      nextDueDateMode?: string
      nextDueDateOverride?: string
      includeGst?: boolean
      isInterState?: boolean
      recordedById?: string
      recordedByName?: string
    }

    const validStatuses = ['RECEIVED', 'PARTIALLY_RECEIVED', 'PENDING_VERIFICATION', 'REJECTED', 'WAIVED']
    if (!body.acknowledgeStatus || !validStatuses.includes(body.acknowledgeStatus)) {
      return NextResponse.json({ success: false, error: 'acknowledgeStatus required: RECEIVED | PARTIALLY_RECEIVED | PENDING_VERIFICATION | REJECTED | WAIVED' }, { status: 400 })
    }
    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 })
    }
    if (!body.paymentMode && !PENDING_STATUSES.has(body.acknowledgeStatus) && !REJECTED_STATUSES.has(body.acknowledgeStatus)) {
      return NextResponse.json({ success: false, error: 'paymentMode required for this status' }, { status: 400 })
    }

    const sub = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    })
    if (!sub) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 })
    }

    const activeAddons = await db.addon.findMany({
      where: { businessId, status: 'ACTIVE', billingType: 'RECURRING' },
      orderBy: { createdAt: 'asc' },
    })

    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date()
    const includeGst  = body.includeGst !== false
    const shouldAdvance = ADVANCE_STATUSES.has(body.acknowledgeStatus)
    const recordStatus  = billingStatus(body.acknowledgeStatus)

    const extraStores      = Math.max(0, (sub.allowedStores ?? 1) - (sub.plan.maxStores ?? 1))
    const extraStoreAmount = extraStores > 0 ? extraStores * EXTRA_STORE_RATE : 0
    const addonTotal       = activeAddons.reduce((sum, a) => sum + a.amount, 0)

    type LineItem = { name: string; description?: string; amount: number; type: string }
    const lineItems: LineItem[] = [
      { name: `${sub.plan.name} — Platform Subscription`, amount: body.amount, type: 'SUBSCRIPTION' },
    ]
    if (extraStores > 0) {
      lineItems.push({ name: `Additional Stores (${extraStores} × ₹${EXTRA_STORE_RATE.toLocaleString('en-IN')})`, amount: extraStoreAmount, type: 'EXTRA_STORE' })
    }
    for (const addon of activeAddons) {
      lineItems.push({ name: addon.name, description: addon.description || undefined, amount: addon.amount, type: 'ADDON' })
    }

    const baseTotal = body.amount + extraStoreAmount + addonTotal
    let cgstAmount: number | null = null
    let sgstAmount: number | null = null
    let igstAmount: number | null = null
    let totalWithGst: number | null = null

    const ps = await getPlatformSettings()

    if (includeGst && recordStatus === 'paid') {
      const isInterState = body.isInterState ?? false
      const gstAmount    = Math.round(baseTotal * (ps.gstRate / 100) * 100) / 100
      if (isInterState) {
        igstAmount = gstAmount; cgstAmount = 0; sgstAmount = 0
      } else {
        cgstAmount = Math.round(baseTotal * (ps.cgstRate / 100) * 100) / 100
        sgstAmount = Math.round(baseTotal * (ps.sgstRate / 100) * 100) / 100
        igstAmount = 0
      }
      totalWithGst = Math.round((baseTotal + gstAmount) * 100) / 100
    }

    // Generate invoice number only when payment is confirmed
    const invoiceNumber = recordStatus === 'paid' ? await generateInvoiceNumber(paymentDate, ps.invoicePrefix) : null

    // Compute next due date
    let nextDueDate: Date
    if (body.nextDueDateMode === 'MANUAL' && body.nextDueDateOverride) {
      nextDueDate = new Date(body.nextDueDateOverride)
    } else {
      nextDueDate = addPeriod(sub.nextBillingDate, sub.billingCycle)
    }

    const billingRecord = await db.billingRecord.create({
      data: {
        businessSubscriptionId: sub.id,
        amount:               body.amount,
        currency:             'INR',
        status:               recordStatus,
        invoiceNumber,
        dueDate:              sub.nextBillingDate,
        paidDate:             recordStatus === 'paid' ? paymentDate : null,
        paymentMode:          body.paymentMode ?? null,
        paidBy:               body.paidBy ?? null,
        receiptReference:     body.receiptReference ?? null,
        remarks:              body.remarks ?? null,
        periodYear:           body.periodYear ?? paymentDate.getFullYear(),
        periodLabel:          body.periodLabel ?? null,
        description:          `Platform subscription — ${sub.plan.name}${body.paymentMode ? ` — ${body.paymentMode}` : ''}`,
        gstRate:              (includeGst && recordStatus === 'paid') ? ps.gstRate : null,
        cgstAmount:           cgstAmount ?? null,
        sgstAmount:           sgstAmount ?? null,
        igstAmount:           igstAmount ?? null,
        totalWithGst:         totalWithGst ?? null,
        extraStores:          extraStores > 0 ? extraStores : null,
        extraStoreAmount:     extraStoreAmount > 0 ? extraStoreAmount : null,
        lineItems:            lineItems.length > 1 ? JSON.stringify(lineItems) : null,
        addonTotal:           addonTotal > 0 ? addonTotal : null,
        acknowledgeStatus:    body.acknowledgeStatus,
        amountReceived:       body.amountReceived ?? body.amount,
        transactionNumber:    body.transactionNumber ?? null,
        bankName:             body.bankName ?? null,
        proofUrl:             body.proofUrl ?? null,
        proofFileType:        body.proofFileType ?? null,
        nextDueDateMode:      body.nextDueDateMode ?? 'AUTO',
        nextDueDateOverride:  body.nextDueDateMode === 'MANUAL' && body.nextDueDateOverride ? new Date(body.nextDueDateOverride) : null,
        recordedById:         body.recordedById ?? null,
        recordedByName:       body.recordedByName ?? null,
      },
    })

    if (shouldAdvance) {
      const newPeriodStart = sub.nextBillingDate
      const newPeriodEnd   = nextDueDate

      await db.businessSubscription.update({
        where: { id: sub.id },
        data: {
          lastPaymentDate:    paymentDate,
          lastPaymentAmount:  body.amount,
          paymentVerified:    true,
          paymentVerifiedAt:  paymentDate,
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd:   newPeriodEnd,
          nextBillingDate:    newPeriodEnd,
          status:             sub.status === 'PAST_DUE' ? 'ACTIVE' : undefined,
        },
      })
    }

    // Audit log
    await db.subscriptionPaymentAuditLog.create({
      data: {
        billingRecordId:        billingRecord.id,
        businessSubscriptionId: sub.id,
        businessId,
        businessName:     sub.businessId, // resolved by API caller; businessId is enough
        userId:           body.recordedById ?? null,
        userName:         body.recordedByName ?? null,
        action:           'PAYMENT_RECORDED',
        newStatus:        body.acknowledgeStatus,
        amount:           body.amount,
        referenceNumber:  body.receiptReference ?? body.transactionNumber ?? null,
        attachmentUrl:    body.proofUrl ?? null,
        notes:            body.remarks ?? null,
        metadata:         JSON.stringify({ paymentMode: body.paymentMode, periodLabel: body.periodLabel, invoiceNumber, addonCount: activeAddons.length }),
      },
    })

    await db.activityLog.create({
      data: {
        businessId,
        action:   'BILLING_PAYMENT_RECORDED',
        entity:   'BusinessSubscription',
        entityId: sub.id,
        details:  JSON.stringify({
          acknowledgeStatus: body.acknowledgeStatus,
          amount:            body.amount,
          amountReceived:    body.amountReceived,
          paymentMode:       body.paymentMode,
          invoiceNumber,
          periodLabel:       body.periodLabel,
          periodAdvanced:    shouldAdvance,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      invoiceNumber,
      acknowledgeStatus: body.acknowledgeStatus,
      periodAdvanced:    shouldAdvance,
      addonCount:        activeAddons.length,
      addonTotal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record payment'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
