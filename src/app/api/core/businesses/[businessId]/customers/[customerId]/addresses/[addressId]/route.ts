// ============================================================================
// QUANTIX CORE — Customer Address Detail API
// GET    /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]
// PUT    /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]
// DELETE /api/core/businesses/[businessId]/customers/[customerId]/addresses/[addressId]
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;
    const addressId = params?.addressId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });
    }

    const address = await db.address.findFirst({
      where: { id: addressId, customerId, customer: { businessId } },
    });

    if (!address) return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: address });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get address';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;
    const addressId = params?.addressId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });
    }

    const existing = await db.address.findFirst({
      where: { id: addressId, customerId, customer: { businessId } },
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });

    const body = (await req.json()) as {
      addressLine1?: string; addressLine2?: string; city?: string; state?: string;
      pincode?: string; country?: string; latitude?: number; longitude?: number;
      landmark?: string; instructions?: string; isDefault?: boolean;
    };

    if (body.isDefault) {
      await db.address.updateMany({ where: { customerId, id: { not: addressId } }, data: { isDefault: false } });
    }

    const address = await db.address.update({
      where: { id: addressId },
      data: {
        addressLine1: body.addressLine1, addressLine2: body.addressLine2,
        city: body.city, state: body.state, pincode: body.pincode, country: body.country,
        latitude: body.latitude, longitude: body.longitude,
        landmark: body.landmark, instructions: body.instructions, isDefault: body.isDefault,
      },
    });

    return NextResponse.json({ success: true, data: address, message: 'Address updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update address';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const DELETE = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;
    const addressId = params?.addressId as string;

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });
    }

    const existing = await db.address.findFirst({
      where: { id: addressId, customerId, customer: { businessId } },
    });
    if (!existing) return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });

    await db.address.delete({ where: { id: addressId } });
    return NextResponse.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete address';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
