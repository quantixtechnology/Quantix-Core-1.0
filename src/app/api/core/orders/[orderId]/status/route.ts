// ============================================================================
// QUANTIX CORE — Order Status Update API
// PUT /api/core/orders/[orderId]/status — Update order status (auth required)
//
// STORE ISOLATION:
//   STORE_MANAGER → can only update orders in their assigned store
//   CLIENT_OWNER  → all stores in their business
//   Platform admins → any order
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getOrder, updateOrderStatus } from '@/lib/core/order';
import { sendOrderNotification } from '@/lib/core/notification';
import { emitStoreOrderEvent } from '@/lib/realtime-emitter';

export const PUT = withMiddleware({ requireAuth: true })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const orderId = params?.orderId as string;
      if (!orderId) {
        return NextResponse.json(
          { success: false, error: 'orderId is required' },
          { status: 400 }
        );
      }

      const user = req.user!;
      const body = await req.json();

      if (!body.status) {
        return NextResponse.json(
          { success: false, error: 'status is required' },
          { status: 400 }
        );
      }

      // Fetch order to verify access before mutating
      const order = await getOrder(orderId);

      if (!user.isPlatformAdmin) {
        // Verify the order belongs to the requesting user's business
        if (order.businessId !== user.businessId) {
          return NextResponse.json(
            { success: false, error: 'Order not found' },
            { status: 404 }
          );
        }

        // STORE_MANAGER: enforce store isolation — cannot update orders outside their store
        if (user.role === 'STORE_MANAGER' && user.storeId && order.storeId !== user.storeId) {
          return NextResponse.json(
            { success: false, error: 'You do not have permission to update this order' },
            { status: 403 }
          );
        }
      }

      const result = await updateOrderStatus(
        orderId,
        body.status,
        body.changedBy || user.id,
        body.note
      );

      // Emit real-time event — include storeId so store rooms can filter
      try {
        await emitStoreOrderEvent(order.businessId, order.storeId, 'order:status_changed', {
          orderId,
          orderNumber: (result as Record<string, unknown>).orderNumber,
          oldStatus: order.status,
          newStatus: body.status,
          changedBy: body.changedBy || user.id,
          note: body.note,
        });
      } catch (emitErr) {
        console.error('[Order Status API] Failed to emit order:status_changed event:', emitErr);
      }

      // Send customer notification for meaningful status changes
      try {
        const notifyStatuses: Record<string, 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled'> = {
          CONFIRMED: 'confirmed',
          PREPARING: 'preparing',
          READY_FOR_PICKUP: 'ready',
          OUT_FOR_DELIVERY: 'out_for_delivery',
          DELIVERED: 'delivered',
          CANCELLED: 'cancelled',
        };
        const notificationType = notifyStatuses[body.status];
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
);
