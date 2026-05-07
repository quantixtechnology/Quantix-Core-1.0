// ============================================================================
// QUANTIX CORE — Order Tracking API
// GET /api/core/storefront/orders/[orderId]/track — Order tracking for customer
//
// Auth optional (customer can track their order)
// Returns order with status history, delivery info, partner info
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOrder } from '@/lib/core/order';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Get order with full details
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: {
            id: true,
            itemType: true,
            itemName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            isVeg: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            note: true,
            changedBy: true,
            createdAt: true,
          },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            estimatedDeliveryTime: true,
            actualPickupTime: true,
            actualDeliveryTime: true,
            distance: true,
            deliveryOtp: true,
            liveTracking: true,
            deliveryPartner: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
                vehicleType: true,
                vehicleNumber: true,
                rating: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            city: true,
            phone: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            status: true,
            paidAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Build tracking response
    const trackingData = {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      totalTax: order.totalTax,
      totalDiscount: order.totalDiscount,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
      // Store info
      store: order.store,
      // Customer info
      customer: order.customer
        ? {
            name: order.customer.name,
          }
        : null,
      // Delivery info
      delivery: order.delivery
        ? {
            status: order.delivery.status,
            estimatedDeliveryTime: order.delivery.estimatedDeliveryTime,
            actualPickupTime: order.delivery.actualPickupTime,
            actualDeliveryTime: order.delivery.actualDeliveryTime,
            distance: order.delivery.distance,
            liveTracking: JSON.parse(order.delivery.liveTracking || '[]'),
            partner: order.delivery.deliveryPartner
              ? {
                  name: order.delivery.deliveryPartner.name,
                  phone: order.delivery.deliveryPartner.phone,
                  avatar: order.delivery.deliveryPartner.avatar,
                  vehicleType: order.delivery.deliveryPartner.vehicleType,
                  vehicleNumber: order.delivery.deliveryPartner.vehicleNumber,
                  rating: order.delivery.deliveryPartner.rating,
                }
              : null,
          }
        : null,
      // Status timeline
      statusHistory: order.statusHistory.map((h) => ({
        status: h.status,
        note: h.note,
        timestamp: h.createdAt,
      })),
      // Items summary
      items: order.items,
      // Payment info
      payments: order.payments,
    };

    return NextResponse.json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
