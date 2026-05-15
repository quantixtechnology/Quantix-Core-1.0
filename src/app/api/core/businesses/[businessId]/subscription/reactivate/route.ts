// ============================================================================
// QUANTIX CORE — Subscription Reactivation API
// POST /api/core/businesses/[businessId]/subscription/reactivate (platform admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { reactivatePlatformSubscription } from '@/lib/core/subscription';

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (_req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const subscription = await db.businessSubscription.findUnique({ where: { businessId } });
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });
    }

    const result = await reactivatePlatformSubscription(subscription.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'Failed to reactivate subscription' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.subscription, message: 'Subscription reactivated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reactivate subscription';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
