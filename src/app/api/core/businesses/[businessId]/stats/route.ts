// ============================================================================
// QUANTIX CORE — Business Stats API
// GET  /api/core/businesses/[businessId]/stats  — Get business stats (auth required)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getBusinessStats } from '@/lib/core/business';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const stats = await getBusinessStats(businessId);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get business stats';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not found') ? 404 : 500 });
  }
});
