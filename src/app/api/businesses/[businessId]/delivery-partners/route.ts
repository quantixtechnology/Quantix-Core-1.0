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
      const { searchParams } = new URL(request.url);
      const isOnline = searchParams.get('isOnline');

      const where: Record<string, unknown> = { businessId, isActive: true };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ];
      }
      if (isOnline !== null && isOnline !== undefined) {
        where.isOnline = isOnline === 'true';
      }

      const [partners, total] = await Promise.all([
        db.deliveryPartner.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { deliveries: true } },
          },
        }),
        db.deliveryPartner.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(partners, total, page, limit),
      });
    } catch (error) {
      console.error('List delivery partners error:', error);
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
      const { name, phone, email, vehicleType, vehicleNumber, licenseNumber, userId } = body;

      if (!name || !phone) {
        return NextResponse.json({ success: false, error: 'Name and phone are required' }, { status: 400 });
      }

      const existing = await db.deliveryPartner.findUnique({
        where: { businessId_phone: { businessId, phone } },
      });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Partner with this phone already exists' }, { status: 409 });
      }

      const partner = await db.deliveryPartner.create({
        data: {
          businessId,
          name,
          phone,
          email,
          vehicleType,
          vehicleNumber,
          licenseNumber,
          userId,
        },
      });

      return NextResponse.json(
        { success: true, data: partner, message: 'Delivery partner created' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create delivery partner error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
