// ============================================================================
// QUANTIX CORE — Razorpay Webhook Handler
// POST /api/core/payments/razorpay/webhook — Razorpay webhook handler
//
// No auth (webhook from Razorpay)
// Verifies webhook signature if RAZORPAY_WEBHOOK_SECRET set
// Handles: payment.captured, payment.failed, payment.refunded,
//          order.paid, refund.processed, refund.failed
// Updates payment records in database
// Logs all webhook events
// Returns 200 OK quickly to prevent Razorpay retries
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHmac } from 'crypto';
import { processRefund } from '@/lib/core/payment';

const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // Verify webhook signature if secret is set
    if (RAZORPAY_WEBHOOK_SECRET) {
      if (!signature) {
        console.error('[Razorpay Webhook] Missing signature header');
        return NextResponse.json(
          { success: false, error: 'Missing signature' },
          { status: 401 }
        );
      }

      const expectedSignature = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('[Razorpay Webhook] Invalid signature');
        return NextResponse.json(
          { success: false, error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } else {
      console.warn('[Razorpay Webhook] No webhook secret set. Skipping signature verification.');
    }

    const event = JSON.parse(body) as Record<string, unknown>;
    const eventType = event.event as string;
    const eventPayloadRoot = event.payload as { payment?: { entity?: unknown }; refund?: { entity?: unknown }; order?: { entity?: unknown } } | undefined;
    const eventPayload = eventPayloadRoot?.payment?.entity
      || eventPayloadRoot?.refund?.entity
      || eventPayloadRoot?.order?.entity
      || {};
    const payload = eventPayload as Record<string, unknown>;

    console.log(`[Razorpay Webhook] Event: ${eventType}`);

    // Log the webhook event (fire-and-forget to respond quickly)
    logWebhookEvent(eventType, payload).catch((err) => {
      console.error('[Razorpay Webhook] Failed to log event:', err);
    });

    // Process events — fire-and-forget for heavy processing to respond 200 quickly
    processWebhookEvent(eventType, payload).catch((err) => {
      console.error(`[Razorpay Webhook] Error processing ${eventType}:`, err);
    });

    // Always return 200 to acknowledge webhook receipt quickly
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      '[Razorpay Webhook] Error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    // Still return 200 to prevent Razorpay from retrying
    return NextResponse.json({ success: false, error: 'Webhook processing error' });
  }
}

// ============================================================================
// WEBHOOK EVENT PROCESSING
// ============================================================================

async function processWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  switch (eventType) {
    case 'payment.captured': {
      await handlePaymentCaptured(payload);
      break;
    }

    case 'payment.failed': {
      await handlePaymentFailed(payload);
      break;
    }

    case 'payment.refunded': {
      await handlePaymentRefunded(payload);
      break;
    }

    case 'order.paid': {
      await handleOrderPaid(payload);
      break;
    }

    case 'refund.processed': {
      await handleRefundProcessed(payload);
      break;
    }

    case 'refund.failed': {
      await handleRefundFailed(payload);
      break;
    }

    default:
      console.log(`[Razorpay Webhook] Unhandled event type: ${eventType}`);
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handlePaymentCaptured(payload: Record<string, unknown>) {
  const razorpayOrderId = payload.order_id as string;
  const razorpayPaymentId = payload.id as string;
  const amount = (payload.amount as number) / 100; // Convert from paise
  const method = mapRazorpayMethod(payload.method as string);

  if (!razorpayOrderId) return;

  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayOrderId },
  });

  if (!payment || payment.status === 'COMPLETED') return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        gatewayTransactionId: razorpayPaymentId,
        method,
        paidAt: new Date(),
        gatewayResponse: JSON.stringify(payload),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'COMPLETED' },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: payment.businessId,
        action: 'webhook.payment.captured',
        entity: 'Payment',
        entityId: payment.id,
        details: JSON.stringify({
          razorpayPaymentId,
          amount,
          method,
        }),
      },
    });
  });

  console.log(
    `[Razorpay Webhook] Payment captured: ${razorpayPaymentId} for order ${payment.orderId}`
  );
}

async function handlePaymentFailed(payload: Record<string, unknown>) {
  const razorpayOrderId = payload.order_id as string;
  const razorpayPaymentId = payload.id as string;
  const errorCode = payload.error_code as string | undefined;
  const errorDescription = payload.error_description as string | undefined;

  if (!razorpayOrderId) return;

  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayOrderId },
  });

  if (!payment || payment.status !== 'PENDING') return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        gatewayTransactionId: razorpayPaymentId,
        gatewayResponse: JSON.stringify({
          ...payload,
          errorCode,
          errorDescription,
        }),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'FAILED' },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: payment.businessId,
        action: 'webhook.payment.failed',
        entity: 'Payment',
        entityId: payment.id,
        details: JSON.stringify({
          razorpayPaymentId,
          errorCode,
          errorDescription,
        }),
      },
    });
  });

  console.log(
    `[Razorpay Webhook] Payment failed: ${razorpayPaymentId} for order ${payment.orderId}`
  );
}

async function handlePaymentRefunded(payload: Record<string, unknown>) {
  const razorpayPaymentId = payload.id as string;
  const refundAmount = ((payload.amount_refunded as number) || 0) / 100;

  if (!razorpayPaymentId) return;

  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayPaymentId },
  });

  if (!payment) return;

  // Use the existing processRefund from core payment
  const result = await processRefund(payment.id, refundAmount);

  if (result.success) {
    // Log activity
    await db.activityLog.create({
      data: {
        businessId: payment.businessId,
        action: 'webhook.payment.refunded',
        entity: 'Payment',
        entityId: payment.id,
        details: JSON.stringify({
          razorpayPaymentId,
          refundAmount,
          newStatus: result.payment?.status,
        }),
      },
    });

    console.log(
      `[Razorpay Webhook] Payment refunded: ${refundAmount} for payment ${payment.id}`
    );
  }
}

async function handleOrderPaid(payload: Record<string, unknown>) {
  const razorpayOrderId = payload.id as string;
  const razorpayPaymentId = (payload as Record<string, unknown>).payment_id as string | undefined;

  if (!razorpayOrderId) return;

  // Find payment by Razorpay order ID
  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayOrderId },
  });

  if (!payment || payment.status === 'COMPLETED') return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        gatewayTransactionId: razorpayPaymentId || razorpayOrderId,
        paidAt: new Date(),
        gatewayResponse: JSON.stringify(payload),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: 'COMPLETED' },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: payment.businessId,
        action: 'webhook.order.paid',
        entity: 'Payment',
        entityId: payment.id,
        details: JSON.stringify({
          razorpayOrderId,
          razorpayPaymentId,
        }),
      },
    });
  });

  console.log(
    `[Razorpay Webhook] Order paid: ${razorpayOrderId} for internal order ${payment.orderId}`
  );
}

async function handleRefundProcessed(payload: Record<string, unknown>) {
  const razorpayPaymentId = payload.payment_id as string;
  const refundAmount = ((payload.amount as number) || 0) / 100;

  if (!razorpayPaymentId) return;

  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayPaymentId },
  });

  if (!payment) return;

  // Use the existing processRefund from core payment
  const result = await processRefund(payment.id, refundAmount);

  if (result.success) {
    // Log activity
    await db.activityLog.create({
      data: {
        businessId: payment.businessId,
        action: 'webhook.refund.processed',
        entity: 'Payment',
        entityId: payment.id,
        details: JSON.stringify({
          razorpayPaymentId,
          refundAmount,
          refundId: payload.id,
          newStatus: result.payment?.status,
        }),
      },
    });

    console.log(
      `[Razorpay Webhook] Refund processed: ${refundAmount} for payment ${payment.id}`
    );
  }
}

async function handleRefundFailed(payload: Record<string, unknown>) {
  const razorpayPaymentId = payload.payment_id as string;
  const refundId = payload.id as string;

  if (!razorpayPaymentId) return;

  const payment = await db.payment.findFirst({
    where: { gatewayTransactionId: razorpayPaymentId },
  });

  if (!payment) return;

  // Update refund status to failed
  await db.payment.update({
    where: { id: payment.id },
    data: {
      refundStatus: 'failed',
      gatewayResponse: JSON.stringify({
        ...(typeof payment.gatewayResponse === 'string'
          ? JSON.parse(payment.gatewayResponse)
          : {}),
        refundFailed: true,
        refundId,
        failedAt: new Date().toISOString(),
      }),
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      businessId: payment.businessId,
      action: 'webhook.refund.failed',
      entity: 'Payment',
      entityId: payment.id,
      details: JSON.stringify({
        razorpayPaymentId,
        refundId,
      }),
    },
  });

  console.log(
    `[Razorpay Webhook] Refund failed: refund ${refundId} for payment ${payment.id}`
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function logWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.activityLog.create({
    data: {
      action: `webhook.razorpay.${eventType}`,
      entity: 'Webhook',
      entityId: (payload.id as string) || 'unknown',
      details: JSON.stringify({
        event: eventType,
        payload: {
          id: payload.id,
          order_id: payload.order_id,
          amount: payload.amount,
          status: payload.status,
        },
      }),
    },
  });
}

/**
 * Map Razorpay payment method string to our PaymentMethodType enum
 */
function mapRazorpayMethod(method: string | undefined): 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'COD' | 'CREDIT' | 'MIXED' {
  if (!method) return 'UPI'; // Default

  const methodMap: Record<string, 'CASH' | 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'COD' | 'CREDIT' | 'MIXED'> = {
    upi: 'UPI',
    card: 'CARD',
    credit_card: 'CARD',
    debit_card: 'CARD',
    netbanking: 'NETBANKING',
    wallet: 'WALLET',
    paylater: 'CREDIT',
    emi: 'CARD',
    cash: 'CASH',
    cod: 'COD',
  };

  const normalizedMethod = method.toLowerCase().replace(/[-_\s]/g, '');
  for (const [key, value] of Object.entries(methodMap)) {
    if (normalizedMethod.includes(key)) {
      return value;
    }
  }

  return 'MIXED';
}
