// ============================================================================
// QUANTIX CORE — Delivery OTP Verification API
// POST /api/core/delivery/verify-otp — Verify delivery OTP
//
// Auth required (DELIVERY_STAFF)
// Verifies the delivery OTP from customer
// Updates delivery status on success
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { verifyOtp } from '@/lib/core/delivery';

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['DELIVERY_STAFF'] })(
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
      if (!body.otp) {
        return NextResponse.json(
          { success: false, error: 'otp is required' },
          { status: 400 }
        );
      }

      // Find the delivery partner profile
      const deliveryPartner = await db.deliveryPartner.findFirst({
        where: {
          userId: user.id,
          isActive: true,
        },
      });

      if (!deliveryPartner) {
        return NextResponse.json(
          { success: false, error: 'Delivery partner profile not found' },
          { status: 404 }
        );
      }

      // Find the order and its delivery
      const order = await db.order.findUnique({
        where: { id: body.orderId },
        include: { delivery: true },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }

      if (!order.delivery) {
        return NextResponse.json(
          { success: false, error: 'No delivery record found for this order' },
          { status: 400 }
        );
      }

      // Check if this delivery partner is assigned to this order
      if (order.delivery.deliveryPartnerId !== deliveryPartner.id) {
        return NextResponse.json(
          { success: false, error: 'You are not assigned to this delivery' },
          { status: 403 }
        );
      }

      // Determine which OTP to verify based on order type and current status
      const delivery = order.delivery;
      let expectedOtp: string | null = null;
      let newDeliveryStatus: string | null = null;
      let newOrderStatus: string | null = null;

      if (order.orderType === 'PICKUP_AND_DELIVERY') {
        // For pickup & delivery, pickupOtp for PICKED_UP, deliveryOtp for DELIVERED
        if (delivery.status === 'ASSIGNED') {
          // Verifying pickup OTP
          expectedOtp = delivery.pickupOtp;
          newDeliveryStatus = 'PICKED_UP';
          newOrderStatus = 'PICKED_UP';
        } else if (
          delivery.status === 'ON_THE_WAY' ||
          delivery.status === 'ARRIVED'
        ) {
          // Verifying delivery OTP
          expectedOtp = delivery.deliveryOtp;
          newDeliveryStatus = 'DELIVERED';
          newOrderStatus = 'DELIVERED';
        }
      } else {
        // Regular delivery — verify deliveryOtp
        expectedOtp = delivery.deliveryOtp;
        newDeliveryStatus = 'DELIVERED';
        newOrderStatus = 'DELIVERED';
      }

      if (!expectedOtp) {
        return NextResponse.json(
          { success: false, error: 'No OTP set for this delivery' },
          { status: 400 }
        );
      }

      // Verify OTP
      if (!verifyOtp(expectedOtp, String(body.otp))) {
        return NextResponse.json(
          { success: false, error: 'Invalid OTP. Please try again.' },
          { status: 400 }
        );
      }

      // Update delivery and order status
      await db.$transaction(async (tx) => {
        // Update delivery
        await tx.delivery.update({
          where: { id: delivery.id },
          data: {
            status: newDeliveryStatus as 'PICKED_UP' | 'DELIVERED',
            actualDeliveryTime:
              newDeliveryStatus === 'DELIVERED' ? new Date() : undefined,
          },
        });

        // Update order status
        if (newOrderStatus) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: newOrderStatus as 'PICKED_UP' | 'DELIVERED',
              deliveredAt:
                newOrderStatus === 'DELIVERED' ? new Date() : undefined,
            },
          });

          // Create status history
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: newOrderStatus as 'PICKED_UP' | 'DELIVERED',
              note: `OTP verified by delivery partner ${deliveryPartner.name}`,
              changedBy: user.id,
            },
          });
        }

        // If delivered, update delivery partner stats
        if (newDeliveryStatus === 'DELIVERED') {
          const deliveryEarning = order.deliveryFee * 0.7; // 70% of delivery fee
          await tx.deliveryPartner.update({
            where: { id: deliveryPartner.id },
            data: {
              totalDeliveries: { increment: 1 },
              totalEarnings: { increment: deliveryEarning },
            },
          });
        }
      });

      // Broadcast delivery:updated via WebSocket
      try {
        await fetch('/api/emit?XTransformPort=3003', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: order.businessId,
            event: 'delivery:updated',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              deliveryStatus: newDeliveryStatus,
              orderStatus: newOrderStatus,
              partnerName: deliveryPartner.name,
            },
          }),
        });
      } catch (wsErr) {
        console.error('[Delivery OTP] WebSocket broadcast error:', wsErr);
      }

      return NextResponse.json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          deliveryStatus: newDeliveryStatus,
          orderStatus: newOrderStatus,
          message: `OTP verified successfully. Status updated to ${newDeliveryStatus}.`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify OTP';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
