import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const zones = await db.deliveryZone.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: zones });
  } catch (error) {
    console.error('Get delivery zones error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch delivery zones' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const {
      name, zoneType, centerLat, centerLng, radius, polygon, pincodes,
      storeId, deliveryFee, minOrderAmount, freeDeliveryAbove, estimatedTime, isActive,
    } = body;

    if (!name || !zoneType) {
      return NextResponse.json(
        { success: false, error: 'Name and zoneType are required' },
        { status: 400 }
      );
    }

    const zone = await db.deliveryZone.create({
      data: {
        businessId,
        storeId,
        name,
        zoneType,
        centerLat: centerLat ? parseFloat(String(centerLat)) : null,
        centerLng: centerLng ? parseFloat(String(centerLng)) : null,
        radius: radius ? parseFloat(String(radius)) : null,
        polygon,
        pincodes,
        deliveryFee: deliveryFee ? parseFloat(String(deliveryFee)) : 0,
        minOrderAmount: minOrderAmount ? parseFloat(String(minOrderAmount)) : 0,
        freeDeliveryAbove: freeDeliveryAbove ? parseFloat(String(freeDeliveryAbove)) : null,
        estimatedTime: estimatedTime ?? 30,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    console.error('Create delivery zone error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delivery zone' },
      { status: 500 }
    );
  }
}
