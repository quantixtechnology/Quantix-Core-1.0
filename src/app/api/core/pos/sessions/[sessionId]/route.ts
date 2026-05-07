// ============================================================================
// QUANTIX CORE — POS Session Detail API
// GET  /api/core/pos/sessions/[sessionId] — Get POS session details
// PUT  /api/core/pos/sessions/[sessionId] — Close POS session
// ============================================================================

import { NextResponse } from 'next/server';
import { getPOSSession, closePOSSession } from '@/lib/core/pos';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const result = await getPOSSession(sessionId);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get POS session';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    if (body.closingBalance === undefined || body.closingBalance === null) {
      return NextResponse.json(
        { success: false, error: 'closingBalance is required' },
        { status: 400 }
      );
    }

    const result = await closePOSSession({
      sessionId,
      closingBalance: body.closingBalance,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.settlement,
      message: 'POS session closed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to close POS session';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
