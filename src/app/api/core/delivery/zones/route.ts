// ============================================================================
// QUANTIX CORE — Delivery Zones API
// GET  /api/core/delivery/zones  — List delivery zones (auth required)
// POST /api/core/delivery/zones  — Create delivery zone (CLIENT_OWNER+)
//
// STORE ISOLATION:
//   STORE_MANAGER → only zones for their assigned storeId
//   CLIENT_OWNER  → all zones for their business
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) {
        return NextResponse.json(
          { success: false, error: 'businessId is required' },
          { status: 400 }
        );
      }
      businessId = qb;
    } else {
      if (!user.businessId) {
        return NextResponse.json(
          { success: false, error: 'No business context found for this user' },
          { status: 400 }
        );
      }
      businessId = user.businessId;
    }

    // STORE_MANAGER: force filter to their assigned store
    const requestedStoreId = searchParams.get('storeId') || undefined;
    const enforcedStoreId =
      user.role === 'STORE_MANAGER' && user.storeId
        ? user.storeId
        : requestedStoreId;

    const where: Record<string, unknown> = {
      businessId,
      ...(enforcedStoreId && { storeId: enforcedStoreId }),
    };

    const zones = await db.deliveryZone.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: zones });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list delivery zones';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
    }
    if (!body.zoneType || !['CIRCLE', 'POLYGON', 'PINCODE'].includes(body.zoneType)) {
      return NextResponse.json(
        { success: false, error: 'zoneType must be CIRCLE, POLYGON, or PINCODE' },
        { status: 400 }
      );
    }

    if (body.zoneType === 'CIRCLE') {
      if (!body.centerLat || !body.centerLng || !body.radius) {
        return NextResponse.json(
          { success: false, error: 'CIRCLE zones require centerLat, centerLng, and radius' },
          { status: 400 }
        );
      }
    } else if (body.zoneType === 'POLYGON' && !body.polygon) {
      return NextResponse.json(
        { success: false, error: 'POLYGON zones require polygon (GeoJSON string)' },
        { status: 400 }
      );
    } else if (body.zoneType === 'PINCODE' && !body.pincodes) {
      return NextResponse.json(
        { success: false, error: 'PINCODE zones require pincodes' },
        { status: 400 }
      );
    }

    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const zone = await db.deliveryZone.create({
      data: {
        businessId,
        storeId: body.storeId,
        name: body.name,
        zoneType: body.zoneType,
        centerLat: body.centerLat,
        centerLng: body.centerLng,
        radius: body.radius,
        polygon: body.polygon,
        pincodes: typeof body.pincodes === 'object' ? JSON.stringify(body.pincodes) : body.pincodes,
        deliveryFee: body.deliveryFee || 0,
        minOrderAmount: body.minOrderAmount || 0,
        freeDeliveryAbove: body.freeDeliveryAbove,
        estimatedTime: body.estimatedTime || 30,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json(
      { success: true, data: zone, message: 'Delivery zone created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery zone';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
