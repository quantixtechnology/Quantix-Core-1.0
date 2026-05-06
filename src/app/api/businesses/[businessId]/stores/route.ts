import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { city: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [stores, total] = await Promise.all([
      db.store.findMany({
        where,
        include: { _count: { select: { inventory: true, orders: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.store.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: stores,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get stores error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stores' },
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
      name, slug, code, address, city, state, pincode,
      latitude, longitude, phone, email, status,
      isMainStore, deliveryRadius, minOrderAmount, deliveryFee,
      freeDeliveryAbove, preparationTime, operatingHours, gstNumber,
      posEnabled, settings,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const store = await db.store.create({
      data: {
        businessId,
        name,
        slug,
        code,
        address,
        city,
        state,
        pincode,
        latitude: latitude ? parseFloat(String(latitude)) : undefined,
        longitude: longitude ? parseFloat(String(longitude)) : undefined,
        phone,
        email,
        status: status || 'ACTIVE',
        isMainStore: isMainStore ?? false,
        deliveryRadius: deliveryRadius ? parseFloat(String(deliveryRadius)) : 5.0,
        minOrderAmount: minOrderAmount ? parseFloat(String(minOrderAmount)) : 0,
        deliveryFee: deliveryFee ? parseFloat(String(deliveryFee)) : 0,
        freeDeliveryAbove: freeDeliveryAbove ? parseFloat(String(freeDeliveryAbove)) : null,
        preparationTime: preparationTime ?? 30,
        operatingHours: operatingHours ? JSON.stringify(operatingHours) : '{}',
        gstNumber,
        posEnabled: posEnabled ?? true,
        settings: settings ? JSON.stringify(settings) : '{}',
      },
    });

    return NextResponse.json({ success: true, data: store }, { status: 201 });
  } catch (error) {
    console.error('Create store error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create store' },
      { status: 500 }
    );
  }
}
