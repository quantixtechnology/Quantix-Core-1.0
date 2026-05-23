// ============================================================================
// QUANTIX CORE — Customer Addresses API
// GET  /api/core/businesses/[businessId]/customers/[customerId]/addresses  (auth)
// POST /api/core/businesses/[businessId]/customers/[customerId]/addresses  (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    const addresses = await db.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: addresses });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list addresses';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const body = (await req.json()) as {
      label?: string; area?: string; addressLine1: string; addressLine2?: string;
      city: string; state: string; pincode: string; country?: string;
      latitude?: number; longitude?: number; gpsAccuracy?: number;
      landmark?: string; instructions?: string; isDefault?: boolean;
    };

    if (!body.addressLine1 || !body.city || !body.state || !body.pincode) {
      return NextResponse.json({ success: false, error: 'Missing required fields: addressLine1, city, state, pincode' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });

    if (body.isDefault) {
      await db.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    }

    const isFirst = (await db.address.count({ where: { customerId } })) === 0;

    const address = await db.address.create({
      data: {
        customerId, label: body.label, area: body.area,
        addressLine1: body.addressLine1, addressLine2: body.addressLine2,
        city: body.city, state: body.state, pincode: body.pincode, country: body.country || 'India',
        latitude: body.latitude, longitude: body.longitude, gpsAccuracy: body.gpsAccuracy,
        landmark: body.landmark, instructions: body.instructions,
        isDefault: body.isDefault ?? isFirst,
      },
    });

    return NextResponse.json({ success: true, data: address, message: 'Address created successfully' }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create address';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
