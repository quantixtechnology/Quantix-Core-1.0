// GET  /api/admin/account-billing/[businessId]/services
// POST /api/admin/account-billing/[businessId]/services
//
// Every service creation ALWAYS produces:
//   Charge (PENDING/RECURRING|ONE_TIME) + Proforma (Draft)
// This is the entry point for the billing pipeline.

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
async function nextProformaNumber(fy: string): Promise<string> {
  const seq = await db.billingDocumentSequence.upsert({
    where: { financialYear_documentType: { financialYear: fy, documentType: 'PROFORMA' } },
    update: { nextVal: { increment: 1 } },
    create: { financialYear: fy, documentType: 'PROFORMA', nextVal: 2 },
  })
  return `PF/${fy}/${String(seq.nextVal - 1).padStart(4, '0')}`
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
        id: sub.id, serviceType: 'Platform Plan', billingType: 'Recurring',
        name: sub.plan.name,
        description: `${sub.plan.tier} tier platform subscription`,
        amount: base, cycle: sub.billingCycle, status: sub.status,
        startDate: sub.currentPeriodStart, renewalDate: sub.nextBillingDate,
        source: 'SUBSCRIPTION',
      })
    }

    for (const a of addons) {
      services.push({
        id: a.id, serviceType: 'Add-On',
        billingType: a.billingType === 'ONE_TIME' ? 'One-Time' : 'Recurring',
        name: a.name, description: a.description,
        amount: a.amount, cycle: a.cycle ?? null,
        status: a.status, startDate: a.startDate, renewalDate: null,
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
      billingCycle?:  string   // MONTHLY | QUARTERLY | HALF_YEARLY | YEARLY
      startDate?:     string
      nextDueDate?:   string   // manual override, else auto-calculated
      planId?:        string   // required for PLATFORM_SUBSCRIPTION
      description?:   string
      createdById?:   string
      createdByName?: string
    }

    if (!body.serviceType) return NextResponse.json({ success: false, error: 'serviceType required' }, { status: 400 })
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'name required' }, { status: 400 })
    if (!body.amount || body.amount <= 0) return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 })

    await getPlatformSettings()
    const now       = new Date()
    const fy        = getFinancialYear(now)
    const startDate = body.startDate ? new Date(body.startDate) : now

    // ── PLATFORM_SUBSCRIPTION ─────────────────────────────────────────────
    if (body.serviceType === 'PLATFORM_SUBSCRIPTION') {
      if (!body.planId) return NextResponse.json({ success: false, error: 'planId required' }, { status: 400 })
      const billingCycle = (body.billingCycle ?? 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY'
      const nextDue = body.nextDueDate ? new Date(body.nextDueDate) : addMonths(startDate, cycleMonths(billingCycle))
      const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const proformaNumber = await nextProformaNumber(fy)

      const result = await db.$transaction(async (tx) => {
        // 1. Upsert subscription
        const sub = await tx.businessSubscription.upsert({
          where: { businessId },
          create: {
            businessId, planId: body.planId!, status: 'ACTIVE', billingCycle,
            customPrice: body.amount, finalAmount: body.amount,
            currentPeriodStart: startDate, currentPeriodEnd: nextDue, nextBillingDate: nextDue,
            allowedStores: 1, notes: body.description ?? null,
          },
          update: {
            planId: body.planId!, billingCycle,
            customPrice: body.amount, finalAmount: body.amount,
            currentPeriodStart: startDate, currentPeriodEnd: nextDue, nextBillingDate: nextDue,
            status: 'ACTIVE', notes: body.description ?? null,
          },
        })
        // 2. Create charge
        const charge = await tx.charge.create({
          data: {
            businessId, serviceName: body.name.trim(),
            description: body.description ?? null,
            amount: body.amount, currency: 'INR',
            chargeType: 'RECURRING', status: 'PENDING',
            dueDate: nextDue, periodStart: startDate, periodEnd: nextDue,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        // 3. Create proforma
        const proforma = await tx.billingDocument.create({
          data: {
            documentNumber: proformaNumber, documentType: 'PROFORMA',
            businessId, chargeId: charge.id, status: 'Draft',
            amount: body.amount, currency: 'INR',
            lineItems: JSON.stringify([{
              description: body.name.trim(),
              detail: `${billingCycle.charAt(0) + billingCycle.slice(1).toLowerCase()} — ${startDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} to ${nextDue.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`,
              quantity: 1, unitPrice: body.amount, amount: body.amount,
            }]),
            notes: body.description ?? null, validUntil, issuedDate: now,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        // 4. Audit entries
        await tx.subscriptionPaymentAuditLog.createMany({
          data: [
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'SERVICE_CREATED',
              newStatus: 'ACTIVE',
              amount: body.amount,
              notes: `Platform Subscription: ${body.name.trim()}`,
              metadata: JSON.stringify({ serviceType: 'PLATFORM_SUBSCRIPTION', billingCycle, chargeId: charge.id }),
            },
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'PROFORMA_GENERATED',
              newStatus: 'Draft',
              amount: body.amount,
              referenceNumber: proformaNumber,
              notes: `Proforma ${proformaNumber} auto-generated for ${body.name.trim()}`,
              metadata: JSON.stringify({ proformaId: proforma.id, chargeId: charge.id }),
            },
          ],
        })
        return { sub, charge, proforma }
      })

      return NextResponse.json({
        success: true,
        data: { serviceType: 'PLATFORM_SUBSCRIPTION', subscriptionId: result.sub.id, chargeId: result.charge.id, proformaId: result.proforma.id, proformaNumber },
        message: `Platform Subscription saved · Charge created · Proforma ${proformaNumber} drafted`,
      })
    }

    // ── ADDON ─────────────────────────────────────────────────────────────
    if (body.serviceType === 'ADDON') {
      const isRecurring = body.billingCycle && body.billingCycle !== 'ONE_TIME'
      const chargeType  = isRecurring ? 'RECURRING' : 'ONE_TIME'
      const nextDue = isRecurring
        ? (body.nextDueDate ? new Date(body.nextDueDate) : addMonths(startDate, cycleMonths(body.billingCycle!)))
        : (body.nextDueDate ? new Date(body.nextDueDate) : null)
      const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const proformaNumber = await nextProformaNumber(fy)

      const result = await db.$transaction(async (tx) => {
        // 1. Create addon
        const addon = await tx.addon.create({
          data: {
            businessId, name: body.name.trim(), description: body.description ?? null,
            amount: body.amount,
            billingType: isRecurring ? 'RECURRING' : 'ONE_TIME',
            cycle: isRecurring ? (body.billingCycle as 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY') : null,
            status: 'ACTIVE', startDate,
          },
        })
        // 2. Create charge
        const charge = await tx.charge.create({
          data: {
            businessId, serviceName: body.name.trim(),
            description: body.description ?? null,
            amount: body.amount, currency: 'INR',
            chargeType, status: 'PENDING',
            dueDate: nextDue, periodStart: startDate,
            periodEnd: isRecurring ? nextDue : null,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        // 3. Create proforma
        const proforma = await tx.billingDocument.create({
          data: {
            documentNumber: proformaNumber, documentType: 'PROFORMA',
            businessId, chargeId: charge.id, status: 'Draft',
            amount: body.amount, currency: 'INR',
            lineItems: JSON.stringify([{ description: body.name.trim(), quantity: 1, unitPrice: body.amount, amount: body.amount }]),
            notes: body.description ?? null, validUntil, issuedDate: now,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        // 4. Audit entries
        await tx.subscriptionPaymentAuditLog.createMany({
          data: [
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'SERVICE_CREATED',
              newStatus: 'ACTIVE',
              amount: body.amount,
              notes: `Add-On: ${body.name.trim()}`,
              metadata: JSON.stringify({ serviceType: 'ADDON', chargeType, addonId: addon.id, chargeId: charge.id }),
            },
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'PROFORMA_GENERATED',
              newStatus: 'Draft',
              amount: body.amount,
              referenceNumber: proformaNumber,
              notes: `Proforma ${proformaNumber} auto-generated for ${body.name.trim()}`,
              metadata: JSON.stringify({ proformaId: proforma.id, chargeId: charge.id }),
            },
          ],
        })
        return { addon, charge, proforma }
      })

      return NextResponse.json({
        success: true,
        data: { serviceType: 'ADDON', addonId: result.addon.id, chargeId: result.charge.id, proformaId: result.proforma.id, proformaNumber },
        message: `Add-On created · Charge created · Proforma ${proformaNumber} drafted`,
      })
    }

    // ── ONE_TIME ──────────────────────────────────────────────────────────
    if (body.serviceType === 'ONE_TIME') {
      const proformaNumber = await nextProformaNumber(fy)
      const validUntil     = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const result = await db.$transaction(async (tx) => {
        const charge = await tx.charge.create({
          data: {
            businessId, serviceName: body.name.trim(), description: body.description ?? null,
            amount: body.amount, currency: 'INR', chargeType: 'ONE_TIME', status: 'PENDING',
            dueDate: body.nextDueDate ? new Date(body.nextDueDate) : null,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        const proforma = await tx.billingDocument.create({
          data: {
            documentNumber: proformaNumber, documentType: 'PROFORMA',
            businessId, chargeId: charge.id, status: 'Draft',
            amount: body.amount, currency: 'INR',
            lineItems: JSON.stringify([{ description: body.name.trim(), quantity: 1, unitPrice: body.amount, amount: body.amount }]),
            notes: body.description ?? null, validUntil, issuedDate: now,
            createdById: body.createdById ?? null, createdByName: body.createdByName ?? null,
          },
        })
        // Audit entries
        await tx.subscriptionPaymentAuditLog.createMany({
          data: [
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'SERVICE_CREATED',
              newStatus: 'PENDING',
              amount: body.amount,
              notes: `One-Time: ${body.name.trim()}`,
              metadata: JSON.stringify({ serviceType: 'ONE_TIME', chargeId: charge.id }),
            },
            {
              businessId, userId: body.createdById ?? null, userName: body.createdByName ?? null,
              action: 'PROFORMA_GENERATED',
              newStatus: 'Draft',
              amount: body.amount,
              referenceNumber: proformaNumber,
              notes: `Proforma ${proformaNumber} auto-generated for ${body.name.trim()}`,
              metadata: JSON.stringify({ proformaId: proforma.id, chargeId: charge.id }),
            },
          ],
        })
        return { charge, proforma }
      })

      return NextResponse.json({
        success: true,
        data: { serviceType: 'ONE_TIME', chargeId: result.charge.id, proformaId: result.proforma.id, proformaNumber },
        message: `One-time service created · Proforma ${proformaNumber} drafted`,
      })
    }

    return NextResponse.json({ success: false, error: 'Invalid serviceType' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create service'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
