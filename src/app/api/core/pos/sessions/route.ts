// ============================================================================
// QUANTIX CORE — POS Sessions API
// GET  /api/core/pos/sessions  — List POS sessions for a store
// POST /api/core/pos/sessions  — Open new POS session
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { openPOSSession } from '@/lib/core/pos';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const storeId = searchParams.get('storeId');
    const status = searchParams.get('status');

    if (!businessId || !storeId) {
      return NextResponse.json(
        { success: false, error: 'businessId and storeId are required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      businessId,
      storeId,
      ...(status && { status }),
    };

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      db.pOSSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
      }),
      db.pOSSession.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list POS sessions';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (!body.storeId) {
      return NextResponse.json(
        { success: false, error: 'storeId is required' },
        { status: 400 }
      );
    }
    if (!body.operatorId) {
      return NextResponse.json(
        { success: false, error: 'operatorId is required' },
        { status: 400 }
      );
    }
    if (body.openingBalance === undefined || body.openingBalance === null) {
      return NextResponse.json(
        { success: false, error: 'openingBalance is required' },
        { status: 400 }
      );
    }

    const result = await openPOSSession({
      businessId: body.businessId,
      storeId: body.storeId,
      operatorId: body.operatorId,
      openingBalance: body.openingBalance,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.session,
      message: 'POS session opened successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open POS session';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
