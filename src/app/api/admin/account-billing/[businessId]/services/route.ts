// GET  /api/admin/account-billing/[businessId]/services
// POST /api/admin/account-billing/[businessId]/services
// Clean Service CRUD — every billable item is a Service (no Charge/Subscription).

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

async function ensureAccount(businessId: string) {
  return db.billingAccount.upsert({ where: { businessId }, create: { businessId }, update: {} })
}

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 })

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: true, data: [] })

    const services = await db.billingService.findMany({
      where:   { accountId: account.id },
      orderBy: { createdAt: 'asc' },
    })

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

    const body = await req.json() as {
      name:           string
      description?:   string
      category?:      string
      billingType:    'RECURRING' | 'ONE_TIME'
      billingCycle?:  string
      unitPrice:      number
      quantity?:      number
      startDate?:     string
      nextBillingDate?: string
      createdById?:   string
      createdByName?: string
    }

    if (!body.name?.trim())   return NextResponse.json({ success: false, error: 'name required' }, { status: 400 })
    if (!body.unitPrice || body.unitPrice <= 0) return NextResponse.json({ success: false, error: 'unitPrice must be > 0' }, { status: 400 })
    if (!body.billingType)    return NextResponse.json({ success: false, error: 'billingType required' }, { status: 400 })

    const account = await ensureAccount(businessId)

    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    let nextBillingDate: Date | null = null
    if (body.billingType === 'RECURRING') {
      if (body.nextBillingDate) {
        nextBillingDate = new Date(body.nextBillingDate)
      } else {
        const months: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
        const m = months[body.billingCycle ?? 'MONTHLY'] ?? 1
        nextBillingDate = new Date(startDate)
        nextBillingDate.setMonth(nextBillingDate.getMonth() + m)
      }
    }

    const service = await db.$transaction(async (tx) => {
      const svc = await tx.billingService.create({
        data: {
          accountId:       account.id,
          businessId,
          name:            body.name.trim(),
          description:     body.description?.trim() ?? null,
          category:        body.category ?? 'PLATFORM',
          billingType:     body.billingType,
          billingCycle:    body.billingType === 'RECURRING' ? (body.billingCycle ?? 'MONTHLY') : null,
          unitPrice:       body.unitPrice,
          quantity:        body.quantity ?? 1,
          startDate,
          nextBillingDate,
          createdById:     body.createdById   ?? null,
          createdByName:   body.createdByName ?? null,
        },
      })
      await tx.billingAudit.create({
        data: {
          accountId:       account.id,
          businessId,
          action:          'SERVICE_CREATED',
          entityType:      'SERVICE',
          entityId:        svc.id,
          description:     `Service created: ${svc.name} (${svc.billingType === 'RECURRING' ? svc.billingCycle + ' ₹' + svc.unitPrice : 'One-Time ₹' + svc.unitPrice})`,
          newValue:        JSON.stringify({ name: svc.name, unitPrice: svc.unitPrice, billingType: svc.billingType }),
          performedById:   body.createdById   ?? null,
          performedByName: body.createdByName ?? null,
        },
      })
      return svc
    })

    return NextResponse.json({ success: true, data: service, message: `Service "${service.name}" added` })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create service'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

// PATCH /:serviceId/status
export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest, context) => {
  try {
    const params = await context?.params
    const businessId = params?.businessId as string
    const { serviceId, status, performedById, performedByName } = await req.json() as {
      serviceId: string
      status: 'ACTIVE' | 'PAUSED' | 'CANCELLED'
      performedById?: string
      performedByName?: string
    }
    if (!serviceId || !status) return NextResponse.json({ success: false, error: 'serviceId and status required' }, { status: 400 })

    const account = await db.billingAccount.findUnique({ where: { businessId } })
    if (!account) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 })

    const svc = await db.billingService.findFirst({ where: { id: serviceId, accountId: account.id } })
    if (!svc) return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 })

    const updated = await db.$transaction(async (tx) => {
      const u = await tx.billingService.update({ where: { id: serviceId }, data: { status } })
      await tx.billingAudit.create({
        data: {
          accountId: account.id, businessId,
          action: `SERVICE_${status}`,
          entityType: 'SERVICE', entityId: serviceId,
          description: `Service "${svc.name}" status changed to ${status}`,
          oldValue: svc.status, newValue: status,
          performedById: performedById ?? null, performedByName: performedByName ?? null,
        },
      })
      return u
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update service'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
