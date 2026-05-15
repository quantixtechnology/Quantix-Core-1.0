// ============================================================================
// QUANTIX CORE — Delivery Partners API
// GET  /api/core/delivery/partners  — List delivery partners (auth required)
// POST /api/core/delivery/partners  — Create delivery partner (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId
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

    const isOnline = searchParams.get('isOnline');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { businessId };
    if (isOnline !== null) where.isOnline = isOnline === 'true';
    if (isActive !== null) where.isActive = isActive === 'true';

    const partners = await db.deliveryPartner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list delivery partners';
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
    if (!body.phone) {
      return NextResponse.json({ success: false, error: 'phone is required' }, { status: 400 });
    }

    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const existing = await db.deliveryPartner.findUnique({
      where: { businessId_phone: { businessId, phone: body.phone } },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A delivery partner with this phone number already exists' },
        { status: 409 }
      );
    }

    const partner = await db.deliveryPartner.create({
      data: {
        businessId,
        userId: body.userId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        avatar: body.avatar,
        vehicleType: body.vehicleType,
        vehicleNumber: body.vehicleNumber,
        licenseNumber: body.licenseNumber,
        isOnline: body.isOnline || false,
        isActive: body.isActive !== false,
        currentLat: body.currentLat,
        currentLng: body.currentLng,
        fcmToken: body.fcmToken,
        bankAccount: body.bankAccount,
      },
    });

    return NextResponse.json(
      { success: true, data: partner, message: 'Delivery partner created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery partner';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
