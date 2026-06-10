// GET /api/admin/account-billing/accounts
// Lists every business with its BillingAccount state.
// Businesses without a BillingAccount are still returned (no account yet).

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

function healthScore(outstanding: number, overdueInvoices: number, subStatus: string | null): {
  score: 'Excellent' | 'Good' | 'Attention' | 'Critical'
  reason: string
} {
  if (overdueInvoices > 0 && outstanding > 50000)
    return { score: 'Critical',   reason: `${overdueInvoices} overdue invoice(s)` }
  if (overdueInvoices > 0)
    return { score: 'Attention',  reason: `${overdueInvoices} overdue invoice(s)` }
  if (outstanding > 10000)
    return { score: 'Attention',  reason: `₹${outstanding.toLocaleString('en-IN')} outstanding` }
  if (outstanding > 0)
    return { score: 'Good',       reason: 'Minor outstanding balance' }
  return   { score: 'Excellent',  reason: 'All payments up to date' }
}

function mrrFromServices(services: { billingType: string; billingCycle: string | null; unitPrice: number; quantity: number }[]): number {
  const cycleMonths: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
  return services
    .filter(s => s.billingType === 'RECURRING')
    .reduce((sum, s) => {
      const months = cycleMonths[s.billingCycle ?? 'MONTHLY'] ?? 1
      return sum + (s.unitPrice * s.quantity) / months
    }, 0)
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page   = Math.max(1, Number(searchParams.get('page')  ?? '1'))
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')))
    const skip   = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) where.name = { contains: search }
    if (status) where.status = status

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true, name: true, slug: true, status: true,
          contactEmail: true, contactPhone: true,
        },
      }),
      db.business.count({ where }),
    ])

    if (!businesses.length) {
      return NextResponse.json({ success: true, data: [], pagination: { page, limit, total, pages: 0 } })
    }

    const bizIds = businesses.map(b => b.id)

    // Load billing accounts with aggregate data
    const accounts = await db.billingAccount.findMany({
      where: { businessId: { in: bizIds } },
      include: {
        services: {
          where: { status: 'ACTIVE' },
          select: { billingType: true, billingCycle: true, unitPrice: true, quantity: true },
        },
        invoices: {
          where: { status: { notIn: ['CANCELLED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true, invoiceNumber: true, status: true,
            totalAmount: true, paidAmount: true, dueDate: true, billingPeriod: true,
          },
        },
        _count: { select: { invoices: true, services: true } },
      },
    })
    const accountMap = new Map(accounts.map(a => [a.businessId, a]))

    const now = new Date()

    const data = businesses.map(b => {
      const acc = accountMap.get(b.id) ?? null
      const latestInvoice = acc?.invoices[0] ?? null
      const outstanding = acc
        ? acc.invoices.reduce((s, inv) => s + Math.max(0, (inv.totalAmount - inv.paidAmount)), 0)
        : 0
      // Count overdue: we need to check all non-paid invoices — use a separate check for the row
      // For the list view, just approximate from what we have
      const overdueCount = latestInvoice && latestInvoice.status === 'OVERDUE' ? 1 : 0
      const health = healthScore(outstanding, overdueCount, null)
      const mrr = acc ? mrrFromServices(acc.services) : 0

      return {
        businessId:      b.id,
        businessName:    b.name,
        businessSlug:    b.slug,
        businessStatus:  b.status,
        contactEmail:    b.contactEmail,
        contactPhone:    b.contactPhone,
        hasAccount:      !!acc,
        accountId:       acc?.id ?? null,
        activeServices:  acc?._count.services ?? 0,
        totalInvoices:   acc?._count.invoices ?? 0,
        mrr:             Math.round(mrr),
        outstanding:     Math.round(outstanding),
        latestInvoice:   latestInvoice,
        health:          health.score,
        healthReason:    health.reason,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch accounts'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
