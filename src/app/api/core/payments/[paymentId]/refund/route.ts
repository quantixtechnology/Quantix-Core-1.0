// ============================================================================
// QUANTIX CORE — Payment Refund API
// POST /api/core/payments/[paymentId]/refund — Process refund (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { processRefund } from '@/lib/core/payment';

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const paymentId = params?.paymentId as string;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });
    }

    const body = await req.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be greater than 0' }, { status: 400 });
    }

    const result = await processRefund(paymentId, body.amount);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.payment,
      message: `Refund of ₹${body.amount} processed successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process refund';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
