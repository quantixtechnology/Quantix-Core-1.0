// ============================================================================
// QUANTIX CORE — Business Subscription API
// GET  /api/core/businesses/[businessId]/subscription  — Get subscription
// PUT  /api/core/businesses/[businessId]/subscription  — Update subscription
// POST /api/core/businesses/[businessId]/subscription  — Create new subscription
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  createPlatformSubscription,
  overrideSubscriptionPricing,
} from '@/lib/core/subscription';
import type { BusinessSubscriptionRequest, PlatformBillingCycle } from '@/lib/core/subscription';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const subscription = await db.businessSubscription.findUnique({
      where: { businessId },
      include: {
        plan: true,
        billingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No subscription found for this business' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      planId?: string;
      billingCycle?: PlatformBillingCycle;
      customPrice?: number;
      overrideReason?: string;
      autoRenew?: boolean;
    };

    // Find existing subscription
    const existing = await db.businessSubscription.findUnique({
      where: { businessId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'No subscription found for this business' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    // Plan change
    if (body.planId && body.planId !== existing.planId) {
      const plan = await db.platformPlan.findUnique({ where: { id: body.planId } });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: 'Platform plan not found' },
          { status: 404 }
        );
      }
      updateData.planId = body.planId;

      // Recalculate price based on billing cycle
      const cycle = body.billingCycle || (existing.billingCycle as PlatformBillingCycle);
      updateData.planPrice = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    }

    // Billing cycle change
    if (body.billingCycle && body.billingCycle !== existing.billingCycle) {
      updateData.billingCycle = body.billingCycle;

      // Recalculate price if plan didn't change
      if (!body.planId) {
        const plan = await db.platformPlan.findUnique({ where: { id: existing.planId } });
        if (plan) {
          updateData.planPrice = body.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
        }
      }

      // Recalculate period end
      const now = new Date();
      const periodEnd = new Date(now);
      if (body.billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      updateData.currentPeriodStart = now;
      updateData.currentPeriodEnd = periodEnd;
      updateData.nextBillingDate = periodEnd;
    }

    // Auto-renew toggle
    if (body.autoRenew !== undefined) {
      updateData.autoRenew = body.autoRenew;
    }

    // Custom price override
    if (body.customPrice !== undefined) {
      const result = await overrideSubscriptionPricing({
        subscriptionId: existing.id,
        customPrice: body.customPrice,
        reason: body.overrideReason || 'Price updated via API',
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      // Re-fetch to get updated data
      const updated = await db.businessSubscription.findUnique({
        where: { businessId },
        include: { plan: true },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Subscription pricing updated',
      });
    }

    // Apply non-pricing updates
    if (Object.keys(updateData).length > 0) {
      await db.businessSubscription.update({
        where: { businessId },
        data: updateData,
      });
    }

    const updated = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as BusinessSubscriptionRequest;

    if (!body.planId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: planId' },
        { status: 400 }
      );
    }

    const result = await createPlatformSubscription({
      businessId,
      planId: body.planId,
      billingCycle: body.billingCycle || 'monthly',
      customPrice: body.customPrice,
      overrideReason: body.overrideReason,
      trialDays: 14,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.subscription,
        message: 'Subscription created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
