import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const promoCodes = await db.promoCode.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: promoCodes });
  } catch (error) {
    console.error('Get promo codes error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promo codes' },
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
    const {
      code, description, promoType, value, minOrderAmount, maxDiscount,
      usageLimit, perCustomerLimit, applicableCategories, applicableProducts,
      isFirstOrderOnly, isActive, startsAt, endsAt,
    } = body;

    if (!code || !promoType || value === undefined || !startsAt || !endsAt) {
      return NextResponse.json(
        { success: false, error: 'code, promoType, value, startsAt, and endsAt are required' },
        { status: 400 }
      );
    }

    const promoCode = await db.promoCode.create({
      data: {
        businessId,
        code: code.toUpperCase(),
        description,
        promoType,
        value: parseFloat(String(value)),
        minOrderAmount: minOrderAmount ? parseFloat(String(minOrderAmount)) : 0,
        maxDiscount: maxDiscount ? parseFloat(String(maxDiscount)) : null,
        usageLimit,
        perCustomerLimit,
        applicableCategories: applicableCategories ? JSON.stringify(applicableCategories) : '[]',
        applicableProducts: applicableProducts ? JSON.stringify(applicableProducts) : '[]',
        isFirstOrderOnly: isFirstOrderOnly ?? false,
        isActive: isActive ?? true,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      },
    });

    return NextResponse.json({ success: true, data: promoCode }, { status: 201 });
  } catch (error) {
    console.error('Create promo code error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create promo code' },
      { status: 500 }
    );
  }
}
