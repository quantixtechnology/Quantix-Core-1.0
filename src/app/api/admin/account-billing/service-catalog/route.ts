// GET  /api/admin/account-billing/service-catalog — list all items
// POST /api/admin/account-billing/service-catalog — create item

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { withMiddleware } from '@/lib/middleware'
import type { NextRequest } from 'next/server'

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const items = await db.serviceCatalog.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch catalog'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req: NextRequest) => {
  try {
    const body = await req.json() as {
      name: string
      description?: string
      serviceType: string
      billingType: string
      defaultAmount?: number
      sortOrder?: number
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 })
    }
    const validServiceTypes = ['Platform Plan', 'Add-On', 'Mobile App', 'Implementation',
      'Training', 'Support', 'Integration', 'Credits', 'Custom Development', 'Other']
    const validBillingTypes = ['Recurring', 'One-Time', 'Usage Based', 'Credit', 'Discount', 'Refund']
    if (!validServiceTypes.includes(body.serviceType)) {
      return NextResponse.json({ success: false, error: 'invalid serviceType' }, { status: 400 })
    }
    if (!validBillingTypes.includes(body.billingType)) {
      return NextResponse.json({ success: false, error: 'invalid billingType' }, { status: 400 })
    }
    const item = await db.serviceCatalog.create({
      data: {
        name: body.name.trim(),
        description: body.description ?? null,
        serviceType: body.serviceType,
        billingType: body.billingType,
        defaultAmount: body.defaultAmount ?? null,
        sortOrder: body.sortOrder ?? 0,
      },
    })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create catalog item'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
