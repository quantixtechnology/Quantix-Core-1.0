// ============================================================================
// QUANTIX CORE — Store Timings API
// GET  /api/core/stores/[storeId]/timings  — Get store timings (auth required)
// PUT  /api/core/stores/[storeId]/timings  — Update store timings (CLIENT_OWNER+)
//
// STORE ISOLATION:
//   STORE_MANAGER → can GET/PUT only their assigned store's timings
//   CLIENT_OWNER  → any store within their business
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { updateStoreTimings, getDefaultStoreTimings } from '@/lib/core/store';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const storeId = params?.storeId as string;

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
    }

    const user = req.user!;

    const store = await db.store.findUnique({
      where: { id: storeId },
      include: { storeTimings: { orderBy: { day: 'asc' } } },
    });

    if (!store) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    // Verify store belongs to user's business
    if (!user.isPlatformAdmin) {
      if (store.businessId !== user.businessId) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }
      if (user.role === 'STORE_MANAGER' && user.storeId && store.id !== user.storeId) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }
    }

    const timings = store.storeTimings.length > 0 ? store.storeTimings : getDefaultStoreTimings();

    return NextResponse.json({ success: true, data: timings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get store timings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const storeId = params?.storeId as string;

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });
    }

    const user = req.user!;

    // Verify store belongs to user's business
    if (!user.isPlatformAdmin) {
      const store = await db.store.findUnique({ where: { id: storeId } });
      if (!store || store.businessId !== user.businessId) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }
      if (user.role === 'STORE_MANAGER' && user.storeId && storeId !== user.storeId) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }
    }

    const body = (await req.json()) as Array<{
      day: number;
      openTime: string;
      closeTime: string;
      isClosed?: boolean;
    }>;

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Request body must be a non-empty array of timings' },
        { status: 400 }
      );
    }

    for (const timing of body) {
      if (typeof timing.day !== 'number' || timing.day < 0 || timing.day > 6) {
        return NextResponse.json(
          { success: false, error: `Invalid day value: ${timing.day}. Must be 0-6 (Sunday-Saturday)` },
          { status: 400 }
        );
      }
      if (!timing.openTime || !timing.closeTime) {
        return NextResponse.json(
          { success: false, error: `Missing openTime or closeTime for day ${timing.day}` },
          { status: 400 }
        );
      }
    }

    const results = await updateStoreTimings(storeId, body);

    return NextResponse.json({ success: true, data: results, message: 'Store timings updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update store timings';
    const status = message.includes('not found') ? 404 : message.includes('Invalid day') ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});
