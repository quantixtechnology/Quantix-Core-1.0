// ============================================================================
// QUANTIX CORE — Stores API
// GET  /api/core/stores  — List stores for a business
// POST /api/core/stores  — Create store
// ============================================================================

import { NextResponse } from 'next/server';
import { listStores, createStore } from '@/lib/core/store';
import type { CreateStoreRequest } from '@/lib/core/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: businessId' },
        { status: 400 }
      );
    }

    const stores = await listStores(businessId);

    return NextResponse.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list stores';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateStoreRequest & { businessId: string };

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: businessId' },
        { status: 400 }
      );
    }

    if (!body.name || !body.slug) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug' },
        { status: 400 }
      );
    }

    const store = await createStore(body.businessId, body);

    return NextResponse.json(
      { success: true, data: store, message: 'Store created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create store';
    const status = message.includes('not found') ? 404 :
                   message.includes('already exists') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
