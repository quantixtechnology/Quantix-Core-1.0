// ============================================================================
// QUANTIX CORE — Order Detail API
// GET /api/core/orders/[orderId] — Get order (auth required, store-isolated)
//
// STORE ISOLATION:
//   STORE_MANAGER → only orders where order.storeId === user.storeId
//   CLIENT_OWNER  → any order within their business
//   Platform admins → any order
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getOrder } from '@/lib/core/order';

export const GET = withMiddleware({ requireAuth: true })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const orderId = params?.orderId as string;
      if (!orderId) {
        return NextResponse.json(
          { success: false, error: 'orderId is required' },
          { status: 400 }
        );
      }

      const user = req.user!;
      const order = await getOrder(orderId);

      // Verify the requesting user belongs to this business (non-platform-admin)
      if (!user.isPlatformAdmin) {
        if (order.businessId !== user.businessId) {
          return NextResponse.json(
            { success: false, error: 'Order not found' },
            { status: 404 }
          );
        }

        // STORE_MANAGER: enforce store isolation
        if (user.role === 'STORE_MANAGER' && user.storeId && order.storeId !== user.storeId) {
          return NextResponse.json(
            { success: false, error: 'Order not found' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json({ success: true, data: order });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get order';
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }
  }
);
