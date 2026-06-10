// GET /api/admin/account-billing/[businessId]
// Returns or auto-creates the BillingAccount for this business, with full summary.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const biz = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, status: true, contactEmail: true, contactPhone: true, address: true, city: true, state: true, gstNumber: true },
    })
    if (!biz) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    // Auto-create BillingAccount if it doesn't exist
    const account = await db.billingAccount.upsert({
      where: { businessId },
      create: { businessId },
      update: {},
      include: {
        services: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, name: true, category: true, billingType: true, billingCycle: true,
            unitPrice: true, quantity: true, status: true, startDate: true,
            nextBillingDate: true, description: true, createdAt: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true, invoiceNumber: true, status: true, billingPeriod: true,
            totalAmount: true, paidAmount: true, dueDate: true, issuedDate: true, createdAt: true,
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { amount: true, paidAt: true, paymentMode: true, status: true },
        },
        _count: { select: { services: true, invoices: true, payments: true } },
      },
    })

    // Outstanding = sum of (totalAmount - paidAmount) for non-cancelled/non-paid
    const unpaidInvoices = await db.billingInvoice.findMany({
      where: { accountId: account.id, status: { notIn: ['CANCELLED', 'PAID'] } },
      select: { totalAmount: true, paidAmount: true },
    })
    const outstanding = Math.round(unpaidInvoices.reduce((s, inv) => s + Math.max(0, inv.totalAmount - inv.paidAmount), 0))

    // MRR from active recurring services
    const cycleMonths: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
    const mrr = Math.round(
      account.services
        .filter(s => s.billingType === 'RECURRING' && s.status === 'ACTIVE')
        .reduce((sum, s) => {
          const months = cycleMonths[s.billingCycle ?? 'MONTHLY'] ?? 1
          return sum + (s.unitPrice * s.quantity) / months
        }, 0)
    )

    const lastPayment = account.payments[0] ?? null

    return NextResponse.json({
      success: true,
      data: {
        accountId:       account.id,
        businessId:      biz.id,
        businessName:    biz.name,
        businessSlug:    biz.slug,
        businessStatus:  biz.status,
        contactEmail:    biz.contactEmail,
        contactPhone:    biz.contactPhone,
        address:         [biz.address, biz.city, biz.state].filter(Boolean).join(', '),
        gstNumber:       biz.gstNumber,
        currency:        account.currency,
        billingEmail:    account.billingEmail,
        billingPhone:    account.billingPhone,
        billingAddress:  account.billingAddress,
        notes:           account.notes,
        // KPIs
        mrr,
        outstanding,
        activeServices:  account.services.filter(s => s.status === 'ACTIVE').length,
        totalServices:   account._count.services,
        totalInvoices:   account._count.invoices,
        totalPayments:   account._count.payments,
        lastPayment,
        // Data
        services:    account.services,
        recentInvoices: account.invoices,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load account'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
