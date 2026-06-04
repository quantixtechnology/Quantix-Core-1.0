// ============================================================================
// GET  /api/admin/businesses/[businessId]/addons — list add-ons for a business
// POST /api/admin/businesses/[businessId]/addons — create a new add-on
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (_req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });

    const addons = await db.addon.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: addons });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch add-ons';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });

    const body = (await req.json()) as {
      name: string;
      description?: string;
      amount: number;
      billingType: 'ONE_TIME' | 'RECURRING';
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
      startDate?: string;
      endDate?: string;
    };

    if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ success: false, error: 'amount must be positive' }, { status: 400 });
    if (!['ONE_TIME', 'RECURRING'].includes(body.billingType)) {
      return NextResponse.json({ success: false, error: 'billingType must be ONE_TIME or RECURRING' }, { status: 400 });
    }
    if (body.billingType === 'RECURRING' && !body.cycle) {
      return NextResponse.json({ success: false, error: 'cycle is required for RECURRING add-ons' }, { status: 400 });
    }

    const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });

    const addon = await db.addon.create({
      data: {
        businessId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        amount: body.amount,
        billingType: body.billingType,
        cycle: body.billingType === 'RECURRING' ? body.cycle! : null,
        status: 'ACTIVE',
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });

    await db.activityLog.create({
      data: {
        businessId,
        action: 'ADDON_CREATED',
        entity: 'Addon',
        entityId: addon.id,
        details: JSON.stringify({ name: addon.name, amount: addon.amount, billingType: addon.billingType, cycle: addon.cycle }),
      },
    });

    return NextResponse.json({ success: true, data: addon }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create add-on';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
