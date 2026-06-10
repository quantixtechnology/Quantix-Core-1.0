// GET /api/admin/account-billing/[businessId]/ledger
// Chronological ledger with running balance.
// Sources: BillingRecords (legacy) + Charges + BillingDocuments (new flow).
// Never 404 — returns empty ledger when no records exist.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

interface LedgerEntry {
  id: string
  date: Date
  description: string
  entryType: string  // CHARGE | PAYMENT | DOCUMENT | CREDIT | ADJUSTMENT
  debit: number
  credit: number
  reference: string | null
  source: 'BILLING_RECORD' | 'BILLING_DOCUMENT' | 'CHARGE'
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    // Optional: legacy subscription (may not exist for new businesses)
    const sub = await db.businessSubscription.findUnique({ where: { businessId }, select: { id: true } })

    const [records, charges, documents] = await Promise.all([
      // Legacy billing records — only if subscription exists
      sub
        ? db.billingRecord.findMany({
            where: { businessSubscriptionId: sub.id },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, amount: true, status: true, invoiceNumber: true,
              dueDate: true, paidDate: true, createdAt: true, description: true,
              acknowledgeStatus: true, amountReceived: true, periodLabel: true,
              paymentMode: true, receiptReference: true, transactionNumber: true,
            },
          })
        : Promise.resolve([]),

      // New flow: Charges (PENDING / PAID)
      db.charge.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, serviceName: true, description: true, amount: true,
          currency: true, chargeType: true, status: true,
          dueDate: true, createdAt: true,
        },
      }),

      // Billing documents for credit/debit notes and receipts
      db.billingDocument.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, documentNumber: true, documentType: true, status: true,
          amount: true, createdAt: true, issuedDate: true, paidDate: true,
        },
      }),
    ])

    const entries: LedgerEntry[] = []

    // ── Legacy BillingRecords ──────────────────────────────────────────────
    for (const r of records) {
      entries.push({
        id: `br-charge-${r.id}`,
        date: r.dueDate,
        description: r.description ?? `Charge — ${r.periodLabel ?? 'Platform Subscription'}`,
        entryType: 'CHARGE',
        debit: r.amount,
        credit: 0,
        reference: r.invoiceNumber,
        source: 'BILLING_RECORD',
      })
      if (r.status === 'paid' && r.paidDate) {
        entries.push({
          id: `br-payment-${r.id}`,
          date: r.paidDate,
          description: `Payment Received${r.paymentMode ? ` — ${r.paymentMode}` : ''}${r.transactionNumber ? ` (${r.transactionNumber})` : ''}`,
          entryType: 'PAYMENT',
          debit: 0,
          credit: r.amountReceived ?? r.amount,
          reference: r.receiptReference ?? r.transactionNumber,
          source: 'BILLING_RECORD',
        })
      }
    }

    // ── New Charges ────────────────────────────────────────────────────────
    for (const c of charges) {
      entries.push({
        id: `charge-${c.id}`,
        date: c.dueDate ?? c.createdAt,
        description: c.description ?? c.serviceName,
        entryType: 'CHARGE',
        debit: c.amount,
        credit: 0,
        reference: null,
        source: 'CHARGE',
      })
      // Payments from new-flow charges are captured via PAYMENT_RECEIPT BillingDocuments below
    }

    // ── BillingDocuments (credit notes, debit notes, receipts) ────────────
    for (const d of documents) {
      if (d.documentType === 'CREDIT_NOTE') {
        entries.push({
          id: `doc-${d.id}`,
          date: d.issuedDate ?? d.createdAt,
          description: `Credit Note — ${d.documentNumber}`,
          entryType: 'CREDIT',
          debit: 0,
          credit: d.amount,
          reference: d.documentNumber,
          source: 'BILLING_DOCUMENT',
        })
      } else if (d.documentType === 'DEBIT_NOTE') {
        entries.push({
          id: `doc-${d.id}`,
          date: d.issuedDate ?? d.createdAt,
          description: `Debit Note — ${d.documentNumber}`,
          entryType: 'ADJUSTMENT',
          debit: d.amount,
          credit: 0,
          reference: d.documentNumber,
          source: 'BILLING_DOCUMENT',
        })
      } else if (d.documentType === 'PAYMENT_RECEIPT' && d.status === 'Paid') {
        entries.push({
          id: `receipt-${d.id}`,
          date: d.paidDate ?? d.createdAt,
          description: `Payment Receipt — ${d.documentNumber}`,
          entryType: 'PAYMENT',
          debit: 0,
          credit: d.amount,
          reference: d.documentNumber,
          source: 'BILLING_DOCUMENT',
        })
      }
    }

    // Sort chronologically
    entries.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Running balance
    let balance = 0
    const ledger = entries.map(e => {
      balance += e.debit - e.credit
      return { ...e, balance: Math.round(balance * 100) / 100 }
    })

    return NextResponse.json({ success: true, data: ledger, currentBalance: Math.round(balance * 100) / 100 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch ledger'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
