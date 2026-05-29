// ============================================================================
// PATCH /api/core/delivery/orders/:orderId/deliver
// Delivery partner marks an order as delivered (ARRIVED → DELIVERED).
// :orderId is the Delivery record ID.
// If a deliveryOtp is set on the record the request body must include { otp }.
// Requires DELIVERY_STAFF auth — partner must be assigned to this delivery.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { verifyOtp } from '@/lib/core/delivery';

// Allow any status from PICKED_UP onward so the partner can skip
// intermediate ON_THE_WAY / ARRIVED steps from the mobile app.
const DELIVERABLE_STATUSES = ['PICKED_UP', 'ON_THE_WAY', 'ARRIVED'];

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
    const body = await req.json().catch(() => ({})) as { otp?: string };

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

    if (!DELIVERABLE_STATUSES.includes(delivery.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot mark delivered — current status is ${delivery.status}` },
        { status: 400 }
      );
    }

    // Verify OTP when set
    if (delivery.deliveryOtp) {
      if (!body.otp) {
        return NextResponse.json(
          { success: false, error: 'OTP is required to mark delivery as delivered' },
          { status: 400 }
        );
      }
      if (!verifyOtp(delivery.deliveryOtp, body.otp)) {
        return NextResponse.json({ success: false, error: 'Invalid OTP' }, { status: 400 });
      }
    }

    const now = new Date();

    await db.$transaction([
      db.delivery.update({
        where: { id: deliveryId },
        data: { status: 'DELIVERED', actualDeliveryTime: now },
      }),
      db.order.update({
        where: { id: delivery.orderId },
        data: { status: 'DELIVERED', deliveredAt: now },
      }),
      db.orderStatusHistory.create({
        data: {
          orderId: delivery.orderId,
          status: 'DELIVERED',
          note: 'Marked delivered by delivery partner',
          changedBy: user.id,
        },
      }),
    ]);

    // Increment partner delivery count
    if (delivery.deliveryPartnerId) {
      await db.deliveryPartner.update({
        where: { id: delivery.deliveryPartnerId },
        data: { totalDeliveries: { increment: 1 } },
      });
    }

    return NextResponse.json({ success: true, message: 'Order delivered successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark delivered';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
