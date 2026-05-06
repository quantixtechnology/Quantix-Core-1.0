import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  try {
    const { businessId, orderId } = await params;
    const body = await request.json();
    const { status, note, changedBy } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    const order = await db.order.findFirst({ where: { id: orderId, businessId } });
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Update order status
    const updateData: Record<string, unknown> = { status };
    const now = new Date();

    switch (status) {
      case 'CONFIRMED': updateData.confirmedAt = now; break;
      case 'PREPARING': updateData.preparedAt = now; break;
      case 'DELIVERED': updateData.deliveredAt = now; break;
      case 'CANCELLED': updateData.cancelledAt = now; break;
    }

    await db.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Create status history entry
    await db.orderStatusHistory.create({
      data: {
        orderId,
        status,
        note,
        changedBy,
      },
    });

    // Create delivery record for delivery orders
    if (status === 'CONFIRMED' && (order.orderType === 'DELIVERY' || order.orderType === 'PICKUP_AND_DELIVERY')) {
      const existingDelivery = await db.delivery.findUnique({ where: { orderId } });
      if (!existingDelivery) {
        await db.delivery.create({
          data: {
            orderId,
            status: 'ASSIGNING',
            pickupAddress: order.pickupAddress,
            dropAddress: order.deliveryAddress,
            dropLat: order.deliveryLat,
            dropLng: order.deliveryLng,
            deliveryOtp: order.deliveryOtp,
            pickupOtp: order.pickupOtp,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { orderId, status, changedAt: now },
    });
  } catch (error) {
    console.error('Change order status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change order status' },
      { status: 500 }
    );
  }
}
