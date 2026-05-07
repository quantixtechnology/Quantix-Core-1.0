// ============================================================================
// QUANTIX CORE — Store Detail API
// GET  /api/core/stores/[storeId]  — Get store with timings
// PUT  /api/core/stores/[storeId]  — Update store details
// ============================================================================

import { NextResponse } from 'next/server';
import { getStore, updateStore } from '@/lib/core/store';
import type { CreateStoreRequest } from '@/lib/core/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    const store = await getStore(storeId);

    return NextResponse.json({
      success: true,
      data: store,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get store';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> }
) {
  try {
    const { storeId } = await params;
    const body = (await request.json()) as Partial<CreateStoreRequest>;

    const store = await updateStore(storeId, body);

    return NextResponse.json({
      success: true,
      data: store,
      message: 'Store updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update store';
    const status = message.includes('not found') ? 404 :
                   message.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
