import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = { businessId };
    if (isActive !== null) where.isActive = isActive === 'true';

    const partners = await db.deliveryPartner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: partners });
  } catch (error) {
    console.error('Get delivery partners error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch delivery partners' },
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
    const { name, phone, email, avatar, vehicleType, vehicleNumber, licenseNumber, bankAccount } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const partner = await db.deliveryPartner.create({
      data: {
        businessId,
        name,
        phone,
        email,
        avatar,
        vehicleType,
        vehicleNumber,
        licenseNumber,
        bankAccount,
      },
    });

    return NextResponse.json({ success: true, data: partner }, { status: 201 });
  } catch (error) {
    console.error('Create delivery partner error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create delivery partner' },
      { status: 500 }
    );
  }
}
