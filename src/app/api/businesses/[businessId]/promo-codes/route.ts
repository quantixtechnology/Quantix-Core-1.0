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
          { code: { contains: search } },
          { description: { contains: search } },
        ];
      }

      const [promoCodes, total] = await Promise.all([
        db.promoCode.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.promoCode.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(promoCodes, total, page, limit),
      });
    } catch (error) {
      console.error('List promo codes error:', error);
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
        code, description, promoType, value, minOrderAmount, maxDiscount,
        usageLimit, perCustomerLimit, applicableCategories, applicableProducts,
        applicableStores, isFirstOrderOnly, isActive, startsAt, endsAt,
      } = body;

      if (!code || !promoType || value === undefined || !startsAt || !endsAt) {
        return NextResponse.json(
          { success: false, error: 'Code, promoType, value, startsAt, and endsAt are required' },
          { status: 400 }
        );
      }

      const existing = await db.promoCode.findUnique({
        where: { businessId_code: { businessId, code: code.toUpperCase() } },
      });
      if (existing) {
        return NextResponse.json({ success: false, error: 'Promo code already exists' }, { status: 409 });
      }

      const promoCode = await db.promoCode.create({
        data: {
          businessId,
          code: code.toUpperCase(),
          description,
          promoType,
          value,
          minOrderAmount: minOrderAmount || 0,
          maxDiscount,
          usageLimit,
          perCustomerLimit,
          applicableCategories: applicableCategories ? JSON.stringify(applicableCategories) : '[]',
          applicableProducts: applicableProducts ? JSON.stringify(applicableProducts) : '[]',
          applicableStores: applicableStores ? JSON.stringify(applicableStores) : '[]',
          isFirstOrderOnly: isFirstOrderOnly || false,
          isActive: isActive !== undefined ? isActive : true,
          startsAt: new Date(startsAt),
          endsAt: new Date(endsAt),
        },
      });

      return NextResponse.json(
        { success: true, data: promoCode, message: 'Promo code created' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create promo code error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
