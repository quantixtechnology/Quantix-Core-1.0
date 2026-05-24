// ============================================================================
// QUANTIX CORE — Workforce Settings API
// GET  /api/core/businesses/[businessId]/workforce-settings
// PUT  /api/core/businesses/[businessId]/workforce-settings
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const settings = await db.workforceSettings.findUnique({ where: { businessId } });

    return NextResponse.json({
      success: true,
      data: settings || {
        businessId,
        partnerLabel: 'Delivery Partner',
        partnerLabelPlural: 'Delivery Partners',
        onlineLabel: 'Online',
        offlineLabel: 'Offline',
        busyLabel: 'Busy',
        internalLabel: 'Internal',
        externalLabel: 'External',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get workforce settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = await req.json() as {
      partnerLabel?: string;
      partnerLabelPlural?: string;
      onlineLabel?: string;
      offlineLabel?: string;
      busyLabel?: string;
      internalLabel?: string;
      externalLabel?: string;
    };

    const settings = await db.workforceSettings.upsert({
      where: { businessId },
      create: { businessId, ...body },
      update: { ...body },
    });

    return NextResponse.json({ success: true, data: settings, message: 'Workforce settings saved' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workforce settings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
