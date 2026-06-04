// ============================================================================
// QUANTIX API v1 — Order Live Tracking
// GET /api/v1/orders/:orderId/live
//
// Flutter polls this every 5s (or listens via WebSocket delivery:location_updated).
// Returns partner info, latest location, computed ETA, and delivery status.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(
  req: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  try {
    const params = await context.params;
    const orderId = params.orderId;
    if (!orderId) return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 });

    // Require authentication — live tracking exposes partner GPS and phone
    const authHeader = req.headers.get('authorization');
    const businessIdHeader = req.headers.get('x-business-id') || undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    const rt = await db.refreshToken.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true, user: { select: { isActive: true } } },
    });
    if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true, orderNumber: true, status: true, orderType: true,
        customerId: true,
        deliveryLat: true, deliveryLng: true,
        deliveryPartner: {
          select: {
            id: true, name: true, phone: true, avatar: true,
            vehicleType: true, rating: true, currentLat: true, currentLng: true,
          },
        },
        delivery: {
          select: {
            id: true, status: true, liveTracking: true,
            estimatedDeliveryTime: true, actualDeliveryTime: true,
          },
        },
        liveTrackingSession: {
          select: { lastLat: true, lastLng: true, lastUpdated: true, isActive: true },
        },
      },
    });

    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    // Verify ownership: the authenticated customer must own this order
    const customer = await db.customer.findFirst({
      where: {
        userId: rt.userId,
        ...(businessIdHeader ? { businessId: businessIdHeader } : {}),
      },
      select: { id: true },
    });
    if (!customer || order.customerId !== customer.id) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const partner = order.deliveryPartner;
    const session = order.liveTrackingSession;

    // Prefer session's last known location, fall back to partner.currentLat/Lng
    const lat = session?.lastLat ?? partner?.currentLat ?? null;
    const lng = session?.lastLng ?? partner?.currentLng ?? null;
    const locationUpdated = session?.lastUpdated ?? null;

    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    let estimatedArrival: string | null = null;

    if (lat != null && lng != null && order.deliveryLat && order.deliveryLng) {
      distanceKm = Math.round(haversineKm(lat, lng, order.deliveryLat, order.deliveryLng) * 10) / 10;
      etaMinutes = Math.max(1, Math.round((distanceKm / 20) * 60));
      estimatedArrival = new Date(Date.now() + etaMinutes * 60_000).toISOString();
    } else if (order.delivery?.estimatedDeliveryTime) {
      estimatedArrival = order.delivery.estimatedDeliveryTime.toISOString();
      etaMinutes = Math.max(0, Math.round((order.delivery.estimatedDeliveryTime.getTime() - Date.now()) / 60_000));
    }

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          orderType: order.orderType,
        },
        partner: partner
          ? {
              id: partner.id,
              name: partner.name,
              phone: partner.phone,
              avatar: partner.avatar,
              vehicleType: partner.vehicleType,
              rating: partner.rating,
            }
          : null,
        location: lat != null && lng != null
          ? { lat, lng, timestamp: locationUpdated?.toISOString() ?? null }
          : null,
        eta: etaMinutes != null ? `${etaMinutes} min${etaMinutes !== 1 ? 's' : ''}` : null,
        etaMinutes,
        distanceKm,
        estimatedArrival,
        deliveryStatus: order.delivery?.status ?? null,
        isLive: session?.isActive ?? false,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch live tracking';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
