// ============================================================================
// QUANTIX CORE — POS Session Detail API
// GET  /api/core/pos/sessions/[sessionId] — Get POS session details (auth required)
// PUT  /api/core/pos/sessions/[sessionId] — Close POS session (CLIENT_OWNER / STORE_MANAGER)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { getPOSSession, closePOSSession } from '@/lib/core/pos';

export const GET = withMiddleware({ requireAuth: true })(async (_req, context) => {
  try {
    const params = await context?.params;
    const sessionId = params?.sessionId as string;
    if (!sessionId) return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });

    const result = await getPOSSession(sessionId);
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 404 });

    return NextResponse.json({ success: true, data: result.session });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get POS session';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const sessionId = params?.sessionId as string;
    if (!sessionId) return NextResponse.json({ success: false, error: 'sessionId is required' }, { status: 400 });

    const body = await req.json();
    if (body.closingBalance === undefined || body.closingBalance === null) {
      return NextResponse.json({ success: false, error: 'closingBalance is required' }, { status: 400 });
    }

    const result = await closePOSSession({ sessionId, closingBalance: body.closingBalance });
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json({ success: true, data: result.settlement, message: 'POS session closed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to close POS session';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
