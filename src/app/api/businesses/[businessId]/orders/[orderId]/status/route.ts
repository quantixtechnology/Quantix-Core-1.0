import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'SCHEDULED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  const { businessId, orderId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const body = await request.json();
      const { status, note } = body;

      if (!status) {
        return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
      }

      const order = await db.order.findFirst({ where: { id: orderId, businessId } });
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      const allowedStatuses = VALID_TRANSITIONS[order.status] || [];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: `Cannot transition from ${order.status} to ${status}` },
          { status: 400 }
        );
      }

      // Update order status with timestamps
      const updateData: Record<string, unknown> = { status };
      if (status === 'CONFIRMED') updateData.confirmedAt = new Date();
      if (status === 'PREPARING') updateData.preparedAt = new Date();
      if (status === 'DELIVERED') updateData.deliveredAt = new Date();
      if (status === 'CANCELLED') updateData.cancelledAt = new Date();

      const updated = await db.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // Create status history entry
      await db.orderStatusHistory.create({
        data: {
          orderId,
          status,
          note: note || `Status changed to ${status}`,
          changedBy: user.id,
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId: user.id,
          action: `order.status_changed`,
          entity: 'Order',
          entityId: orderId,
          details: JSON.stringify({ from: order.status, to: status, note }),
        },
      });

      // Create notification
      await db.notification.create({
        data: {
          businessId,
          userId: order.customerId ? (await db.customer.findUnique({ where: { id: order.customerId } }))?.userId : null,
          type: 'ORDER_STATUS',
          title: `Order ${order.orderNumber} - ${status}`,
          message: note || `Your order status has been updated to ${status}`,
          data: JSON.stringify({ orderId, orderNumber: order.orderNumber, status }),
          channel: 'in_app',
        },
      });

      return NextResponse.json({ success: true, data: updated, message: `Order status updated to ${status}` });
    } catch (error) {
      console.error('Change order status error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
