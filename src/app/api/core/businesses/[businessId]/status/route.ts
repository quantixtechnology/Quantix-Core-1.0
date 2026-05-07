// ============================================================================
// QUANTIX CORE — Business Status API
// PUT  /api/core/businesses/[businessId]/status  — Update business status
// ============================================================================

import { NextResponse } from 'next/server';
import { updateBusinessStatus } from '@/lib/core/business';
import type { BusinessStatus } from '@/lib/core/types';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as { status: BusinessStatus; reason?: string };

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Validate status value
    const validStatuses: BusinessStatus[] = ['ONBOARDING', 'ACTIVE', 'SUSPENDED', 'CHURNED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const business = await updateBusinessStatus(businessId, body.status, body.reason);

    return NextResponse.json({
      success: true,
      data: business,
      message: `Business status updated to ${body.status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update business status';
    const status = message.includes('not found') ? 404 :
                   message.includes('Invalid status transition') || message.includes('already in') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
