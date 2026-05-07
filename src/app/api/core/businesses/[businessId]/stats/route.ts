// ============================================================================
// QUANTIX CORE — Business Stats API
// GET  /api/core/businesses/[businessId]/stats  — Get dashboard stats
// ============================================================================

import { NextResponse } from 'next/server';
import { getBusinessStats } from '@/lib/core/business';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const stats = await getBusinessStats(businessId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get business stats';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
