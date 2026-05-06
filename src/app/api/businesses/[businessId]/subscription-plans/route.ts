import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const plans = await db.subscriptionPlan.findMany({
      where: { businessId },
      include: { planItems: true, _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get subscription plans error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plans' },
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
      name, slug, description, serviceType, billingCycle, price, originalPrice,
      setupFee, trialDays, totalCredits, creditLabel, features,
      isFeatured, maxSubscribers, isActive, sortOrder, startsAt, endsAt,
      planItems,
    } = body;

    if (!name || !slug || !serviceType || !billingCycle || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'name, slug, serviceType, billingCycle, and price are required' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        businessId,
        name,
        slug,
        description,
        serviceType,
        billingCycle,
        price: parseFloat(String(price)),
        originalPrice: originalPrice ? parseFloat(String(originalPrice)) : null,
        setupFee: setupFee ? parseFloat(String(setupFee)) : 0,
        trialDays: trialDays ?? 0,
        totalCredits: totalCredits ?? 0,
        creditLabel,
        features: features ? JSON.stringify(features) : '[]',
        isFeatured: isFeatured ?? false,
        maxSubscribers,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      },
    });

    // Create plan items if provided
    if (planItems && Array.isArray(planItems)) {
      for (const item of planItems) {
        await db.subscriptionPlanItem.create({
          data: {
            planId: plan.id,
            productId: item.productId,
            serviceName: item.serviceName,
            creditsPerCycle: item.creditsPerCycle ?? 1,
            maxPerUse: item.maxPerUse ?? 1,
            rollover: item.rollover ?? false,
            rolloverMax: item.rolloverMax ?? 0,
          },
        });
      }
    }

    const result = await db.subscriptionPlan.findUnique({
      where: { id: plan.id },
      include: { planItems: true },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Create subscription plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription plan' },
      { status: 500 }
    );
  }
}
