// ============================================================================
// QUANTIX CORE — Businesses API
// GET  /api/core/businesses          — List businesses with filtering/pagination
// POST /api/core/businesses          — Create business (Quantix Super Admin only)
// ============================================================================

import { NextResponse } from 'next/server';
import { listBusinesses, createBusiness } from '@/lib/core/business';
import type { CreateBusinessRequest, BusinessType, BusinessStatus } from '@/lib/core/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Parse filters
    const businessTypeParam = searchParams.get('businessType');
    const statusParam = searchParams.get('status');
    const salesRepId = searchParams.get('salesRepId') || undefined;
    const search = searchParams.get('search') || undefined;
    const isOnlineParam = searchParams.get('isOnline');

    const businessType = businessTypeParam
      ? (businessTypeParam.split(',') as BusinessType[])
      : undefined;

    const status = statusParam
      ? (statusParam.split(',') as BusinessStatus[])
      : undefined;

    const isOnline = isOnlineParam !== null ? isOnlineParam === 'true' : undefined;

    const result = await listBusinesses({
      page,
      limit,
      businessType,
      status,
      salesRepId,
      search,
      isOnline,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list businesses';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBusinessRequest;

    // Validate required fields
    if (!body.name || !body.slug || !body.businessType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, slug, businessType' },
        { status: 400 }
      );
    }

    const business = await createBusiness(body);

    return NextResponse.json(
      { success: true, data: business, message: 'Business created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create business';
    const status = message.includes('already exists') || message.includes('not found') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
