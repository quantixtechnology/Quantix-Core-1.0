import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  try {
    const { businessId, storeId } = await params;

    const store = await db.store.findFirst({
      where: { id: storeId, businessId },
      include: {
        storeTimings: true,
        _count: { select: { inventory: true, orders: true, staff: true, posSessions: true } },
      },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: store });
  } catch (error) {
    console.error('Get store error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch store' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  try {
    const { businessId, storeId } = await params;
    const body = await request.json();

    const existing = await db.store.findFirst({ where: { id: storeId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const stringFields = [
      'name', 'code', 'address', 'city', 'state', 'pincode', 'phone', 'email',
      'gstNumber', 'printerType', 'paperSize', 'status',
    ];
    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const floatFields: Record<string, string> = {
      deliveryRadius: 'deliveryRadius',
      minOrderAmount: 'minOrderAmount',
      deliveryFee: 'deliveryFee',
      freeDeliveryAbove: 'freeDeliveryAbove',
      latitude: 'latitude',
      longitude: 'longitude',
    };
    for (const [key, prismaKey] of Object.entries(floatFields)) {
      if (body[key] !== undefined) updateData[prismaKey] = parseFloat(String(body[key]));
    }

    const intFields = ['preparationTime'];
    for (const field of intFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const booleanFields = ['isMainStore', 'posEnabled'];
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const jsonFields = ['operatingHours', 'printerConfig', 'settings'];
    for (const field of jsonFields) {
      if (body[field] !== undefined) updateData[field] = JSON.stringify(body[field]);
    }

    const store = await db.store.update({
      where: { id: storeId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: store });
  } catch (error) {
    console.error('Update store error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update store' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  try {
    const { businessId, storeId } = await params;

    const existing = await db.store.findFirst({ where: { id: storeId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    await db.store.delete({ where: { id: storeId } });

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Delete store error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete store' },
      { status: 500 }
    );
  }
}
