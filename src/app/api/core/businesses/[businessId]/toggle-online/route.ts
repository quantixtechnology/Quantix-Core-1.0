// ============================================================================
// QUANTIX CORE — Business Toggle Online API
// PUT  /api/core/businesses/[businessId]/toggle-online  — Toggle online/offline
// ============================================================================

import { NextResponse } from 'next/server';
import { toggleOnline } from '@/lib/core/business';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as { isOnline: boolean };

    if (typeof body.isOnline !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid required field: isOnline (must be boolean)' },
        { status: 400 }
      );
    }

    const business = await toggleOnline(businessId, body.isOnline);

    return NextResponse.json({
      success: true,
      data: business,
      message: `Business is now ${body.isOnline ? 'online' : 'offline'}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle online status';
    const status = message.includes('not found') ? 404 :
                   message.includes('suspended') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
