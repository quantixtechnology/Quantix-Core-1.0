// ============================================================================
// QUANTIX CORE — Business Status API
// PUT  /api/core/businesses/[businessId]/status  — Update business status (platform admin only)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { updateBusinessStatus } from '@/lib/core/business';
import type { BusinessStatus } from '@/lib/core/types';

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const body = (await req.json()) as { status: BusinessStatus; reason?: string };

    if (!body.status) {
      return NextResponse.json({ success: false, error: 'Missing required field: status' }, { status: 400 });
    }

    const validStatuses: BusinessStatus[] = ['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'CHURNED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const business = await updateBusinessStatus(businessId, body.status, body.reason);
    return NextResponse.json({ success: true, data: business, message: `Business status updated to ${body.status}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update business status';
    const status = message.includes('not found') ? 404
      : message.includes('Invalid status transition') || message.includes('already in') ? 400
      : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
