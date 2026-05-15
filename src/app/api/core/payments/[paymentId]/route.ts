// ============================================================================
// QUANTIX CORE — Payment Detail API
// GET  /api/core/payments/[paymentId] — Get payment details (auth required)
// PUT  /api/core/payments/[paymentId] — Update payment status (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { updatePaymentStatus } from '@/lib/core/payment';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const paymentId = params?.paymentId as string;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });
    }

    const user = req.user!;
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            totalAmount: true,
            businessId: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    // Verify payment belongs to user's business
    if (!user.isPlatformAdmin && payment.order?.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const paymentId = params?.paymentId as string;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'paymentId is required' }, { status: 400 });
    }

    const body = await req.json();

    if (!body.status) {
      return NextResponse.json({ success: false, error: 'status is required' }, { status: 400 });
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await updatePaymentStatus(paymentId, body.status, body.gatewayTransactionId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: result.payment,
      message: `Payment status updated to ${body.status}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update payment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
