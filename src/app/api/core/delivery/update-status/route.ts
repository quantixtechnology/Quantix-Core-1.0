// ============================================================================
// QUANTIX CORE — Delivery Status Update API
// PUT /api/core/delivery/update-status — Update delivery status with OTP verification
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyOtp } from '@/lib/core/delivery';

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    if (!body.deliveryId) {
      return NextResponse.json(
        { success: false, error: 'deliveryId is required' },
        { status: 400 }
      );
    }
    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'status is required' },
        { status: 400 }
      );
    }

    const validStatuses = ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED', 'DELIVERED', 'FAILED', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const delivery = await db.delivery.findUnique({
      where: { id: body.deliveryId },
      include: { order: true },
    });

    if (!delivery) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found' },
        { status: 404 }
      );
    }

    // OTP verification for DELIVERED status
    if (body.status === 'DELIVERED') {
      if (delivery.deliveryOtp) {
        if (!body.otp) {
          return NextResponse.json(
            { success: false, error: 'OTP is required to mark delivery as delivered' },
            { status: 400 }
          );
        }
        if (!verifyOtp(delivery.deliveryOtp, body.otp)) {
          return NextResponse.json(
            { success: false, error: 'Invalid OTP' },
            { status: 400 }
          );
        }
      }
    }

    // Validate status transitions
    const transitions: Record<string, string[]> = {
      ASSIGNING: ['ASSIGNED', 'CANCELLED'],
      ASSIGNED: ['PICKED_UP', 'CANCELLED'],
      PICKED_UP: ['ON_THE_WAY', 'CANCELLED'],
      ON_THE_WAY: ['ARRIVED', 'CANCELLED'],
      ARRIVED: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      FAILED: [],
      CANCELLED: [],
    };

    const allowed = transitions[delivery.status] || [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot transition from ${delivery.status} to ${body.status}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status: body.status };

    if (body.status === 'PICKED_UP') {
      updateData.actualPickupTime = new Date();
    } else if (body.status === 'DELIVERED') {
      updateData.actualDeliveryTime = new Date();
    } else if (body.status === 'CANCELLED') {
      updateData.cancelReason = body.note || 'Cancelled by operator';
    }

    // Estimate delivery time for ON_THE_WAY
    if (body.status === 'ON_THE_WAY') {
      updateData.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000);
    }

    const updated = await db.delivery.update({
      where: { id: body.deliveryId },
      data: updateData,
    });

    // Sync order status for certain delivery statuses
    const orderStatusMap: Record<string, 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED'> = {
      ON_THE_WAY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    };
    const mappedOrderStatus = orderStatusMap[body.status];
    if (mappedOrderStatus) {
      await db.order.update({
        where: { id: delivery.orderId },
        data: { status: mappedOrderStatus },
      });

      // Record order status history
      await db.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          status: mappedOrderStatus,
          note: `Delivery status changed to ${body.status}`,
          changedBy: 'delivery_system',
        },
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        businessId: delivery.order.businessId,
        action: 'delivery.status_updated',
        entity: 'Delivery',
        entityId: delivery.id,
        details: JSON.stringify({
          orderId: delivery.orderId,
          orderNumber: delivery.order.orderNumber,
          from: delivery.status,
          to: body.status,
          otpVerified: body.status === 'DELIVERED' && delivery.deliveryOtp,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Delivery status updated to ${body.status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update delivery status';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
