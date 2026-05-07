// ============================================================================
// QUANTIX CORE — Razorpay Verify Payment API
// POST /api/core/payments/razorpay/verify — Verify Razorpay payment
//
// Auth required
// Accepts: razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId
// Verifies signature using HMAC SHA256 (auto-verify in mock mode)
// Updates payment status to COMPLETED
// Updates order payment status to COMPLETED
// Creates invoice for the order
// Returns success with payment details
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { createHmac } from 'crypto';
import { emitPaymentEvent } from '@/lib/realtime-emitter';
import { logPaymentActivity } from '@/lib/core/audit';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export const POST = withMiddleware({ requireAuth: true })(
  async (req) => {
    try {
      const body = await req.json();
      const user = req.user!;

      const {
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        razorpay_signature: razorpaySignature,
        orderId,
      } = body;

      if (!razorpayPaymentId || !razorpayOrderId || !orderId) {
        return NextResponse.json(
          {
            success: false,
            error: 'razorpay_payment_id, razorpay_order_id, and orderId are required',
          },
          { status: 400 }
        );
      }

      // Verify signature
      let signatureValid = false;

      if (!RAZORPAY_KEY_SECRET) {
        // Development / mock mode — auto-verify
        console.warn(
          '[Razorpay Verify] Key secret not set. Auto-verifying in development mode.'
        );
        signatureValid = true;
      } else {
        // Production — verify using HMAC SHA256
        if (!razorpaySignature) {
          return NextResponse.json(
            { success: false, error: 'razorpay_signature is required for verification' },
            { status: 400 }
          );
        }
        const message = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(message)
          .digest('hex');
        signatureValid = expectedSignature === razorpaySignature;
      }

      if (!signatureValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid payment signature. Payment verification failed.' },
          { status: 400 }
        );
      }

      // Find the payment record by gateway transaction ID
      const payment = await db.payment.findFirst({
        where: {
          orderId,
          gatewayTransactionId: razorpayOrderId,
        },
        include: {
          order: {
            include: {
              customer: { select: { id: true, name: true, email: true } },
              items: true,
            },
          },
        },
      });

      if (!payment) {
        return NextResponse.json(
          { success: false, error: 'Payment record not found' },
          { status: 404 }
        );
      }

      if (payment.status === 'COMPLETED') {
        return NextResponse.json(
          {
            success: true,
            data: {
              paymentId: payment.id,
              orderId,
              status: 'COMPLETED',
              amount: payment.amount,
              currency: payment.currency,
              message: 'Payment already verified',
            },
          }
        );
      }

      // Update payment status, order, and create invoice in a transaction
      const result = await db.$transaction(async (tx) => {
        // Update payment
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            gatewayTransactionId: razorpayPaymentId,
            gatewayResponse: JSON.stringify({
              razorpayOrderId,
              razorpayPaymentId,
              razorpaySignature,
              verifiedAt: new Date().toISOString(),
            }),
            paidAt: new Date(),
          },
        });

        // Update order payment status
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'COMPLETED',
          },
        });

        // Create invoice for the order if one doesn't already exist
        const existingInvoice = await tx.invoice.findFirst({
          where: { orderId },
        });

        let invoice = existingInvoice;
        if (!existingInvoice && payment.order) {
          const order = payment.order;
          const invoiceCount = await tx.invoice.count({
            where: { businessId: payment.businessId },
          });
          const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

          invoice = await tx.invoice.create({
            data: {
              businessId: payment.businessId,
              orderId,
              customerId: order.customerId,
              invoiceNumber,
              invoiceType: 'TAX_INVOICE',
              subtotal: order.subtotal,
              totalTax: order.totalTax,
              totalDiscount: order.totalDiscount,
              totalAmount: order.totalAmount,
              cgstAmount: order.cgstAmount,
              sgstAmount: order.sgstAmount,
              igstAmount: order.igstAmount,
              status: 'paid',
              paidAt: new Date(),
              metadata: JSON.stringify({
                paymentId: updatedPayment.id,
                gatewayTransactionId: razorpayPaymentId,
                method: payment.method,
                generatedBy: 'razorpay_verify',
              }),
            },
          });
        }

        // Log activity
        await tx.activityLog.create({
          data: {
            businessId: payment.businessId,
            userId: user.id,
            action: 'payment.verified',
            entity: 'Payment',
            entityId: payment.id,
            details: JSON.stringify({
              razorpayOrderId,
              razorpayPaymentId,
              amount: payment.amount,
              currency: payment.currency,
              invoiceId: invoice?.id,
            }),
          },
        });

        return { payment: updatedPayment, invoice };
      });

      // Broadcast payment:completed via WebSocket (fire-and-forget)
      try {
        await emitPaymentEvent(payment.businessId, orderId, {
          event: 'payment:completed',
          paymentId: result.payment.id,
          orderId,
          orderNumber: payment.order?.orderNumber,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: 'COMPLETED',
        });
      } catch (wsErr) {
        console.error('[Razorpay Verify] WebSocket broadcast error:', wsErr);
      }

      // Log payment activity via audit logger (fire-and-forget)
      try {
        await logPaymentActivity(
          payment.businessId,
          user.id,
          'payment.verified',
          result.payment.id,
          {
            razorpayOrderId,
            razorpayPaymentId,
            amount: payment.amount,
            currency: payment.currency,
            invoiceId: result.invoice?.id || null,
          },
          req as unknown as { headers?: { get(name: string): string | null } }
        );
      } catch { /* audit logging is non-blocking */ }

      return NextResponse.json({
        success: true,
        data: {
          paymentId: result.payment.id,
          orderId,
          status: 'COMPLETED',
          amount: payment.amount,
          currency: payment.currency,
          invoiceId: result.invoice?.id || null,
          invoiceNumber: result.invoice?.invoiceNumber || null,
        },
        message: 'Payment verified successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify payment';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
