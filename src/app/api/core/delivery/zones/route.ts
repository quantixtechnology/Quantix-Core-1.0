// ============================================================================
// QUANTIX CORE — Delivery Zones API
// GET  /api/core/delivery/zones  — List delivery zones for a business
// POST /api/core/delivery/zones  — Create delivery zone
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const storeId = searchParams.get('storeId');

    const where: Record<string, unknown> = {
      businessId,
      ...(storeId && { storeId }),
    };

    const zones = await db.deliveryZone.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: zones,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list delivery zones';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }
    if (!body.zoneType || !['CIRCLE', 'POLYGON', 'PINCODE'].includes(body.zoneType)) {
      return NextResponse.json(
        { success: false, error: 'zoneType must be CIRCLE, POLYGON, or PINCODE' },
        { status: 400 }
      );
    }

    // Validate zone-type-specific fields
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

    const zone = await db.deliveryZone.create({
      data: {
        businessId: body.businessId,
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

    return NextResponse.json({
      success: true,
      data: zone,
      message: 'Delivery zone created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery zone';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
