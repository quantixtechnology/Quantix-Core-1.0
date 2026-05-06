import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; planId: string }> }
) {
  try {
    const { businessId, planId } = await params;

    const plan = await db.subscriptionPlan.findFirst({
      where: { id: planId, businessId },
      include: { planItems: true, _count: { select: { subscriptions: true } } },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get subscription plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; planId: string }> }
) {
  try {
    const { businessId, planId } = await params;
    const body = await request.json();

    const existing = await db.subscriptionPlan.findFirst({ where: { id: planId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Subscription plan not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const stringFields = ['name', 'description', 'serviceType', 'billingCycle', 'creditLabel'];
    for (const field of stringFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const floatFields = ['price', 'originalPrice', 'setupFee'];
    for (const field of floatFields) {
      if (body[field] !== undefined) updateData[field] = parseFloat(String(body[field]));
    }

    const intFields = ['trialDays', 'totalCredits', 'maxSubscribers', 'sortOrder'];
    for (const field of intFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const booleanFields = ['isFeatured', 'isActive'];
    for (const field of booleanFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.features) updateData.features = JSON.stringify(body.features);
    if (body.startsAt) updateData.startsAt = new Date(body.startsAt);
    if (body.endsAt) updateData.endsAt = new Date(body.endsAt);

    const plan = await db.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
      include: { planItems: true },
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Update subscription plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription plan' },
      { status: 500 }
    );
  }
}
