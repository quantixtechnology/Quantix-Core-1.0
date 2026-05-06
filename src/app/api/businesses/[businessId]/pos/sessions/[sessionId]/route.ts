import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; sessionId: string }> }
) {
  const { businessId, sessionId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const session = await db.pOSSession.findFirst({
        where: { id: sessionId, businessId },
        include: {
          store: { select: { id: true, name: true, code: true } },
          orders: {
            take: 20,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              paymentMethod: true,
              paymentStatus: true,
              createdAt: true,
              items: { take: 5, select: { productName: true, quantity: true, totalPrice: true } },
            },
          },
          _count: { select: { orders: true } },
        },
      });

      if (!session) {
        return NextResponse.json({ success: false, error: 'POS session not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: session });
    } catch (error) {
      console.error('Get POS session error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; sessionId: string }> }
) {
  const { businessId, sessionId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const session = await db.pOSSession.findFirst({ where: { id: sessionId, businessId } });
      if (!session) {
        return NextResponse.json({ success: false, error: 'POS session not found' }, { status: 404 });
      }

      const body = await request.json();
      const { action } = body;

      if (action === 'close') {
        if (session.status !== 'OPEN') {
          return NextResponse.json({ success: false, error: 'Session is not open' }, { status: 400 });
        }

        // Calculate totals from orders
        const orders = await db.order.findMany({
          where: { posSessionId: sessionId, paymentStatus: 'COMPLETED' },
        });

        const totalSales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalCash = orders.filter(o => o.paymentMethod === 'CASH' || o.paymentMethod === 'COD').reduce((sum, o) => sum + o.totalAmount, 0);
        const totalCard = orders.filter(o => o.paymentMethod === 'CARD').reduce((sum, o) => sum + o.totalAmount, 0);
        const totalUpi = orders.filter(o => o.paymentMethod === 'UPI').reduce((sum, o) => sum + o.totalAmount, 0);

        const updated = await db.pOSSession.update({
          where: { id: sessionId },
          data: {
            status: 'CLOSED',
            closingBalance: body.closingBalance || totalCash + session.openingBalance,
            totalSales,
            totalCash,
            totalCard,
            totalUpi,
            totalOrders: orders.length,
            closedAt: new Date(),
          },
        });

        return NextResponse.json({ success: true, data: updated, message: 'POS session closed' });
      }

      if (action === 'suspend') {
        const updated = await db.pOSSession.update({
          where: { id: sessionId },
          data: { status: 'SUSPENDED' },
        });
        return NextResponse.json({ success: true, data: updated, message: 'POS session suspended' });
      }

      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (error) {
      console.error('Update POS session error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
