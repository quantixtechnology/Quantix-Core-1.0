// ============================================================================
// QUANTIX API v1 — Partner Live Location Update
// PUT /api/v1/delivery/partners/:partnerId/location
//
// Called by Delivery App every N seconds during an active delivery.
// Stores to PartnerLocationHistory, updates LiveTrackingSession,
// updates partner.currentLat/Lng, emits WebSocket event.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { emitDeliveryLocationUpdated } from '@/lib/socket/emitter';

// Haversine distance (km)
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const PUT = withMiddleware({
  requireAuth: true,
  requiredRoles: ['DELIVERY_STAFF', 'CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const partnerId = params?.partnerId as string;
    if (!partnerId) return NextResponse.json({ success: false, error: 'partnerId required' }, { status: 400 });

    const body = await req.json() as {
      lat: number; lng: number; orderId?: string;
      accuracy?: number; heading?: number; speed?: number;
    };
    const { lat, lng, orderId, accuracy, heading, speed } = body;

    if (lat == null || lng == null) {
      return NextResponse.json({ success: false, error: 'lat and lng are required' }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ success: false, error: 'Invalid coordinates' }, { status: 400 });
    }

    const partner = await db.deliveryPartner.findUnique({ where: { id: partnerId } });
    if (!partner) return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 });

    const user = req.user!;
    if (!user.isPlatformAdmin && partner.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Partner not found' }, { status: 404 });
    }

    const capturedAt = new Date();

    // 1. Store location history
    await db.partnerLocationHistory.create({
      data: { partnerId, orderId: orderId || null, lat, lng, accuracy, heading, speed, capturedAt },
    });

    // 2. Update partner's current position
    await db.deliveryPartner.update({
      where: { id: partnerId },
      data: { currentLat: lat, currentLng: lng },
    });

    // 3. Upsert LiveTrackingSession if orderId provided
    let etaMinutes: number | undefined;
    let distanceKm: number | undefined;

    if (orderId) {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: { id: true, deliveryLat: true, deliveryLng: true, businessId: true },
      });

      if (order) {
        await db.liveTrackingSession.upsert({
          where: { orderId },
          create: { orderId, partnerId, isActive: true, lastLat: lat, lastLng: lng, lastUpdated: capturedAt },
          update: { lastLat: lat, lastLng: lng, lastUpdated: capturedAt, isActive: true },
        });

        // Also append to Delivery.liveTracking JSON (legacy compat)
        try {
          const delivery = await db.delivery.findFirst({ where: { orderId } });
          if (delivery) {
            let track: unknown[] = [];
            try { track = JSON.parse(delivery.liveTracking || '[]'); } catch { track = []; }
            track.push({ lat, lng, accuracy, heading, speed, t: capturedAt.toISOString() });
            // Keep last 200 points only to avoid unbounded growth
            if (track.length > 200) track = track.slice(-200);
            await db.delivery.update({
              where: { id: delivery.id },
              data: { liveTracking: JSON.stringify(track) },
            });
          }
        } catch { /* non-critical */ }

        // Calculate ETA if drop coordinates available
        if (order.deliveryLat && order.deliveryLng) {
          distanceKm = haversineKm(lat, lng, order.deliveryLat, order.deliveryLng);
          // Assume average 20 km/h in urban delivery
          etaMinutes = Math.round((distanceKm / 20) * 60);
        }

        // 4. Emit real-time event
        await emitDeliveryLocationUpdated({
          orderId,
          partnerId,
          partnerName: partner.name,
          lat, lng, accuracy, heading, speed,
          etaMinutes,
          distanceKm,
          businessId: order.businessId,
          timestamp: capturedAt.toISOString(),
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { lat, lng, capturedAt: capturedAt.toISOString(), etaMinutes, distanceKm },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to update location';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
