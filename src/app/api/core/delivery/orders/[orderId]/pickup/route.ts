// ============================================================================
// PATCH /api/core/delivery/orders/:orderId/pickup
// Delivery partner marks an order as picked up (ASSIGNED → PICKED_UP).
// :orderId is the Delivery record ID.
// Requires DELIVERY_STAFF auth — partner must be assigned to this delivery.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['DELIVERY_STAFF', 'CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const deliveryId = params?.orderId as string;

    if (!deliveryId) {
      return NextResponse.json({ success: false, error: 'Invalid delivery ID' }, { status: 400 });
    }

    const user = req.user!;

    const delivery = await db.delivery.findUnique({
      where: { id: deliveryId },
      include: { order: { select: { id: true, businessId: true, orderNumber: true } } },
    });

    if (!delivery) {
      return NextResponse.json({ success: false, error: 'Delivery not found' }, { status: 404 });
    }

    if (user.role === 'DELIVERY_STAFF') {
      const partner = await db.deliveryPartner.findFirst({
        where: { userId: user.id, businessId: delivery.order.businessId, isActive: true },
      });
      if (!partner || delivery.deliveryPartnerId !== partner.id) {
        return NextResponse.json({ success: false, error: 'Not authorized for this delivery' }, { status: 403 });
      }
    }

    if (delivery.status !== 'ASSIGNED') {
      return NextResponse.json(
        { success: false, error: `Cannot mark pickup — current status is ${delivery.status}` },
        { status: 400 }
      );
    }

    const updated = await db.delivery.update({
      where: { id: deliveryId },
      data: { status: 'PICKED_UP', actualPickupTime: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Order picked up successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark pickup';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
