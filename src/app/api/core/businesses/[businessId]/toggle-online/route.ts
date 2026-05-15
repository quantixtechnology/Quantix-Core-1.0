// ============================================================================
// QUANTIX CORE — Business Toggle Online API
// PUT  /api/core/businesses/[businessId]/toggle-online  — Toggle online/offline (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { toggleOnline } from '@/lib/core/business';

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = (await req.json()) as { isOnline: boolean };
    if (typeof body.isOnline !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid required field: isOnline (must be boolean)' },
        { status: 400 }
      );
    }

    const business = await toggleOnline(businessId, body.isOnline);
    return NextResponse.json({ success: true, data: business, message: `Business is now ${body.isOnline ? 'online' : 'offline'}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle online status';
    const status = message.includes('not found') ? 404 : message.includes('suspended') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
