// ============================================================================
// PATCH  /api/admin/businesses/[businessId]/addons/[addonId] — update add-on
// DELETE /api/admin/businesses/[businessId]/addons/[addonId] — deactivate add-on
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_TEAM'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const addonId = params?.addonId as string;
    if (!businessId || !addonId) return NextResponse.json({ success: false, error: 'businessId and addonId required' }, { status: 400 });

    const existing = await db.addon.findFirst({ where: { id: addonId, businessId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Add-on not found' }, { status: 404 });

    const body = (await req.json()) as {
      name?: string;
      description?: string;
      amount?: number;
      billingType?: 'ONE_TIME' | 'RECURRING';
      cycle?: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | null;
      status?: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
      endDate?: string | null;
    };

    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name.trim();
    if (body.description !== undefined) update.description = body.description?.trim() || null;
    if (body.amount !== undefined) update.amount = body.amount;
    if (body.status !== undefined) update.status = body.status;
    if (body.endDate !== undefined) update.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.billingType !== undefined) {
      update.billingType = body.billingType;
      update.cycle = body.billingType === 'RECURRING' ? (body.cycle ?? existing.cycle) : null;
    } else if (body.cycle !== undefined) {
      update.cycle = body.cycle;
    }

    const updated = await db.addon.update({ where: { id: addonId }, data: update });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update add-on';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'],
})(async (_req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const addonId = params?.addonId as string;
    if (!businessId || !addonId) return NextResponse.json({ success: false, error: 'businessId and addonId required' }, { status: 400 });

    const existing = await db.addon.findFirst({ where: { id: addonId, businessId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Add-on not found' }, { status: 404 });

    await db.addon.update({ where: { id: addonId }, data: { status: 'INACTIVE' } });
    return NextResponse.json({ success: true, message: 'Add-on deactivated' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate add-on';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
