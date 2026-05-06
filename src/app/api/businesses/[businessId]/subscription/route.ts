import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const subscription = await db.businessSubscription.findUnique({
      where: { businessId },
      include: {
        plan: true,
        billingHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No subscription found for this business' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
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
    const { planId, billingCycle } = body;

    const existing = await db.businessSubscription.findUnique({ where: { businessId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Business already has a subscription' },
        { status: 409 }
      );
    }

    const plan = await db.platformPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    const subscription = await db.businessSubscription.create({
      data: {
        businessId,
        planId,
        status: 'TRIAL',
        planPrice: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice,
        billingCycle: billingCycle || 'monthly',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        trialStart: now,
        trialEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    // Update business status
    await db.business.update({
      where: { id: businessId },
      data: {
        status: 'TRIAL',
        trialStartsAt: now,
        trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();

    const subscription = await db.businessSubscription.findUnique({ where: { businessId } });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Override pricing
    if (body.customPrice !== undefined) {
      updateData.customPrice = parseFloat(String(body.customPrice));
      updateData.manualPriceOverride = true;
      if (body.overrideReason) updateData.overrideReason = body.overrideReason;
    }

    // Discount
    if (body.discountPercentage !== undefined) {
      updateData.discountPercentage = parseFloat(String(body.discountPercentage));
    }

    // Pause
    if (body.action === 'pause') {
      updateData.status = 'PAUSED';
      updateData.pausedAt = new Date();
      if (body.pauseReason) updateData.pauseReason = body.pauseReason;
      if (body.resumeAt) updateData.resumeAt = new Date(body.resumeAt);
    }

    // Resume
    if (body.action === 'resume') {
      updateData.status = 'ACTIVE';
      updateData.resumeAt = new Date();
    }

    // Extend trial
    if (body.trialExtensionDays) {
      updateData.trialExtensionDays = (subscription.trialExtensionDays || 0) + body.trialExtensionDays;
      if (subscription.trialEnd) {
        const newTrialEnd = new Date(subscription.trialEnd);
        newTrialEnd.setDate(newTrialEnd.getDate() + body.trialExtensionDays);
        updateData.trialEnd = newTrialEnd;
      }
    }

    // Change plan
    if (body.planId) {
      const plan = await db.platformPlan.findUnique({ where: { id: body.planId } });
      if (plan) {
        updateData.planId = plan.id;
        updateData.planPrice = plan.monthlyPrice;
        updateData.manualPriceOverride = false;
        updateData.customPrice = null;
        updateData.overrideReason = null;
      }
    }

    // Change billing cycle
    if (body.billingCycle) {
      updateData.billingCycle = body.billingCycle;
    }

    // Cancel
    if (body.action === 'cancel') {
      updateData.status = 'CANCELLED';
      updateData.cancelledAt = new Date();
      updateData.autoRenew = false;
      if (body.cancelReason) updateData.cancelReason = body.cancelReason;
    }

    // General status change
    if (body.status) {
      updateData.status = body.status;
    }

    if (body.notes !== undefined) updateData.notes = body.notes;

    const updated = await db.businessSubscription.update({
      where: { businessId },
      data: updateData,
      include: { plan: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
