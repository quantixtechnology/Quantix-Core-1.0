import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');
    const tier = searchParams.get('tier');

    const where: Record<string, unknown> = {};
    if (isActive !== null) where.isActive = isActive === 'true';
    if (tier) where.tier = tier;

    const plans = await db.platformPlan.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get plans error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name, tier, monthlyPrice, yearlyPrice, description,
      features, maxStores, maxProducts, maxOrders, maxDeliveryPartners, maxStaff,
      hasPOS, hasDelivery, hasSubscription, hasCustomDomain, hasWhiteLabel,
      hasAdvancedReports, hasAPIAccess, isPublic, sortOrder,
    } = body;

    if (!name || !tier || monthlyPrice === undefined || yearlyPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, tier, monthlyPrice, and yearlyPrice are required' },
        { status: 400 }
      );
    }

    const plan = await db.platformPlan.create({
      data: {
        platformId: 'platform_1',
        name,
        tier,
        monthlyPrice: parseFloat(String(monthlyPrice)),
        yearlyPrice: parseFloat(String(yearlyPrice)),
        description,
        features: features ? JSON.stringify(features) : '[]',
        maxStores: maxStores ?? 1,
        maxProducts: maxProducts ?? 500,
        maxOrders: maxOrders ?? 1000,
        maxDeliveryPartners: maxDeliveryPartners ?? 5,
        maxStaff: maxStaff ?? 10,
        hasPOS: hasPOS ?? true,
        hasDelivery: hasDelivery ?? true,
        hasSubscription: hasSubscription ?? false,
        hasCustomDomain: hasCustomDomain ?? false,
        hasWhiteLabel: hasWhiteLabel ?? false,
        hasAdvancedReports: hasAdvancedReports ?? false,
        hasAPIAccess: hasAPIAccess ?? false,
        isPublic: isPublic ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('Create plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}
