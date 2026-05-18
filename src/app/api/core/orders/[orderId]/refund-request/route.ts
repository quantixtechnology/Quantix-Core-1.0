// ============================================================================
// POST /api/core/orders/[orderId]/refund-request
// Customer submits a refund request for a delivered/completed order.
// Marks payment refundStatus = 'REQUESTED' and creates notification for business.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { db } from '@/lib/db'

type Ctx = { params?: Promise<Record<string, string | string[]>> }

export const POST = withMiddleware({ requireAuth: true })(
  async (req, ctx?: Ctx) => {
    try {
      const orderId = ((await ctx?.params)?.orderId) as string | undefined
      if (!orderId) return createErrorResponse('Missing orderId', 400)

      const user = req.user!
      const body = await req.json()
      const { reason, amount } = body

      if (!reason) return createErrorResponse('reason is required', 400)

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { payments: { where: { status: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, take: 1 } },
      })

      if (!order) return createErrorResponse('Order not found', 404)

      if (!user.isPlatformAdmin && order.businessId !== user.businessId && order.customerEmail !== user.email) {
        return createErrorResponse('Order not found', 404)
      }

      if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
        return createErrorResponse(
          `Refund requests are only allowed for delivered/completed orders (current: ${order.status})`,
          400,
        )
      }

      const payment = order.payments[0]

      if (payment) {
        if (payment.refundStatus === 'REQUESTED' || payment.refundStatus === 'PROCESSING') {
          return createErrorResponse('A refund request is already in progress', 409)
        }
        if (payment.refundStatus === 'REFUNDED') {
          return createErrorResponse('This order has already been refunded', 409)
        }

        await db.payment.update({
          where: { id: payment.id },
          data: {
            refundStatus:  'REQUESTED',
            refundAmount:  amount ?? payment.amount,
          },
        })
      }

      await db.orderStatusHistory.create({
        data: {
          orderId,
          status: order.status,
          note: `Refund requested by customer: ${reason}`,
          changedBy: user.id,
        },
      })

      await db.notification.create({
        data: {
          businessId: order.businessId,
          type: 'PAYMENT',
          channel: 'IN_APP',
          title: 'Refund Request Received',
          message: `Order #${order.orderNumber} — refund requested: ${reason}`,
          data: JSON.stringify({ orderId, orderNumber: order.orderNumber, reason, amount: amount ?? payment?.amount }),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Refund request submitted. We will process it within 3-5 business days.',
        data: {
          orderId,
          orderNumber: order.orderNumber,
          refundStatus: 'REQUESTED',
          requestedAmount: amount ?? payment?.amount ?? order.totalAmount,
        },
      })
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : 'Failed to submit refund request', 500)
    }
  },
)
