// GET  /api/admin/account-billing/[businessId]/services
// POST /api/admin/account-billing/[businessId]/services
// Unified service management: Platform Subscription, Add-On, One-Time charge.

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import { getPlatformSettings } from '@/lib/platform-settings'
import type { NextRequest } from 'next/server'

function cycleMonths(cycle: string): number {
  switch (cycle) {
    case 'MONTHLY':     return 1
    case 'QUARTERLY':   return 3
    case 'HALF_YEARLY': return 6
    case 'YEARLY':      return 12
    default:            return 1
  }
}
function addMonths(d: Date, months: number): Date {
  const r = new Date(d); r.setMonth(r.getMonth() + months); return r
}
function getFinancialYear(date: Date): string {
  const m = date.getMonth(); const y = date.getFullYear()
  const s = m >= 3 ? y : y - 1
  return `${s}-${String((s + 1) % 100).padStart(2, '0')}`
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const [sub, addons] = await Promise.all([
      db.businessSubscription.findUnique({ where: { businessId }, include: { plan: true } }),
      db.addon.findMany({ where: { businessId }, orderBy: { createdAt: 'asc' } }),
    ])

    const services: Array<Record<string, unknown>> = []

    if (sub) {
      const base = sub.finalAmount ?? sub.customPrice ?? sub.planPrice ?? 0
      services.push({
        id: sub.id,
        serviceType: 'Platform Plan',
        billingType: 'Recurring',
        name: sub.plan.name,
        description: `${sub.plan.tier} tier platform subscription`,
        amount: base,
        cycle: sub.billingCycle,
        status: sub.status,
        startDate: sub.currentPeriodStart,
        renewalDate: sub.nextBillingDate,
        source: 'SUBSCRIPTION',
      })
    }

    for (const a of addons) {
      services.push({
        id: a.id,
        serviceType: 'Add-On',
        billingType: a.billingType === 'ONE_TIME' ? 'One-Time' : 'Recurring',
        name: a.name,
        description: a.description,
        amount: a.amount,
        cycle: a.cycle ?? null,
        status: a.status,
        startDate: a.startDate,
        renewalDate: null,
        source: 'ADDON',
      })
    }

    return NextResponse.json({ success: true, data: services })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services'
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

    const biz = await db.business.findUnique({ where: { id: businessId }, select: { id: true } })
    if (!biz) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 })

    const body = await req.json() as {
      serviceType:    'PLATFORM_SUBSCRIPTION' | 'ADDON' | 'ONE_TIME'
      name:           string
      amount:         number
      billingCycle?:  string
      startDate?:     string
      nextDueDate?:   string
      planId?:        string
      description?:   string
      createdById?:   string
      createdByName?: string
    }

    if (!body.serviceType) return NextResponse.json({ success: false, error: 'serviceType required' }, { status: 400 })
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 })
    if (!body.amount || body.amount <= 0) return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 })

    const startDate = body.startDate ? new Date(body.startDate) : new Date()

    // ── Platform Subscription ──────────────────────────────────────────────
    if (body.serviceType === 'PLATFORM_SUBSCRIPTION') {
      if (!body.planId) return NextResponse.json({ success: false, error: 'planId required for Platform Subscription' }, { status: 400 })
      const billingCycle = (body.billingCycle ?? 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY'
      const nextDue = body.nextDueDate ? new Date(body.nextDueDate) : addMonths(startDate, cycleMonths(billingCycle))
      const sub = await db.businessSubscription.upsert({
        where: { businessId },
        create: {
          businessId, planId: body.planId, status: 'ACTIVE', billingCycle,
          customPrice: body.amount, finalAmount: body.amount,
          currentPeriodStart: startDate, currentPeriodEnd: nextDue, nextBillingDate: nextDue,
          allowedStores: 1, notes: body.description ?? null,
        },
        update: {
          planId: body.planId, billingCycle,
          customPrice: body.amount, finalAmount: body.amount,
          currentPeriodStart: startDate, currentPeriodEnd: nextDue, nextBillingDate: nextDue,
          status: 'ACTIVE', notes: body.description ?? null,
        },
      })
      return NextResponse.json({ success: true, data: { serviceType: 'PLATFORM_SUBSCRIPTION', id: sub.id }, message: 'Platform Subscription saved' })
    }

    // ── Add-On ────────────────────────────────────────────────────────────
    if (body.serviceType === 'ADDON') {
      const isRecurring = body.billingCycle && body.billingCycle !== 'ONE_TIME'
      const addon = await db.addon.create({
        data: {
          businessId, name: body.name.trim(), description: body.description ?? null,
          amount: body.amount,
          billingType: isRecurring ? 'RECURRING' : 'ONE_TIME',
          cycle: isRecurring ? (body.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY') : null,
          status: 'ACTIVE', startDate,
        },
      })
      return NextResponse.json({ success: true, data: { serviceType: 'ADDON', id: addon.id }, message: 'Add-On created' })
    }

    // ── One-Time Service → Charge + Proforma ──────────────────────────────
    if (body.serviceType === 'ONE_TIME') {
      await getPlatformSettings()
      const now = new Date()
      const fy  = getFinancialYear(now)
      const seq = await db.billingDocumentSequence.upsert({
        where: { financialYear_documentType: { financialYear: fy, documentType: 'PROFORMA' } },
        update: { nextVal: { increment: 1 } },
        create: { financialYear: fy, documentType: 'PROFORMA', nextVal: 2 },
      })
      const proformaNumber = `PF/${fy}/${String(seq.nextVal - 1).padStart(4, '0')}`
      const validUntil     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const [charge, proforma] = await db.$transaction(async (tx) => {
        const c = await tx.charge.create({
          data: {
            businessId, serviceName: body.name.trim(), description: body.description ?? null,
            amount: body.amount, currency: 'INR', chargeType: 'ONE_TIME', status: 'INVOICED',
            dueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        const p = await tx.billingDocument.create({
          data: {
            documentNumber: proformaNumber, documentType: 'PROFORMA',
            businessId, chargeId: c.id, status: 'Draft',
            amount: body.amount, currency: 'INR',
            lineItems: JSON.stringify([{ description: body.name.trim(), quantity: 1, unitPrice: body.amount, amount: body.amount }]),
            notes: body.description ?? null, validUntil, issuedDate: now,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        return [c, p]
      })
      return NextResponse.json({
        success: true,
        data: { serviceType: 'ONE_TIME', chargeId: charge.id, proformaId: proforma.id, proformaNumber },
        message: `One-time service created · Proforma ${proformaNumber} drafted`,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid serviceType' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create service'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
