// ============================================================================
// GET /api/core/delivery/partners/:partnerId/history
// Delivery history for a partner — paginated, filterable by status.
// Query params: status (active|completed|all), page, limit
// Accessible by CLIENT_OWNER / STORE_MANAGER / QUANTIX_SUPER_ADMIN and the
// partner themselves (DELIVERY_STAFF).
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

    if (user.role === 'DELIVERY_STAFF' && partner.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }
    if (!user.isPlatformAdmin && user.role !== 'DELIVERY_STAFF' && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Delivery partner not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'all';
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1',  10));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));

    let statusWhere: Record<string, unknown> = {};
    if (statusFilter === 'active') {
      statusWhere = { status: { in: ['ASSIGNING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'ARRIVED'] } };
    } else if (statusFilter === 'completed') {
      statusWhere = { status: 'DELIVERED' };
    }

    const [total, deliveries] = await Promise.all([
      db.delivery.count({ where: { deliveryPartnerId: partnerId, ...statusWhere } }),
      db.delivery.findMany({
        where: { deliveryPartnerId: partnerId, ...statusWhere },
        include: {
          order: {
            select: {
              id: true, orderNumber: true, status: true,
              totalAmount: true, deliveryFee: true,
              customerName: true, customerPhone: true,
              deliveryAddress: true,
              createdAt: true, deliveredAt: true,
              store: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: deliveries,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch history';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
