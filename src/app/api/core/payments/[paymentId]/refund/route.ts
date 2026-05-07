// ============================================================================
// QUANTIX CORE — Payment Refund API
// POST /api/core/payments/[paymentId]/refund — Process refund
// ============================================================================

import { NextResponse } from 'next/server';
import { processRefund } from '@/lib/core/payment';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json();

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be greater than 0' },
        { status: 400 }
      );
    }

    const result = await processRefund(paymentId, body.amount);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.payment,
      message: `Refund of ₹${body.amount} processed successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process refund';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
