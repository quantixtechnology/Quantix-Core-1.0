import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, parsePagination, paginatedResponse, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const { page, limit, skip, search } = parsePagination(request);

      const where: Record<string, unknown> = { businessId, isActive: true };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { pincodes: { contains: search } },
        ];
      }

      const [zones, total] = await Promise.all([
        db.deliveryZone.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.deliveryZone.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(zones, total, page, limit),
      });
    } catch (error) {
      console.error('List delivery zones error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const body = await request.json();
      const {
        name, zoneType, storeId, centerLat, centerLng, radius,
        polygon, pincodes, deliveryFee, minOrderAmount, freeDeliveryAbove,
        estimatedTime, isActive,
      } = body;

      if (!name || !zoneType) {
        return NextResponse.json({ success: false, error: 'Name and zoneType are required' }, { status: 400 });
      }

      const zone = await db.deliveryZone.create({
        data: {
          businessId,
          storeId,
          name,
          zoneType,
          centerLat,
          centerLng,
          radius,
          polygon: polygon ? JSON.stringify(polygon) : null,
          pincodes: pincodes ? JSON.stringify(pincodes) : null,
          deliveryFee: deliveryFee || 0,
          minOrderAmount: minOrderAmount || 0,
          freeDeliveryAbove,
          estimatedTime: estimatedTime || 30,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      return NextResponse.json(
        { success: true, data: zone, message: 'Delivery zone created' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create delivery zone error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
