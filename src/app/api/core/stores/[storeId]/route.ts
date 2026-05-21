// ============================================================================
// QUANTIX CORE — Store Detail API
// GET    /api/core/stores/[storeId] — Get store with timings (auth required)
// PUT    /api/core/stores/[storeId] — Update store (CLIENT_OWNER / platform admin)
// DELETE /api/core/stores/[storeId] — Delete store (CLIENT_OWNER / platform admin)
//
// STORE ISOLATION:
//   STORE_MANAGER → can only GET their own store; cannot PUT or DELETE
//   CLIENT_OWNER  → any store within their business
//   Platform admins → any store
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getStore, updateStore } from '@/lib/core/store';
import { db } from '@/lib/db';
import type { CreateStoreRequest } from '@/lib/core/types';

export const GET = withMiddleware({ requireAuth: true })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const storeId = params?.storeId as string;
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
      }

      const user = req.user!;
      const store = await getStore(storeId);

      // Verify store belongs to user's business
      if (!user.isPlatformAdmin) {
        if (store.businessId !== user.businessId) {
          return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
        }
        // STORE_MANAGER: can only access their assigned store
        if (user.role === 'STORE_MANAGER' && user.storeId && store.id !== user.storeId) {
          return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
        }
      }

      return NextResponse.json({ success: true, data: store });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get store';
      return NextResponse.json(
        { success: false, error: message },
        { status: message.includes('not found') ? 404 : 500 }
      );
    }
  }
);

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(
  async (req, context) => {
    try {
      const params = await context?.params;
      const storeId = params?.storeId as string;
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
      }

      const user = req.user!;
      const body = (await req.json()) as Partial<CreateStoreRequest>;

      // Verify store belongs to user's business before mutating
      if (!user.isPlatformAdmin) {
        const existing = await getStore(storeId);
        if (existing.businessId !== user.businessId) {
          return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
        }
      }

      const store = await updateStore(storeId, body);

      return NextResponse.json({
        success: true,
        data: store,
        message: 'Store updated successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update store';
      const status = message.includes('not found') ? 404
        : message.includes('already exists') ? 409
        : 500;
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }
);

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const storeId = params?.storeId as string;
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
    }

    const user = req.user!;
    const store = await getStore(storeId);

    if (!user.isPlatformAdmin && store.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    // Cannot delete the main store if other stores exist
    if (store.isMainStore) {
      const storeCount = await db.store.count({ where: { businessId: store.businessId } });
      if (storeCount > 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete the main store while other stores exist. Set another store as main first.' },
          { status: 400 }
        );
      }
    }

    // Check for active orders
    const activeOrders = await db.order.count({
      where: { storeId, status: { notIn: ['DELIVERED', 'CANCELLED', 'REFUNDED'] } },
    });
    if (activeOrders > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete store — ${activeOrders} active order(s) in progress.` },
        { status: 400 }
      );
    }

    await db.store.delete({ where: { id: storeId } });

    return NextResponse.json({ success: true, message: 'Store deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete store';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
