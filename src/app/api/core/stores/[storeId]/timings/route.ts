// ============================================================================
// QUANTIX CORE — Store Timings API
// GET  /api/core/stores/[storeId]/timings  — Get store timings
// PUT  /api/core/stores/[storeId]/timings  — Update store timings
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getStore, updateStoreTimings, getDefaultStoreTimings } from '@/lib/core/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;

    // Verify store exists
    const store = await db.store.findUnique({
      where: { id: storeId },
      include: {
        storeTimings: { orderBy: { day: 'asc' } },
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    // If no timings exist, return defaults
    const timings = store.storeTimings.length > 0
      ? store.storeTimings
      : getDefaultStoreTimings();

    return NextResponse.json({
      success: true,
      data: timings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get store timings';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    const body = (await request.json()) as Array<{
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

    // Validate each timing entry
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

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Store timings updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update store timings';
    const status = message.includes('not found') ? 404 :
                   message.includes('Invalid day') ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
