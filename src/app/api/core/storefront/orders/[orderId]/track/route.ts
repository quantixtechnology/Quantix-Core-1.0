// ============================================================================
// QUANTIX CORE — Order Tracking API
// GET /api/core/storefront/orders/[orderId]/track — Order tracking for customer
//
// Auth optional. Returns order with status timeline, delivery info, and
// delivery partner details.
//
// Partner resolution priority:
//   1. order.delivery.deliveryPartner  (set when using /delivery/assign)
//   2. order.deliveryPartner           (set when using /orders/[id]/assign-partner)
// This two-source approach means either assignment path shows partner info.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const partnerSelect = {
  id: true,
  name: true,
  phone: true,
  avatar: true,
  vehicleType: true,
  vehicleNumber: true,
  rating: true,
} as const;

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
        // Direct FK on Order — always updated by assign-partner admin action
        deliveryPartner: { select: partnerSelect },
        // Through Delivery sub-record — updated by /delivery/assign workflow
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
            deliveryPartner: { select: partnerSelect },
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
          select: { id: true, name: true, email: true, phone: true },
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

    // Resolve partner from either source
    const resolvedPartner = order.delivery?.deliveryPartner ?? order.deliveryPartner ?? null;

    const partnerPayload = resolvedPartner
      ? {
          name: resolvedPartner.name,
          phone: resolvedPartner.phone,
          avatar: resolvedPartner.avatar,
          vehicleType: resolvedPartner.vehicleType,
          vehicleNumber: resolvedPartner.vehicleNumber,
          rating: resolvedPartner.rating,
        }
      : null;

    // Build delivery block — present even when there is no Delivery sub-record if
    // a partner is directly assigned on the order (e.g. manual admin assignment).
    const deliveryBlock = order.delivery
      ? {
          status: order.delivery.status,
          estimatedDeliveryTime: order.delivery.estimatedDeliveryTime,
          actualPickupTime: order.delivery.actualPickupTime,
          actualDeliveryTime: order.delivery.actualDeliveryTime,
          distance: order.delivery.distance,
          liveTracking: (() => {
            try { return JSON.parse(order.delivery!.liveTracking || '[]'); }
            catch { return []; }
          })(),
          partner: partnerPayload,
        }
      : partnerPayload
        ? {
            // No Delivery record but partner IS assigned — surface the info
            status: null,
            estimatedDeliveryTime: null,
            actualPickupTime: null,
            actualDeliveryTime: null,
            distance: null,
            liveTracking: [],
            partner: partnerPayload,
          }
        : null;

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
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
      store: order.store,
      customer: order.customer ? { name: order.customer.name } : null,
      delivery: deliveryBlock,
      statusHistory: order.statusHistory.map((h) => ({
        status: h.status,
        note: h.note,
        timestamp: h.createdAt,
      })),
      items: order.items,
      payments: order.payments,
    };

    return NextResponse.json({ success: true, data: trackingData });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
