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
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      const [customers, total] = await Promise.all([
        db.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { orders: true, subscriptions: true, addresses: true } },
          },
        }),
        db.customer.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(customers, total, page, limit),
      });
    } catch (error) {
      console.error('List customers error:', error);
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
      const { name, email, phone, gstNumber, tags, metadata, userId } = body;

      if (!name) {
        return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
      }

      // Check phone uniqueness within business
      if (phone) {
        const existing = await db.customer.findUnique({
          where: { businessId_phone: { businessId, phone } },
        });
        if (existing) {
          return NextResponse.json({ success: false, error: 'Customer with this phone already exists' }, { status: 409 });
        }
      }

      const customer = await db.customer.create({
        data: {
          businessId,
          userId,
          name,
          email,
          phone,
          gstNumber,
          tags: tags ? JSON.stringify(tags) : '[]',
          metadata: metadata ? JSON.stringify(metadata) : '{}',
        },
      });

      return NextResponse.json(
        { success: true, data: customer, message: 'Customer created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create customer error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
