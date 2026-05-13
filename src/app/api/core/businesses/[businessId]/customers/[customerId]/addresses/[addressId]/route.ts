// ============================================================================
// QUANTIX CORE — Customer Address Detail API
// GET  /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]  — Get address
// PUT  /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]  — Update address
// DELETE /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]  — Delete address
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string; addressId: string }> }
) {
  try {
    const { businessId, customerId, addressId } = await params;

    // Verify address belongs to customer and business
    const address = await db.address.findFirst({
      where: {
        id: addressId,
        customerId,
        customer: { businessId },
      },
    });

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: address,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get address';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string; addressId: string }> }
) {
  try {
    const { businessId, customerId, addressId } = await params;
    const body = (await request.json()) as {
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      landmark?: string;
      instructions?: string;
      isDefault?: boolean;
    };

    // Verify address belongs to customer and business
    const existing = await db.address.findFirst({
      where: {
        id: addressId,
        customerId,
        customer: { businessId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await db.address.updateMany({
        where: { customerId, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const address = await db.address.update({
      where: { id: addressId },
      data: {
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        country: body.country,
        latitude: body.latitude,
        longitude: body.longitude,
        landmark: body.landmark,
        instructions: body.instructions,
        isDefault: body.isDefault,
      },
    });

    return NextResponse.json({
      success: true,
      data: address,
      message: 'Address updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update address';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string; addressId: string }> }
) {
  try {
    const { businessId, customerId, addressId } = await params;

    // Verify address belongs to customer and business
    const existing = await db.address.findFirst({
      where: {
        id: addressId,
        customerId,
        customer: { businessId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Address not found' },
        { status: 404 }
      );
    }

    await db.address.delete({
      where: { id: addressId },
    });

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete address';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}