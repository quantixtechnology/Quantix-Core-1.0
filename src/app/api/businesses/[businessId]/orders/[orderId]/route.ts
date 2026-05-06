import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  try {
    const { businessId, orderId } = await params;

    const order = await db.order.findFirst({
      where: { id: orderId, businessId },
      include: {
        items: true,
        customer: true,
        store: { select: { id: true, name: true, address: true, phone: true } },
        delivery: { include: { deliveryPartner: { select: { id: true, name: true, phone: true } } } },
        statusHistory: { orderBy: { createdAt: 'desc' } },
        payments: true,
        invoice: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  try {
    const { businessId, orderId } = await params;
    const body = await request.json();

    const existing = await db.order.findFirst({ where: { id: orderId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'customerName', 'customerPhone', 'customerEmail',
      'deliveryAddress', 'deliveryInstructions', 'notes',
      'paymentMethod', 'paymentStatus', 'cancelReason',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);

    if (body.paymentStatus === 'COMPLETED') updateData.paidAt = new Date();

    const order = await db.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
