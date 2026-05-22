// ============================================================================
// QUANTIX CORE — Nearest Store API
// GET /api/core/storefront/nearest-store
//
// Public endpoint — no auth required.
// Accepts GPS coordinates (lat/lng) OR pincode.
// Returns the nearest active store for the business + delivery context.
//
// Used by customer storefront to establish store session before browsing.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkServiceability, haversineDistance } from '@/lib/core/delivery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Accept businessId directly OR resolve from slug/domain
    const businessId = searchParams.get('businessId');
    const slug = searchParams.get('slug');

    if (!businessId && !slug) {
      return NextResponse.json(
        { success: false, error: 'businessId or slug is required' },
        { status: 400 }
      );
    }

    // Resolve business
    let resolvedBusinessId = businessId;
    if (!resolvedBusinessId && slug) {
      const business = await db.business.findUnique({
        where: { slug },
        select: { id: true, status: true },
      });
      if (!business || (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING')) {
        return NextResponse.json(
          { success: false, error: 'Business not found or not active' },
          { status: 404 }
        );
      }
      resolvedBusinessId = business.id;
    }

    // Parse location params
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const pincode = searchParams.get('pincode');

    if (!latParam && !lngParam && !pincode) {
      return NextResponse.json(
        { success: false, error: 'lat/lng or pincode is required' },
        { status: 400 }
      );
    }

    // --- GPS-based detection ---
    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);

      if (isNaN(lat) || isNaN(lng)) {
        return NextResponse.json(
          { success: false, error: 'Invalid lat/lng values' },
          { status: 400 }
        );
      }

      const result = await checkServiceability({
        businessId: resolvedBusinessId!,
        deliveryLat: lat,
        deliveryLng: lng,
      });

      if (!result.serviceable || !result.nearestStoreId) {
        return NextResponse.json({
          success: false,
          serviceable: false,
          reason: result.reason || 'No serviceable store found for your location',
          nearestStore: result.nearestStoreId
            ? {
                id: result.nearestStoreId,
                name: result.nearestStoreName,
                distance: result.distance,
              }
            : null,
        });
      }

      // Return full store details for the nearest serviceable store
      const store = await db.store.findUnique({
        where: { id: result.nearestStoreId },
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          latitude: true,
          longitude: true,
          phone: true,
          email: true,
          status: true,
          deliveryRadius: true,
          deliveryFee: true,
          freeDeliveryAbove: true,
          minOrderAmount: true,
          preparationTime: true,
          operatingHours: true,
          storeTimings: {
            orderBy: { day: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        serviceable: true,
        data: {
          store,
          distance: result.distance,
          deliveryFee: result.deliveryFee,
          estimatedTime: result.estimatedTime,
          freeDeliveryAbove: result.freeDeliveryAbove,
          minOrderAmount: result.minOrderAmount,
          matchedZoneId: result.matchedZoneId,
        },
      });
    }

    // --- Pincode-based detection ---
    if (pincode) {
      // Find stores for this business that serve the given pincode via DeliveryZone
      const zones = await db.deliveryZone.findMany({
        where: {
          businessId: resolvedBusinessId!,
          isActive: true,
          zoneType: 'PINCODE',
        },
      });

      let matchedStoreId: string | null = null;
      let matchedZoneId: string | null = null;

      for (const zone of zones) {
        const pincodes = JSON.parse(zone.pincodes || '[]') as string[];
        if (pincodes.includes(pincode)) {
          matchedStoreId = zone.storeId || null;
          matchedZoneId = zone.id;
          break;
        }
      }

      // Fallback: if no pincode zone matched, return the main store
      if (!matchedStoreId) {
        const mainStore = await db.store.findFirst({
          where: { businessId: resolvedBusinessId!, status: 'ACTIVE', isMainStore: true },
          select: { id: true },
        });
        if (!mainStore) {
          return NextResponse.json({
            success: false,
            serviceable: false,
            reason: 'No active store found for this pincode',
          });
        }
        matchedStoreId = mainStore.id;
      }

      const store = await db.store.findUnique({
        where: { id: matchedStoreId },
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
          latitude: true,
          longitude: true,
          phone: true,
          email: true,
          status: true,
          deliveryRadius: true,
          deliveryFee: true,
          freeDeliveryAbove: true,
          minOrderAmount: true,
          preparationTime: true,
          operatingHours: true,
          storeTimings: {
            orderBy: { day: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        serviceable: true,
        data: {
          store,
          matchedZoneId,
          detectionMethod: 'pincode',
        },
      });
    }

    // Should not reach here
    return NextResponse.json(
      { success: false, error: 'Unable to determine nearest store' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to find nearest store';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — Find nearest store and list all stores for a business
// Used when the customer wants to see all available stores
// ============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, slug, lat, lng } = body;

    if (!businessId && !slug) {
      return NextResponse.json(
        { success: false, error: 'businessId or slug is required' },
        { status: 400 }
      );
    }

    let resolvedBusinessId = businessId;
    if (!resolvedBusinessId && slug) {
      const business = await db.business.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!business) {
        return NextResponse.json(
          { success: false, error: 'Business not found' },
          { status: 404 }
        );
      }
      resolvedBusinessId = business.id;
    }

    // Get all active stores
    const stores = await db.store.findMany({
      where: { businessId: resolvedBusinessId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        latitude: true,
        longitude: true,
        phone: true,
        deliveryRadius: true,
        deliveryFee: true,
        freeDeliveryAbove: true,
        minOrderAmount: true,
        preparationTime: true,
        isMainStore: true,
        operatingHours: true,
        storeTimings: { orderBy: { day: 'asc' } },
      },
      orderBy: [{ isMainStore: 'desc' }, { name: 'asc' }],
    });

    // If GPS provided, annotate with distance and sort by nearest
    if (lat && lng && typeof lat === 'number' && typeof lng === 'number') {
      const storesWithDistance = stores.map((store) => ({
        ...store,
        distance:
          store.latitude && store.longitude
            ? Math.round(haversineDistance(lat, lng, store.latitude, store.longitude) * 10) / 10
            : null,
        serviceable:
          store.latitude && store.longitude
            ? haversineDistance(lat, lng, store.latitude, store.longitude) <=
              (store.deliveryRadius || 5)
            : false,
      }));

      storesWithDistance.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      return NextResponse.json({ success: true, data: storesWithDistance });
    }

    return NextResponse.json({ success: true, data: stores });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list stores';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
