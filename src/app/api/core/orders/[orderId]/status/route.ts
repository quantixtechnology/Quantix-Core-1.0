// ============================================================================
// QUANTIX CORE — Order Status Update API
// PUT /api/core/orders/[orderId]/status — Update order status
// ============================================================================

import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/core/order';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'status is required' },
        { status: 400 }
      );
    }

    const result = await updateOrderStatus(
      orderId,
      body.status,
      body.changedBy || 'system',
      body.note
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Order status updated to ${body.status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update order status';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
