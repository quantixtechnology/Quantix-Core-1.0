import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { order: { businessId } };
    if (status) where.status = status;

    const deliveries = await db.delivery.findMany({
      where,
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, businessId: true } },
        deliveryPartner: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: deliveries });
  } catch (error) {
    console.error('Get deliveries error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch deliveries' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { orderId, deliveryPartnerId, pickupLat, pickupLng, pickupAddress, dropLat, dropLng, dropAddress } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const existing = await db.delivery.findUnique({ where: { orderId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Delivery already exists for this order' },
        { status: 409 }
      );
    }

    const delivery = await db.delivery.create({
      data: {
        orderId,
        deliveryPartnerId,
        status: deliveryPartnerId ? 'ASSIGNED' : 'ASSIGNING',
        pickupLat: pickupLat ? parseFloat(String(pickupLat)) : null,
        pickupLng: pickupLng ? parseFloat(String(pickupLng)) : null,
        pickupAddress,
        dropLat: dropLat ? parseFloat(String(dropLat)) : null,
        dropLng: dropLng ? parseFloat(String(dropLng)) : null,
        dropAddress,
      },
    });

    return NextResponse.json({ success: true, data: delivery }, { status: 201 });
  } catch (error) {
    console.error('Create delivery error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delivery' },
      { status: 500 }
    );
  }
}
