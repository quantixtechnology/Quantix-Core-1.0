// ============================================================================
// QUANTIX CORE — Order Status Update API
// PUT /api/core/orders/[orderId]/status — Update order status
// ============================================================================

import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/core/order';
import { sendOrderNotification } from '@/lib/core/notification';
import { emitOrderEvent } from '@/lib/realtime-emitter';

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

    // Emit real-time event after successful status update
    try {
      await emitOrderEvent(body.businessId || '', 'order:status_changed', {
        orderId,
        orderNumber: (result as Record<string, unknown>).orderNumber,
        oldStatus: body.oldStatus || (result as Record<string, unknown>).previousStatus,
        newStatus: body.status,
        changedBy: body.changedBy || 'system',
        note: body.note,
      });
    } catch (emitErr) {
      console.error('[Order Status API] Failed to emit order:status_changed event:', emitErr);
    }

    // Send notification for order status change
    try {
      const statusToNotificationType: Record<string, 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'> = {
        CONFIRMED: 'confirmed',
        PREPARING: 'preparing',
        READY_FOR_PICKUP: 'ready',
        OUT_FOR_DELIVERY: 'out_for_delivery',
        DELIVERED: 'delivered',
        CANCELLED: 'cancelled',
      };
      const notificationType = statusToNotificationType[body.status];
      if (notificationType) {
        await sendOrderNotification(orderId, notificationType);
      }
    } catch (notifErr) {
      console.error('[Order Status API] Failed to send order notification:', notifErr);
    }

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
