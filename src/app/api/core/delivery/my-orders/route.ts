// ============================================================================
// QUANTIX CORE — Delivery Partner My Orders API
// GET /api/core/delivery/my-orders — Assigned orders for delivery partner
//
// Auth required (DELIVERY_STAFF role)
// Query params: status (active/completed/all)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['DELIVERY_STAFF'] })(
  async (req) => {
    try {
      const user = req.user!;
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get('status') || 'active';

      // Find the delivery partner profile for this user
      const deliveryPartner = await db.deliveryPartner.findFirst({
        where: {
          userId: user.id,
          isActive: true,
        },
      });

      if (!deliveryPartner) {
        return NextResponse.json(
          { success: false, error: 'Delivery partner profile not found' },
          { status: 404 }
        );
      }

      // Build where clause based on status filter
      let deliveryStatusFilter: Record<string, unknown>;
      if (statusFilter === 'active') {
        deliveryStatusFilter = {
          status: { in: ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] },
        };
      } else if (statusFilter === 'completed') {
        deliveryStatusFilter = {
          status: { in: ['DELIVERED'] },
        };
      } else {
        deliveryStatusFilter = {};
      }

      // Get deliveries assigned to this partner
      const deliveries = await db.delivery.findMany({
        where: {
          deliveryPartnerId: deliveryPartner.id,
          ...deliveryStatusFilter,
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              status: true,
              paymentStatus: true,
              paymentMethod: true,
              totalAmount: true,
              createdAt: true,
              customerName: true,
              customerPhone: true,
              deliveryAddress: true,
              deliveryInstructions: true,
              deliveryOtp: true,
              pickupOtp: true,
              store: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: true,
                  phone: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform for delivery app
      const orders = deliveries.map((delivery) => ({
        deliveryId: delivery.id,
        deliveryStatus: delivery.status,
        pickupAddress: delivery.pickupAddress,
        dropAddress: delivery.dropAddress,
        pickupLat: delivery.pickupLat,
        pickupLng: delivery.pickupLng,
        dropLat: delivery.dropLat,
        dropLng: delivery.dropLng,
        estimatedDeliveryTime: delivery.estimatedDeliveryTime,
        distance: delivery.distance,
        order: {
          ...delivery.order,
          store: delivery.order.store,
        },
      }));

      return NextResponse.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch delivery orders';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
