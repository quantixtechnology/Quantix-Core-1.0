// ============================================================================
// PATCH /api/core/delivery/partners/:partnerId/offline
// Set a delivery partner's availability to OFFLINE.
// Accessible by the partner themselves (DELIVERY_STAFF) or store managers.
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
    const partnerId = params?.partnerId as string;

    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'Invalid partner ID' }, { status: 400 });
    }

    const user = req.user!;
    const partner = await db.deliveryPartner.findUnique({ where: { id: partnerId } });

    if (!partner) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    if (user.role === 'DELIVERY_STAFF') {
      if (partner.userId !== user.id) {
        return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
      }
    } else if (!user.isPlatformAdmin && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    const updated = await db.deliveryPartner.update({
      where: { id: partnerId },
      data: { isOnline: false, availability: 'OFFLINE' },
    });

    return NextResponse.json({ success: true, data: updated, message: 'Partner is now offline' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
