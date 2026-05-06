import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  const { businessId, storeId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const store = await db.store.findFirst({
        where: { id: storeId, businessId },
        include: {
          _count: { select: { orders: true, inventory: true, staff: true, posSessions: true } },
          storeTimings: { orderBy: { day: 'asc' } },
        },
      });

      if (!store) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: store });
    } catch (error) {
      console.error('Get store error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  const { businessId, storeId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN' && bu.role !== 'STORE_MANAGER')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const store = await db.store.findFirst({ where: { id: storeId, businessId } });
      if (!store) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields = [
        'name', 'code', 'address', 'city', 'state', 'pincode', 'country',
        'latitude', 'longitude', 'phone', 'email', 'status', 'isMainStore',
        'deliveryRadius', 'minOrderAmount', 'deliveryFee', 'freeDeliveryAbove',
        'preparationTime', 'operatingHours', 'gstNumber', 'posEnabled', 'settings',
      ];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (field === 'operatingHours' || field === 'settings') {
            data[field] = JSON.stringify(body[field]);
          } else {
            data[field] = body[field];
          }
        }
      }

      const updated = await db.store.update({ where: { id: storeId }, data });
      return NextResponse.json({ success: true, data: updated, message: 'Store updated successfully' });
    } catch (error) {
      console.error('Update store error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; storeId: string }> }
) {
  const { businessId, storeId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const store = await db.store.findFirst({ where: { id: storeId, businessId } });
      if (!store) {
        return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
      }

      await db.store.update({ where: { id: storeId }, data: { status: 'INACTIVE' } });
      return NextResponse.json({ success: true, message: 'Store deactivated successfully' });
    } catch (error) {
      console.error('Delete store error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
