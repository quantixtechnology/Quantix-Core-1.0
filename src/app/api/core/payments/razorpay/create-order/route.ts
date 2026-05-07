// ============================================================================
// QUANTIX CORE — Razorpay Create Order API
// POST /api/core/payments/razorpay/create-order — Create Razorpay order
//
// Auth required
// Creates Razorpay order using REST API (no SDK needed)
// If keys not set, returns mock response for development
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_BASE_URL = 'https://api.razorpay.com/v1';

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const body = await req.json();
      const user = req.user!;

      if (!body.orderId) {
        return NextResponse.json(
          { success: false, error: 'orderId is required' },
          { status: 400 }
        );
      }
      if (!body.amount || body.amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Valid amount is required' },
          { status: 400 }
        );
      }

      const currency = body.currency || 'INR';
      const amountInPaise = Math.round(body.amount * 100); // Razorpay expects paise

      // Verify the order exists and belongs to user's business
      const order = await db.order.findFirst({
        where: {
          id: body.orderId,
          businessId: user.businessId || undefined,
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }

      // Check if Razorpay keys are configured
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        // Development mode — return mock response
        const mockOrderId = `order_mock_${Date.now()}`;
        console.warn(
          '[Razorpay] Keys not configured. Returning mock order:',
          mockOrderId
        );

        return NextResponse.json({
          success: true,
          data: {
            razorpayOrderId: mockOrderId,
            amount: body.amount,
            currency,
            key: 'rzp_test_mock_key',
            isMock: true,
          },
        });
      }

      // Create Razorpay order via REST API
      const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

      const razorpayResponse = await fetch(`${RAZORPAY_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency,
          receipt: order.orderNumber,
          notes: {
            orderId: body.orderId,
            orderNumber: order.orderNumber,
            businessId: user.businessId || '',
            userId: user.id,
          },
        }),
      });

      if (!razorpayResponse.ok) {
        const errorData = await razorpayResponse.json() as Record<string, unknown>;
        console.error('[Razorpay] Create order failed:', errorData);
        return NextResponse.json(
          {
            success: false,
            error: `Razorpay error: ${(errorData as Record<string, unknown>).error || 'Failed to create order'}`,
          },
          { status: 502 }
        );
      }

      const razorpayOrder = await razorpayResponse.json() as Record<string, unknown>;

      // Create a pending payment record in database
      await db.payment.create({
        data: {
          orderId: body.orderId,
          businessId: user.businessId || '',
          amount: body.amount,
          currency,
          method: 'UPI', // Will be updated on verification
          status: 'PENDING',
          gatewayName: 'razorpay',
          gatewayTransactionId: razorpayOrder.id as string,
          gatewayResponse: JSON.stringify(razorpayOrder),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          razorpayOrderId: razorpayOrder.id,
          amount: body.amount,
          currency,
          key: RAZORPAY_KEY_ID,
          isMock: false,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create Razorpay order';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
