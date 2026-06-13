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

      // Find the delivery partner profile for this user.
      // SECURITY: scoped by businessId — a user who is a delivery partner in
      // multiple businesses must only ever resolve to the profile of the
      // business they are logged into, never an arbitrary first match.
      const deliveryPartner = await db.deliveryPartner.findFirst({
        where: {
          userId: user.id,
          ...(user.businessId ? { businessId: user.businessId } : {}),
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
        // Includes FAILED/CANCELLED so the app can show delivery history
        // and count failed deliveries (dashboard stat tiles).
        deliveryStatusFilter = {
          status: { in: ['DELIVERED', 'FAILED', 'CANCELLED'] },
        };
      } else {
        deliveryStatusFilter = {};
      }

      // Get deliveries assigned to this partner
      // SECURITY (store isolation): when the partner is assigned to a specific
      // store, restrict to that store's orders as defense-in-depth on top of the
      // deliveryPartnerId scope. Partners with no store (legacy) keep business scope.
      const deliveries = await db.delivery.findMany({
        where: {
          deliveryPartnerId: deliveryPartner.id,
          ...(deliveryPartner.storeId ? { order: { storeId: deliveryPartner.storeId } } : {}),
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
        actualDeliveryTime: delivery.actualDeliveryTime,
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
