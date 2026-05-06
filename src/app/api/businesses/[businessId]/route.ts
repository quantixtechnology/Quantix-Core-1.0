import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const business = await db.business.findUnique({
      where: { id: businessId },
      include: {
        businessSubscription: { include: { plan: true, billingHistory: { take: 10, orderBy: { createdAt: 'desc' } } } },
        domain: true,
        deployments: true,
        salesRep: { select: { id: true, name: true, email: true } },
        _count: { select: { stores: true, products: true, orders: true, customers: true, deliveryPartners: true, businessUsers: true } },
      },
    });

    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: business });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();

    const existing = await db.business.findUnique({ where: { id: businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const stringFields = [
      'name', 'tagline', 'description', 'logo', 'favicon', 'primaryColor', 'secondaryColor',
      'gstNumber', 'panNumber', 'cinNumber', 'fssaiLicense',
      'address', 'city', 'state', 'pincode', 'country',
      'contactEmail', 'contactPhone', 'supportEmail', 'supportPhone',
      'defaultCurrency', 'defaultLocale', 'timezone',
    ];

    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const booleanFields = ['darkMode', 'isOnline'];
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const floatFields = ['latitude', 'longitude'];
    for (const field of floatFields) {
      if (body[field] !== undefined) updateData[field] = parseFloat(String(body[field]));
    }

    const jsonFields = ['settings', 'features', 'notificationConfig'];
    for (const field of jsonFields) {
      if (body[field] !== undefined) updateData[field] = JSON.stringify(body[field]);
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'ACTIVE' && !existing.activatedAt) {
        updateData.activatedAt = new Date();
      }
      if (body.status === 'SUSPENDED') {
        updateData.suspendedAt = new Date();
      }
    }

    if (body.salesRepId !== undefined) updateData.salesRepId = body.salesRepId;

    const business = await db.business.update({
      where: { id: businessId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: business });
  } catch (error) {
    console.error('Update business error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update business' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const existing = await db.business.findUnique({ where: { id: businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    await db.business.delete({ where: { id: businessId } });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete business error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete business' },
      { status: 500 }
    );
  }
}
