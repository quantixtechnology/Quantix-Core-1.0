// ============================================================================
// QUANTIX CORE — Order Detail API
// GET /api/core/orders/[orderId] — Get order with items, delivery, payments, status history
// ============================================================================

import { NextResponse } from 'next/server';
import { getOrder } from '@/lib/core/order';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const order = await getOrder(orderId);

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 404 }
    );
  }
}
