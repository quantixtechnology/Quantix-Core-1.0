// ============================================================================
// QUANTIX CORE — Delivery Assign API
// POST /api/core/delivery/assign — Assign delivery partner to order
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { findNearestDeliveryPartner } from '@/lib/core/delivery';

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
}
