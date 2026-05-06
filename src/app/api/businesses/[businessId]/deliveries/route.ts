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
      const status = searchParams.get('status');

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { order: { orderNumber: { contains: search } } },
          { deliveryPartner: { name: { contains: search } } },
        ];
      }
      where.order = { businessId };

      const [deliveries, total] = await Promise.all([
        db.delivery.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerName: true,
                customerPhone: true,
                totalAmount: true,
              },
            },
            deliveryPartner: {
              select: { id: true, name: true, phone: true, avatar: true, vehicleType: true },
            },
          },
        }),
        db.delivery.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(deliveries, total, page, limit),
      });
    } catch (error) {
      console.error('List deliveries error:', error);
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
      const body = await request.json();
      const { orderId, deliveryPartnerId } = body;

      if (!orderId || !deliveryPartnerId) {
        return NextResponse.json({ success: false, error: 'Order ID and delivery partner ID are required' }, { status: 400 });
      }

      const order = await db.order.findFirst({ where: { id: orderId, businessId } });
      if (!order) {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
      }

      const partner = await db.deliveryPartner.findFirst({ where: { id: deliveryPartnerId, businessId, isActive: true } });
      if (!partner) {
        return NextResponse.json({ success: false, error: 'Delivery partner not found or inactive' }, { status: 404 });
      }

      // Check if delivery already exists
      const existingDelivery = await db.delivery.findUnique({ where: { orderId } });
      if (existingDelivery) {
        // Update existing delivery
        const updated = await db.delivery.update({
          where: { id: existingDelivery.id },
          data: {
            deliveryPartnerId,
            status: 'ASSIGNED',
            pickupOtp: String(Math.floor(1000 + Math.random() * 9000)),
            deliveryOtp: String(Math.floor(1000 + Math.random() * 9000)),
          },
          include: { deliveryPartner: { select: { name: true, phone: true } } },
        });
        return NextResponse.json({ success: true, data: updated, message: 'Delivery partner reassigned' });
      }

      const delivery = await db.delivery.create({
        data: {
          orderId,
          deliveryPartnerId,
          status: 'ASSIGNED',
          pickupAddress: order.deliveryAddress || '',
          dropAddress: order.deliveryAddress || '',
          deliveryOtp: String(Math.floor(1000 + Math.random() * 9000)),
          pickupOtp: String(Math.floor(1000 + Math.random() * 9000)),
        },
        include: { deliveryPartner: { select: { name: true, phone: true } } },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId: user.id,
          action: 'delivery.assigned',
          entity: 'Delivery',
          entityId: delivery.id,
          details: JSON.stringify({ orderId, partnerId: deliveryPartnerId, partnerName: partner.name }),
        },
      });

      return NextResponse.json(
        { success: true, data: delivery, message: 'Delivery partner assigned' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Assign delivery error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
