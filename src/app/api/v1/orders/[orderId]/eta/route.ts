// ============================================================================
// QUANTIX API v1 — Order ETA
// GET /api/v1/orders/:orderId/eta
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveTenantFromHostname } from '@/lib/tenant-resolver';

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

    // Require auth to prevent order enumeration
    const authHeader = req.headers.get('authorization');
    const tenantBusinessId = await resolveTenantFromHostname(req);
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
        customerId: true,
        deliveryLat: true, deliveryLng: true,
        liveTrackingSession: { select: { lastLat: true, lastLng: true, lastUpdated: true } },
        deliveryPartner: { select: { currentLat: true, currentLng: true } },
        delivery: { select: { estimatedDeliveryTime: true } },
      },
    });

    if (!order) return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });

    // Verify ownership
    const customer = await db.customer.findFirst({
      where: { userId: rt.userId, ...(tenantBusinessId ? { businessId: tenantBusinessId } : {}) },
      select: { id: true },
    });
    if (!customer || order.customerId !== customer.id) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const partnerLat = order.liveTrackingSession?.lastLat ?? order.deliveryPartner?.currentLat ?? null;
    const partnerLng = order.liveTrackingSession?.lastLng ?? order.deliveryPartner?.currentLng ?? null;

    let etaMinutes: number | null = null;
    let distanceKm: number | null = null;
    let estimatedArrival: string | null = null;

    if (partnerLat != null && partnerLng != null && order.deliveryLat && order.deliveryLng) {
      distanceKm = Math.round(haversineKm(partnerLat, partnerLng, order.deliveryLat, order.deliveryLng) * 10) / 10;
      etaMinutes = Math.max(1, Math.round((distanceKm / 20) * 60));
      estimatedArrival = new Date(Date.now() + etaMinutes * 60_000).toISOString();
    } else if (order.delivery?.estimatedDeliveryTime) {
      estimatedArrival = order.delivery.estimatedDeliveryTime.toISOString();
      etaMinutes = Math.max(0, Math.round((order.delivery.estimatedDeliveryTime.getTime() - Date.now()) / 60_000));
    }

    return NextResponse.json({
      success: true,
      data: {
        etaMinutes,
        distanceKm,
        estimatedArrival,
        eta: etaMinutes != null ? `${etaMinutes} min${etaMinutes !== 1 ? 's' : ''}` : null,
        lastLocationUpdate: order.liveTrackingSession?.lastUpdated?.toISOString() ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to compute ETA';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
