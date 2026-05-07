// ============================================================================
// QUANTIX CORE — Business Detail API
// GET  /api/core/businesses/[businessId]  — Get business details
// PUT  /api/core/businesses/[businessId]  — Update business details
// ============================================================================

import { NextResponse } from 'next/server';
import { getBusiness, updateBusiness } from '@/lib/core/business';
import type { UpdateBusinessRequest } from '@/lib/core/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const business = await getBusiness(businessId);

    return NextResponse.json({
      success: true,
      data: business,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get business';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as UpdateBusinessRequest;

    const business = await updateBusiness(businessId, body);

    return NextResponse.json({
      success: true,
      data: business,
      message: 'Business updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update business';
    const status = message.includes('not found') ? 404 :
                   message.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
