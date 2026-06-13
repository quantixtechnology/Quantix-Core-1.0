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

// Derive the partner-facing stage badge from the order + delivery status, so a
// freshly-assigned order shows "Preparing" / "Ready for Pickup" immediately —
// not just once it reaches the delivery sub-states.
function deriveStage(orderStatus?: string | null, deliveryStatus?: string | null): string {
  const d = deliveryStatus || '';
  const o = orderStatus || '';
  if (d === 'DELIVERED' || o === 'DELIVERED') return 'Delivered';
  if (d === 'FAILED') return 'Failed';
  if (d === 'CANCELLED' || o === 'CANCELLED') return 'Cancelled';
  if (d === 'ON_THE_WAY' || d === 'ARRIVED' || o === 'OUT_FOR_DELIVERY') return 'Out for Delivery';
  if (d === 'PICKED_UP' || o === 'PICKED_UP') return 'Picked Up';
  if (o === 'READY_FOR_PICKUP' || o === 'READY_FOR_DELIVERY') return 'Ready for Pickup';
  if (['PENDING', 'CONFIRMED', 'PREPARING', 'PROCESSING', 'SCHEDULED', 'PICKUP_ASSIGNED'].includes(o)) return 'Preparing';
  if (d === 'ASSIGNED') return 'Ready for Pickup';
  return 'Assigned';
}

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
        // INCLUDES 'ASSIGNING' so a just-assigned order (Delivery still in its
        // initial ASSIGNING state, or the order linked via Order.deliveryPartnerId
        // before the sub-record transitions) appears immediately as an upcoming
        // delivery with a "Preparing"/"Ready for Pickup" badge.
        deliveryStatusFilter = {
          status: { in: ['ASSIGNING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] },
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

      const orderInclude = {
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            status: true,
            deliveryPartnerId: true,
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
      } as const;

      // Get deliveries assigned to this partner.
      // SECURITY (store isolation): when the partner is assigned to a specific
      // store, restrict to that store's orders as defense-in-depth on top of the
      // deliveryPartnerId scope. Partners with no store (legacy) keep business scope.
      //
      // RESILIENCE: the store-relation filter is wrapped so that any failure in
      // it (e.g. schema drift on a freshly-deployed column) degrades to the
      // partner-scoped feed instead of crashing the request — and is logged so
      // the real cause is visible in server logs rather than surfacing as a 502.
      // Match the partner via EITHER the Delivery sub-record OR the order-level
      // assignment. The admin "Assign Partner" action sets Order.deliveryPartnerId
      // and updateMany()s the Delivery — but if the Delivery row was never
      // transitioned (or matched), the order would otherwise be invisible here.
      const baseWhere = {
        ...deliveryStatusFilter,
        OR: [
          { deliveryPartnerId: deliveryPartner.id },
          { order: { deliveryPartnerId: deliveryPartner.id } },
        ],
      };
      let deliveries;
      try {
        deliveries = await db.delivery.findMany({
          where: {
            ...baseWhere,
            ...(deliveryPartner.storeId ? { order: { storeId: deliveryPartner.storeId } } : {}),
          },
          include: orderInclude,
          orderBy: { createdAt: 'desc' },
        });
      } catch (storeErr) {
        console.error(
          `[delivery/my-orders] store-scoped query failed for partner=${deliveryPartner.id} store=${deliveryPartner.storeId} — falling back to partner scope:`,
          storeErr
        );
        deliveries = await db.delivery.findMany({ where: baseWhere, include: orderInclude, orderBy: { createdAt: 'desc' } });
      }

      // Transform for delivery app
      const orders = deliveries.map((delivery) => ({
        deliveryId: delivery.id,
        deliveryStatus: delivery.status,
        orderStatus: delivery.order.status,
        // Partner-facing badge ("Preparing" / "Ready for Pickup" / "Out for
        // Delivery" / "Assigned" / "Picked Up" / "Delivered").
        stage: deriveStage(delivery.order.status, delivery.status),
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
      // Log the real error server-side (visible in `pm2 logs quantix`) so an
      // opaque 502/500 in the client always has a traceable cause here.
      console.error('[delivery/my-orders] FATAL:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Unable to load assigned orders',
          detail: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }
);
