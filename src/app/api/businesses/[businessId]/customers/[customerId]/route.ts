import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      include: {
        addresses: true,
        orders: { take: 10, orderBy: { createdAt: 'desc' } },
        subscriptions: { include: { plan: true } },
        _count: { select: { orders: true, subscriptions: true, invoices: true } },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error('Get customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; customerId: string }> }
) {
  try {
    const { businessId, customerId } = await params;
    const body = await request.json();

    const existing = await db.customer.findFirst({ where: { id: customerId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'email', 'phone', 'avatar', 'gstNumber', 'isActive'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.tags) updateData.tags = JSON.stringify(body.tags);
    if (body.metadata) updateData.metadata = JSON.stringify(body.metadata);

    const customer = await db.customer.update({
      where: { id: customerId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error('Update customer error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}
