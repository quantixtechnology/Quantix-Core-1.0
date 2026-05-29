// ============================================================================
// GET /api/core/delivery/partners/:partnerId/earnings
// Admin view of a delivery partner's earnings summary.
// Requires CLIENT_OWNER / STORE_MANAGER / QUANTIX_SUPER_ADMIN auth.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM', 'DELIVERY_STAFF'],
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

    // DELIVERY_STAFF can only view their own earnings
    if (user.role === 'DELIVERY_STAFF' && partner.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }
    if (!user.isPlatformAdmin && user.role !== 'DELIVERY_STAFF' && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    const completedDeliveries = await db.delivery.findMany({
      where: { deliveryPartnerId: partnerId, status: 'DELIVERED' },
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, deliveryFee: true, deliveredAt: true } },
      },
      orderBy: { actualDeliveryTime: 'desc' },
    });

    const now = new Date();
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart    = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);

    const calcPeriod = (from: Date) => {
      const slice = completedDeliveries.filter(
        (d) => d.actualDeliveryTime && d.actualDeliveryTime >= from
      );
      const earnings = slice.reduce((sum, d) => sum + (d.order?.deliveryFee || 0) * 0.7, 0);
      return { count: slice.length, earnings: Math.round(earnings * 100) / 100 };
    };

    const recent = completedDeliveries.slice(0, 20).map((d) => ({
      orderId: d.order?.id,
      orderNumber: d.order?.orderNumber,
      deliveryFee: d.order?.deliveryFee || 0,
      partnerEarning: Math.round(((d.order?.deliveryFee || 0) * 0.7) * 100) / 100,
      deliveredAt: d.actualDeliveryTime,
    }));

    return NextResponse.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          name: partner.name,
          partnerCode: partner.partnerCode,
          totalDeliveries: partner.totalDeliveries,
          totalEarnings: partner.totalEarnings,
          rating: partner.rating,
          isOnline: partner.isOnline,
          availability: partner.availability,
        },
        today:     calcPeriod(todayStart),
        thisWeek:  calcPeriod(weekStart),
        thisMonth: calcPeriod(monthStart),
        allTime: {
          count: completedDeliveries.length,
          earnings: Math.round(completedDeliveries.reduce((s, d) => s + (d.order?.deliveryFee || 0) * 0.7, 0) * 100) / 100,
        },
        recentEarnings: recent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch earnings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
