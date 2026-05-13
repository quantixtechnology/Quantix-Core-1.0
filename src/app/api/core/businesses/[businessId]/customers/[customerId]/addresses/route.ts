// ============================================================================
// QUANTIX CORE — Customer Addresses API
// GET  /api/core/businesses/[businessId]/customers/[customerId]/addresses  — List addresses
// POST /api/core/businesses/[businessId]/customers/[customerId]/addresses  — Create address
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;

    // Verify customer belongs to business
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const addresses = await db.address.findMany({
      where: { customerId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list addresses';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;
    const body = (await request.json()) as {
      label?: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      pincode: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      landmark?: string;
      instructions?: string;
      isDefault?: boolean;
    };

    if (!body.addressLine1 || !body.city || !body.state || !body.pincode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: addressLine1, city, state, pincode' },
        { status: 400 }
      );
    }

    // Verify customer belongs to business
    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (body.isDefault) {
      await db.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const address = await db.address.create({
      data: {
        customerId,
        label: body.label,
        addressLine1: body.addressLine1,
        addressLine2: body.addressLine2,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        country: body.country || 'India',
        latitude: body.latitude,
        longitude: body.longitude,
        landmark: body.landmark,
        instructions: body.instructions,
        isDefault: body.isDefault || false,
      },
    });

    return NextResponse.json(
      { success: true, data: address, message: 'Address created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create address';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}