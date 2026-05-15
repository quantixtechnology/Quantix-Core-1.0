// ============================================================================
// QUANTIX CORE — Business Detail API
// GET  /api/core/businesses/[businessId]  — Get business details (auth required)
// PUT  /api/core/businesses/[businessId]  — Update business details (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getBusiness, updateBusiness } from '@/lib/core/business';
import type { UpdateBusinessRequest } from '@/lib/core/types';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;

    // Verify the user has access to this business
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const business = await getBusiness(businessId);
    return NextResponse.json({ success: true, data: business });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get business';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not found') ? 404 : 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;

    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = (await req.json()) as UpdateBusinessRequest;
    const business = await updateBusiness(businessId, body);

    return NextResponse.json({ success: true, data: business, message: 'Business updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update business';
    const status = message.includes('not found') ? 404 : message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
