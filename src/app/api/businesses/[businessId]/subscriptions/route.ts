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
    const customerId = searchParams.get('customerId');

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const subscriptions = await db.customerSubscription.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        plan: { select: { id: true, name: true, serviceType: true, billingCycle: true, price: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: subscriptions });
  } catch (error) {
    console.error('Get subscriptions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
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
    const { customerId, planId, paymentMethodId, autoRenew } = body;

    if (!customerId || !planId) {
      return NextResponse.json(
        { success: false, error: 'customerId and planId are required' },
        { status: 400 }
      );
    }

    const plan = await db.subscriptionPlan.findFirst({ where: { id: planId, businessId } });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    let periodEnd = new Date(now);
    switch (plan.billingCycle) {
      case 'WEEKLY': periodEnd.setDate(periodEnd.getDate() + 7); break;
      case 'MONTHLY': periodEnd.setMonth(periodEnd.getMonth() + 1); break;
      case 'QUARTERLY': periodEnd.setMonth(periodEnd.getMonth() + 3); break;
      case 'HALF_YEARLY': periodEnd.setMonth(periodEnd.getMonth() + 6); break;
      case 'YEARLY': periodEnd.setFullYear(periodEnd.getFullYear() + 1); break;
    }

    const subscription = await db.customerSubscription.create({
      data: {
        businessId,
        customerId,
        planId,
        status: plan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        totalCredits: plan.totalCredits,
        usedCredits: 0,
        remainingCredits: plan.totalCredits,
        autoRenew: autoRenew ?? true,
        paymentMethodId,
      },
    });

    // Update plan subscriber count
    await db.subscriptionPlan.update({
      where: { id: planId },
      data: { currentSubscribers: { increment: 1 } },
    });

    return NextResponse.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
