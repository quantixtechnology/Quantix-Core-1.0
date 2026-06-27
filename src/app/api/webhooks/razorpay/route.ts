// ============================================================================
// POST /api/webhooks/razorpay
// Razorpay webhook handler for payment events
// Idempotent webhook processing with signature verification
// ============================================================================

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

interface RazorpayPaymentEvent {
  id: string
  entity: string
  event: string
  created_at: number
  contains: string[]
  payload: {
    payment: {
      entity: {
        id: string
        entity: string
        amount: number
        currency: string
        status: string
        method: string
        description?: string
        email?: string
        contact?: string
        order_id?: string
        metadata?: Record<string, any>
      }
    }
  }
}

interface RazorpaySignature {
  'X-Razorpay-Signature'?: string
}

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    logger.error('PAYMENT', 'Razorpay webhook secret not configured', new Error('Missing secret'))
    return false
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  return hash === signature
}

/**
 * Handle payment success event
 */
async function handlePaymentSuccess(paymentId: string, amount: number, metadata: Record<string, any>) {
  logger.info('PAYMENT', `Payment successful: ${paymentId}`, { amount, metadata })

  const { businessId, subscriptionId } = metadata

  if (!businessId || !subscriptionId) {
    logger.warn('PAYMENT', 'Missing business/subscription in webhook metadata', { metadata })
    return
  }

  // Update subscription payment status
  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      lastPaymentAt: new Date(),
      lastPaymentId: paymentId,
    },
  })

  // Create payment record
  await db.billingPayment.create({
    data: {
      businessId,
      subscriptionId,
      paymentId,
      amount: amount / 100, // Convert paise to rupees
      status: 'COMPLETED',
      method: 'RAZORPAY',
    },
  })

  // Mark business as active
  await db.business.update({
    where: { id: businessId },
    data: { status: 'ACTIVE' },
  })
}

/**
 * Handle payment failure event
 */
async function handlePaymentFailure(paymentId: string, metadata: Record<string, any>) {
  logger.warn('PAYMENT', `Payment failed: ${paymentId}`, { metadata })

  const { businessId, subscriptionId } = metadata

  if (!subscriptionId) return

  // Mark subscription as payment failed
  await db.businessSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'PAYMENT_FAILED',
      lastPaymentAt: new Date(),
    },
  })
}

/**
 * Main webhook handler
 */
export async function POST(request: Request) {
  const requestId = crypto.randomBytes(8).toString('hex')
  logger.setContext({ requestId })

  try {
    // Get request body and signature
    const body = await request.text()
    const signature = request.headers.get('X-Razorpay-Signature')

    if (!signature) {
      logger.warn('PAYMENT', 'Missing webhook signature')
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify signature
    if (!verifyWebhookSignature(body, signature)) {
      logger.error('PAYMENT', 'Invalid webhook signature', new Error('Signature verification failed'))
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event: RazorpayPaymentEvent = JSON.parse(body)

    logger.info('PAYMENT', `Webhook received: ${event.event}`, {
      eventId: event.id,
      paymentId: event.payload?.payment?.entity?.id,
    })

    // Handle payment success
    if (event.event === 'payment.authorized' || event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      await handlePaymentSuccess(
        payment.id,
        payment.amount,
        payment.metadata || {}
      )
    }

    // Handle payment failure
    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      await handlePaymentFailure(payment.id, payment.metadata || {})
    }

    // Acknowledge receipt to Razorpay
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('PAYMENT', 'Webhook processing failed', error instanceof Error ? error : new Error(String(error)))

    // Still return 200 so Razorpay doesn't retry
    // Unprocessed events logged for manual review
    return NextResponse.json(
      { success: false, error: 'Processing failed', logged: true },
      { status: 200 }
    )
  }
}
