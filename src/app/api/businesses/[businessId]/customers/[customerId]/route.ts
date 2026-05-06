import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  const { businessId, customerId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const customer = await db.customer.findFirst({
        where: { id: customerId, businessId },
        include: {
          addresses: true,
          orders: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              items: { take: 3, select: { productName: true, quantity: true } },
            },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            include: { plan: { select: { name: true, type: true } } },
          },
          _count: { select: { orders: true, subscriptions: true } },
        },
      });

      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: customer });
    } catch (error) {
      console.error('Get customer error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  const { businessId, customerId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields = ['name', 'email', 'phone', 'gstNumber', 'tags', 'metadata', 'isActive'];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          if (['tags', 'metadata'].includes(field)) {
            data[field] = JSON.stringify(body[field]);
          } else {
            data[field] = body[field];
          }
        }
      }

      const updated = await db.customer.update({
        where: { id: customerId },
        data,
      });

      return NextResponse.json({ success: true, data: updated, message: 'Customer updated' });
    } catch (error) {
      console.error('Update customer error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
