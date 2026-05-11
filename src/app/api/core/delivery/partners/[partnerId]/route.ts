// ============================================================================
// QUANTIX CORE — Delivery Partner Detail API
// GET    /api/core/delivery/partners/[partnerId] — Get single partner
// PATCH  /api/core/delivery/partners/[partnerId] — Update partner details
// DELETE /api/core/delivery/partners/[partnerId] — Soft delete partner
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> }
) {
  try {
    const { partnerId } = await params;

    if (!partnerId || typeof partnerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid partner ID' },
        { status: 400 }
      );
    }

    const partner = await db.deliveryPartner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      return NextResponse.json(
        { success: false, error: 'Delivery partner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: partner,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get delivery partner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> }
) {
  try {
    const { partnerId } = await params;

    if (!partnerId || typeof partnerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid partner ID' },
        { status: 400 }
      );
    }

    // Verify partner exists
    const existing = await db.deliveryPartner.findUnique({
      where: { id: partnerId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Delivery partner not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update data — only include fields that are provided
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.vehicleType !== undefined) updateData.vehicleType = body.vehicleType;
    if (body.vehicleNumber !== undefined) updateData.vehicleNumber = body.vehicleNumber;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;
    if (body.licenseNumber !== undefined) updateData.licenseNumber = body.licenseNumber;
    if (body.isOnline !== undefined) updateData.isOnline = body.isOnline;
    if (body.currentLat !== undefined) updateData.currentLat = body.currentLat;
    if (body.currentLng !== undefined) updateData.currentLng = body.currentLng;
    if (body.fcmToken !== undefined) updateData.fcmToken = body.fcmToken;
    if (body.bankAccount !== undefined) updateData.bankAccount = body.bankAccount;

    // If phone is being changed, check for duplicates within business
    if (body.phone && body.phone !== existing.phone) {
      const phoneInUse = await db.deliveryPartner.findUnique({
        where: {
          businessId_phone: {
            businessId: existing.businessId,
            phone: body.phone,
          },
        },
      });
      if (phoneInUse) {
        return NextResponse.json(
          { success: false, error: 'A delivery partner with this phone number already exists for this business' },
          { status: 400 }
        );
      }
    }

    const updated = await db.deliveryPartner.update({
      where: { id: partnerId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Delivery partner updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update delivery partner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> }
) {
  try {
    const { partnerId } = await params;

    if (!partnerId || typeof partnerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid partner ID' },
        { status: 400 }
      );
    }

    // Verify partner exists
    const existing = await db.deliveryPartner.findUnique({
      where: { id: partnerId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Delivery partner not found' },
        { status: 404 }
      );
    }

    // Soft delete — set isActive to false
    await db.deliveryPartner.update({
      where: { id: partnerId },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Delivery partner deactivated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate delivery partner';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
