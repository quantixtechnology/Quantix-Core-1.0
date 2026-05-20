// ============================================================================
// POST /api/payment/webhook/[storeId]/[gateway]
// Store-specific webhook router.
// Routes to the correct gateway handler after validating store ownership.
// Example paths:
//   /api/payment/webhook/cm_store1/razorpay
//   /api/payment/webhook/cm_store2/phonepe
// ============================================================================

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/encrypt'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export async function POST(req: Request, ctx?: Ctx) {
  const params  = await ctx?.params
  const storeId = params?.storeId  as string | undefined
  const gateway = params?.gateway  as string | undefined

  if (!storeId || !gateway) {
    return NextResponse.json({ error: 'Missing storeId or gateway' }, { status: 400 })
  }

  try {
    const plugin = await db.platformPaymentPlugin.findUnique({ where: { gateway } })
    if (!plugin || !plugin.isGloballyEnabled) {
      return NextResponse.json({ error: 'Unknown gateway' }, { status: 404 })
    }

    const storeConfig = await db.storePaymentGateway.findUnique({
      where: { storeId_pluginId: { storeId, pluginId: plugin.id } },
      include: { store: { select: { businessId: true } } },
    })
    if (!storeConfig || !storeConfig.isActive) {
      return NextResponse.json({ error: 'Gateway not active for this store' }, { status: 403 })
    }

    const rawBody = await req.text()

    // ── Razorpay ─────────────────────────────────────────────────────────────
    if (gateway === 'razorpay') {
      const webhookSecret = storeConfig.webhookSecretEnc ? decrypt(storeConfig.webhookSecretEnc) : ''
      if (webhookSecret) {
        const signature = (req as Request & { headers: Headers }).headers.get('x-razorpay-signature') ?? ''
        const expected  = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
        if (signature !== expected) {
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }
      }

      const event = JSON.parse(rawBody) as { event: string; payload?: Record<string, unknown> }
      await handleRazorpayEvent(event, storeConfig.store.businessId, storeId)
      return NextResponse.json({ received: true })
    }

    // ── PhonePe ──────────────────────────────────────────────────────────────
    if (gateway === 'phonepe') {
      // PhonePe sends base64 response + X-VERIFY header (SHA256(base64Response + "/pg/v1/pay" + saltKey) + "###" + saltIndex)
      // Log and acknowledge — full implementation requires PhonePe SDK
      await logWebhookEvent(gateway, storeId, storeConfig.store.businessId, rawBody)
      return NextResponse.json({ code: 'PAYMENT_SUCCESS' })
    }

    // ── Cashfree ─────────────────────────────────────────────────────────────
    if (gateway === 'cashfree') {
      await logWebhookEvent(gateway, storeId, storeConfig.store.businessId, rawBody)
      return NextResponse.json({ received: true })
    }

    // ── Generic fallback — log and acknowledge ────────────────────────────────
    await logWebhookEvent(gateway, storeId, storeConfig.store.businessId, rawBody)
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error(`[webhook/${storeId}/${gateway}]`, error)
    // Always return 200 to prevent gateway retry loops
    return NextResponse.json({ received: true })
  }
}

async function logWebhookEvent(
  gateway:    string,
  storeId:    string,
  businessId: string,
  rawBody:    string,
) {
  try {
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(rawBody) } catch { /* not JSON */ }

    await db.activityLog.create({
      data: {
        action:     `WEBHOOK_${gateway.toUpperCase()}`,
        entity:     'Store',
        entityId:   storeId,
        businessId,
        details:    JSON.stringify({ gateway, storeId, event: parsed }),
      },
    })
  } catch { /* fire-and-forget */ }
}

async function handleRazorpayEvent(
  event:      { event: string; payload?: Record<string, unknown> },
  businessId: string,
  storeId:    string,
) {
  const eventName = event.event
  const payload   = event.payload as Record<string, { entity: Record<string, unknown> }> | undefined

  if (eventName === 'payment.captured' || eventName === 'order.paid') {
    const paymentEntity = payload?.payment?.entity
    if (paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id as string
      if (razorpayOrderId) {
        const payment = await db.payment.findFirst({
          where: { gatewayTransactionId: razorpayOrderId, businessId },
        })
        if (payment && payment.status === 'PENDING') {
          await db.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data:  { status: 'COMPLETED', paidAt: new Date(), gatewayResponse: JSON.stringify(paymentEntity) },
            })
            await tx.order.update({
              where: { id: payment.orderId },
              data:  { paymentStatus: 'COMPLETED', status: 'CONFIRMED' },
            })
          })
        }
      }
    }
  }

  if (eventName === 'payment.failed') {
    const paymentEntity = payload?.payment?.entity
    if (paymentEntity) {
      const razorpayOrderId = paymentEntity.order_id as string
      if (razorpayOrderId) {
        const payment = await db.payment.findFirst({
          where: { gatewayTransactionId: razorpayOrderId, businessId },
        })
        if (payment) {
          await db.payment.update({
            where: { id: payment.id },
            data:  { status: 'FAILED', gatewayResponse: JSON.stringify(paymentEntity) },
          })
        }
      }
    }
  }

  await logWebhookEvent('razorpay', storeId, businessId, JSON.stringify(event))
}
