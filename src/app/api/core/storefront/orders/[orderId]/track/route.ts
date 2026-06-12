// ============================================================================
// QUANTIX CORE — Order Tracking API
// GET /api/core/storefront/orders/[orderId]/track — Order tracking for customer
//
// Auth optional.
//   - Authenticated: full tracking data, ownership verified (customer must own the order).
//   - Unauthenticated: delivery/status timeline only; customer PII and address stripped.
//
// Partner resolution priority:
//   1. order.delivery.deliveryPartner  (set when using /delivery/assign)
//   2. order.deliveryPartner           (set when using /orders/[id]/assign-partner)
// This two-source approach means either assignment path shows partner info.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantFromHostname } from '@/lib/tenant-resolver';

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

    // Resolve caller identity (optional auth — token via Authorization header)
    const authHeader = request.headers.get('authorization');
    // Hostname is the authoritative tenant source — never the x-business-id header
    const tenantBusinessId = await resolveTenantFromHostname(request);
    let authenticatedCustomerId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const rt = await db.refreshToken.findUnique({
        where: { token },
        select: { userId: true, expiresAt: true, user: { select: { isActive: true } } },
      });
      if (rt && rt.expiresAt >= new Date() && rt.user.isActive) {
        const customer = await db.customer.findFirst({
          where: {
            userId: rt.userId,
            ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}),
          },
          select: { id: true },
        });
        if (customer) authenticatedCustomerId = customer.id;
      }
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
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            pdfUrl: true,
            dueDate: true,
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

    // Ownership enforcement:
    // - Authenticated callers must own the order (customerId must match).
    // - Unauthenticated callers get a minimal response with PII stripped.
    const isOwner = authenticatedCustomerId !== null && order.customer?.id === authenticatedCustomerId;
    if (authenticatedCustomerId !== null && !isOwner) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
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
      // Delivery address and customer info only visible to the authenticated owner
      deliveryAddress: isOwner ? order.deliveryAddress : null,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      deliveredAt: order.deliveredAt,
      store: order.store,
      customer: isOwner && order.customer ? { name: order.customer.name } : null,
      delivery: deliveryBlock,
      statusHistory: order.statusHistory.map((h) => ({
        status: h.status,
        note: h.note,
        timestamp: h.createdAt,
      })),
      items: order.items,
      payments: isOwner ? order.payments : [],
      invoice: isOwner && order.invoice ? {
        id: order.invoice.id,
        invoiceNumber: order.invoice.invoiceNumber,
        invoiceStatus: order.invoice.status,
        invoiceAmount: order.invoice.totalAmount,
        paidAmount: order.invoice.paidAmount,
        balanceAmount: Math.max(0, order.invoice.totalAmount - order.invoice.paidAmount),
        pdfUrl: order.invoice.pdfUrl,
        dueDate: order.invoice.dueDate,
        paidAt: order.invoice.paidAt,
      } : null,
    };

    return NextResponse.json({ success: true, data: trackingData });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
