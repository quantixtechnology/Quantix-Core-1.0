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
      const statusFilter = new URL(request.url).searchParams.get('status');

      const where: Record<string, unknown> = { businessId };
      if (search) {
        where.OR = [
          { name: { contains: search } },
          { slug: { contains: search } },
          { city: { contains: search } },
        ];
      }
      if (statusFilter) {
        where.status = statusFilter;
      }

      const [stores, total] = await Promise.all([
        db.store.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { orders: true, inventory: true, staff: true } },
          },
        }),
        db.store.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(stores, total, page, limit),
      });
    } catch (error) {
      console.error('List stores error:', error);
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
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const {
        name, slug, code, address, city, state, pincode, country,
        latitude, longitude, phone, email, status, isMainStore,
        deliveryRadius, minOrderAmount, deliveryFee, freeDeliveryAbove,
        preparationTime, operatingHours, gstNumber, posEnabled, settings,
      } = body;

      if (!name || !slug) {
        return NextResponse.json({ success: false, error: 'Name and slug are required' }, { status: 400 });
      }

      const existing = await db.store.findUnique({ where: { businessId_slug: { businessId, slug } } });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Store slug already exists' }, { status: 409 });
      }

      const store = await db.store.create({
        data: {
          businessId,
          name,
          slug,
          code,
          address,
          city,
          state,
          pincode,
          country: country || 'India',
          latitude,
          longitude,
          phone,
          email,
          status: status || 'ACTIVE',
          isMainStore: isMainStore || false,
          deliveryRadius: deliveryRadius || 5.0,
          minOrderAmount: minOrderAmount || 0,
          deliveryFee: deliveryFee || 0,
          freeDeliveryAbove,
          preparationTime: preparationTime || 30,
          operatingHours: operatingHours ? JSON.stringify(operatingHours) : '{}',
          gstNumber,
          posEnabled: posEnabled !== undefined ? posEnabled : true,
          settings: settings ? JSON.stringify(settings) : '{}',
        },
      });

      return NextResponse.json(
        { success: true, data: store, message: 'Store created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create store error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
