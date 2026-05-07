// ============================================================================
// QUANTIX CORE — Delivery Serviceability Check API
// POST /api/core/delivery/check-serviceability — Check if delivery address is serviceable
// ============================================================================

import { NextResponse } from 'next/server';
import { checkServiceability } from '@/lib/core/delivery';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (body.deliveryLat === undefined || body.deliveryLat === null) {
      return NextResponse.json(
        { success: false, error: 'deliveryLat is required' },
        { status: 400 }
      );
    }
    if (body.deliveryLng === undefined || body.deliveryLng === null) {
      return NextResponse.json(
        { success: false, error: 'deliveryLng is required' },
        { status: 400 }
      );
    }

    const result = await checkServiceability({
      businessId: body.businessId,
      deliveryLat: body.deliveryLat,
      deliveryLng: body.deliveryLng,
      orderAmount: body.orderAmount,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check serviceability';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
