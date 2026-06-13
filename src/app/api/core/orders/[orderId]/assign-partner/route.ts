// ============================================================================
// QUANTIX CORE — Admin: Assign Delivery Partner to Order
// POST /api/core/orders/[orderId]/assign-partner
// partnerId: string | null (null = unassign)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const orderId = params?.orderId as string;
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });

    const user = req.user!;
    const body = await req.json() as { partnerId: string | null };

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    if (!user.isPlatformAdmin && order.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    let partnerName: string | null = null;
    let partnerPhone: string | null = null;

    if (body.partnerId) {
      const partner = await db.deliveryPartner.findFirst({
        where: { id: body.partnerId, businessId: order.businessId, isActive: true },
      });
      if (!partner) return NextResponse.json({ success: false, error: 'Delivery partner not found or inactive' }, { status: 400 });
      partnerName = partner.name;
      partnerPhone = partner.phone;
    }

    await db.order.update({
      where: { id: orderId },
      data: { deliveryPartnerId: body.partnerId || null },
    });

    // Sync the Delivery sub-record so both the customer tracking API and the
    // delivery app can read the partner. updateMany() is a no-op when no Delivery
    // row exists yet — so when assigning, create one if missing. This guarantees
    // the partner has an actionable delivery record the moment they're assigned.
    if (body.partnerId) {
      const updated = await db.delivery.updateMany({
        where: { orderId },
        data: { deliveryPartnerId: body.partnerId, status: 'ASSIGNED' },
      });
      if (updated.count === 0) {
        const store = await db.store.findUnique({
          where: { id: order.storeId },
          select: { latitude: true, longitude: true, address: true, city: true, pincode: true },
        });
        await db.delivery.create({
          data: {
            orderId,
            deliveryPartnerId: body.partnerId,
            status: 'ASSIGNED',
            pickupLat: store?.latitude ?? null,
            pickupLng: store?.longitude ?? null,
            pickupAddress: store?.address
              ? JSON.stringify({ address: store.address, city: store.city, pincode: store.pincode })
              : null,
            dropAddress: order.deliveryAddress,
            deliveryOtp: order.deliveryOtp,
          },
        });
      }
    } else {
      await db.delivery.updateMany({
        where: { orderId },
        data: { deliveryPartnerId: null },
      });
    }

    return NextResponse.json({
      success: true,
      data: { partnerId: body.partnerId, partnerName, partnerPhone },
      message: body.partnerId ? `Assigned to ${partnerName}` : 'Partner unassigned',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
