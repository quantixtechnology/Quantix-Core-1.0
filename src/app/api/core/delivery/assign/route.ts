// ============================================================================
// QUANTIX CORE — Delivery Assign API
// POST /api/core/delivery/assign — Assign delivery partner to order
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { findNearestDeliveryPartner } from '@/lib/core/delivery';
import { emitDeliveryEvent, emitOrderEvent } from '@/lib/realtime-emitter';

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const body = await req.json();
    const user = req.user!;

    if (!body.orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Get the order with store location
    const order = await db.order.findUnique({
      where: { id: body.orderId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            address: true,
          },
        },
        delivery: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Enforce tenant + store isolation
    if (!user.isPlatformAdmin) {
      if (order.businessId !== user.businessId) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }
      // STORE_MANAGER can only assign delivery for orders belonging to their store
      if (user.role === 'STORE_MANAGER' && user.storeId && order.storeId !== user.storeId) {
        return NextResponse.json(
          { success: false, error: 'You can only assign delivery for orders in your store' },
          { status: 403 }
        );
      }
    }

    if (!order.delivery) {
      return NextResponse.json(
        { success: false, error: 'No delivery record found for this order' },
        { status: 400 }
      );
    }

    if (order.delivery.status !== 'ASSIGNING' && order.delivery.status !== 'ASSIGNED') {
      return NextResponse.json(
        { success: false, error: `Cannot reassign delivery in ${order.delivery.status} status` },
        { status: 400 }
      );
    }

    let deliveryPartnerId = body.deliveryPartnerId;
    let partnerInfo: { name: string; phone: string } | null = null;

    // Auto-assign if no partner specified
    if (!deliveryPartnerId) {
      if (!order.store.latitude || !order.store.longitude) {
        return NextResponse.json(
          { success: false, error: 'Store location not available for auto-assignment' },
          { status: 400 }
        );
      }

      const nearestPartner = await findNearestDeliveryPartner({
        businessId: order.businessId,
        pickupLat: order.store.latitude,
        pickupLng: order.store.longitude,
      });

      if (!nearestPartner.partnerId) {
        return NextResponse.json(
          { success: false, error: 'No available delivery partners found nearby' },
          { status: 400 }
        );
      }

      deliveryPartnerId = nearestPartner.partnerId;
      partnerInfo = {
        name: nearestPartner.partnerName || '',
        phone: nearestPartner.partnerPhone || '',
      };
    } else {
      // Validate specified partner
      const partner = await db.deliveryPartner.findFirst({
        where: {
          id: deliveryPartnerId,
          businessId: order.businessId,
          isActive: true,
        },
      });

      if (!partner) {
        return NextResponse.json(
          { success: false, error: 'Delivery partner not found or not active' },
          { status: 400 }
        );
      }

      partnerInfo = { name: partner.name, phone: partner.phone };
    }

    // Update delivery record
    const delivery = await db.delivery.update({
      where: { id: order.delivery.id },
      data: {
        deliveryPartnerId,
        status: 'ASSIGNED',
        estimatedPickupTime: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      },
    });

    // Also update order's deliveryPartnerId if applicable
    await db.order.update({
      where: { id: order.id },
      data: { deliveryPartnerId },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        businessId: order.businessId,
        action: 'delivery.assigned',
        entity: 'Delivery',
        entityId: delivery.id,
        details: JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: deliveryPartnerId,
          partnerName: partnerInfo?.name,
          autoAssigned: !body.deliveryPartnerId,
        }),
      },
    });

    // Emit real-time events after successful assignment
    try {
      await emitDeliveryEvent(order.businessId, order.id, {
        event: 'delivery:assigned',
        deliveryId: delivery.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        partnerId: deliveryPartnerId,
        partnerName: partnerInfo?.name,
        partnerPhone: partnerInfo?.phone,
        autoAssigned: !body.deliveryPartnerId,
      });

      // Also notify the customer if customerId exists
      if (order.customerId) {
        await emitDeliveryEvent(order.businessId, order.id, {
          event: 'delivery:assigned',
          deliveryId: delivery.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerId: deliveryPartnerId,
          partnerName: partnerInfo?.name,
          userId: order.customerId,
        });
      }

      // Emit order status changed (since order now has delivery assigned)
      await emitOrderEvent(order.businessId, 'order:updated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveryPartnerId,
        status: 'CONFIRMED',
      });
    } catch (emitErr) {
      console.error('[Delivery Assign API] Failed to emit delivery events:', emitErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        delivery,
        partner: partnerInfo,
        autoAssigned: !body.deliveryPartnerId,
      },
      message: 'Delivery partner assigned successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign delivery partner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
