// ============================================================================
// QUANTIX CORE — Delivery Partners API
// GET  /api/core/delivery/partners  — List delivery partners for a business
// POST /api/core/delivery/partners  — Create delivery partner
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

    const isOnline = searchParams.get('isOnline');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {
      businessId,
      ...(isOnline !== null && { isOnline: isOnline === 'true' }),
      ...(isActive !== null && { isActive: isActive !== 'false' }),
    };

    const partners = await db.deliveryPartner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: partners,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list delivery partners';
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
    if (!body.phone) {
      return NextResponse.json(
        { success: false, error: 'phone is required' },
        { status: 400 }
      );
    }

    // Check for duplicate phone within business
    const existing = await db.deliveryPartner.findUnique({
      where: {
        businessId_phone: {
          businessId: body.businessId,
          phone: body.phone,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A delivery partner with this phone number already exists for this business' },
        { status: 400 }
      );
    }

    const partner = await db.deliveryPartner.create({
      data: {
        businessId: body.businessId,
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

    return NextResponse.json({
      success: true,
      data: partner,
      message: 'Delivery partner created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create delivery partner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
