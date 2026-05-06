import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  const { businessId, orderId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const order = await db.order.findFirst({
        where: { id: orderId, businessId },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true, avatar: true } },
          store: { select: { id: true, name: true, address: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, images: true } },
              variant: { select: { id: true, name: true } },
            },
          },
          delivery: {
            include: {
              deliveryPartner: { select: { id: true, name: true, phone: true, avatar: true } },
            },
          },
          statusHistory: { orderBy: { createdAt: 'desc' } },
          payments: true,
          promoCode: { select: { id: true, code: true, promoType: true, value: true } },
          invoice: true,
        },
      });

      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: order });
    } catch (error) {
      console.error('Get order error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; orderId: string }> }
) {
  const { businessId, orderId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const order = await db.order.findFirst({ where: { id: orderId, businessId } });
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      const body = await request.json();
      const allowedFields = [
        'paymentStatus', 'paymentMethod', 'notes', 'cancelReason',
        'deliveryInstructions', 'scheduledAt',
      ];

      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          data[field] = body[field];
        }
      }

      if (body.cancelReason) {
        data.status = 'CANCELLED';
        data.cancelledAt = new Date();
      }

      const updated = await db.order.update({
        where: { id: orderId },
        data,
        include: { items: true },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Order updated' });
    } catch (error) {
      console.error('Update order error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
