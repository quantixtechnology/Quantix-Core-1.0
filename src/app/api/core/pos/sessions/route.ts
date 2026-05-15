// ============================================================================
// QUANTIX CORE — POS Sessions API
// GET  /api/core/pos/sessions  — List POS sessions for a store (auth required)
// POST /api/core/pos/sessions  — Open new POS session (CLIENT_OWNER / STORE_MANAGER)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { openPOSSession } from '@/lib/core/pos';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId
    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
      businessId = qb;
    } else {
      if (!user.businessId) return NextResponse.json({ success: false, error: 'No business context found for this user' }, { status: 400 });
      businessId = user.businessId;
    }

    // STORE_MANAGER: enforce their assigned store
    const requestedStoreId = searchParams.get('storeId') || undefined;
    const storeId = user.role === 'STORE_MANAGER' && user.storeId ? user.storeId : requestedStoreId;

    if (!storeId) return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });

    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId, storeId, ...(status && { status }) };

    const [sessions, total] = await Promise.all([
      db.pOSSession.findMany({ where, skip, take: limit, orderBy: { openedAt: 'desc' } }),
      db.pOSSession.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: sessions,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list POS sessions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json();

    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    // STORE_MANAGER: enforce their assigned store
    const storeId = user.role === 'STORE_MANAGER' && user.storeId ? user.storeId : body.storeId;
    if (!storeId) return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 });

    if (!body.operatorId) return NextResponse.json({ success: false, error: 'operatorId is required' }, { status: 400 });
    if (body.openingBalance === undefined || body.openingBalance === null) {
      return NextResponse.json({ success: false, error: 'openingBalance is required' }, { status: 400 });
    }

    const result = await openPOSSession({ businessId, storeId, operatorId: body.operatorId, openingBalance: body.openingBalance });

    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json(
      { success: true, data: result.session, message: 'POS session opened successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open POS session';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
