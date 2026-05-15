// ============================================================================
// QUANTIX CORE — Business Subscription API
// GET  /api/core/businesses/[businessId]/subscription  — Get subscription (auth)
// PUT  /api/core/businesses/[businessId]/subscription  — Update subscription (platform admin)
// POST /api/core/businesses/[businessId]/subscription  — Create subscription (platform admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { createPlatformSubscription, overrideSubscriptionPricing } from '@/lib/core/subscription';
import type { PlatformBillingCycle } from '@/lib/core/subscription';

export const GET = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const subscription = await db.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true, billingHistory: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!subscription) return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get subscription';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const PUT = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const body = (await req.json()) as {
      planId?: string;
      billingCycle?: PlatformBillingCycle;
      customPrice?: number;
      overrideReason?: string;
      autoRenew?: boolean;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      nextBillingDate?: string;
    };

    const existing = await db.businessSubscription.findUnique({ where: { businessId } });
    if (!existing) return NextResponse.json({ success: false, error: 'No subscription found for this business' }, { status: 404 });

    const updateData: Record<string, unknown> = {};

    if (body.planId && body.planId !== existing.planId) {
      const plan = await db.platformPlan.findUnique({ where: { id: body.planId } });
      if (!plan) return NextResponse.json({ success: false, error: 'Platform plan not found' }, { status: 404 });
      updateData.planId = body.planId;
      updateData.planPrice = plan.price;
    }

    if (body.billingCycle && body.billingCycle !== existing.billingCycle) {
      updateData.billingCycle = body.billingCycle;

      if (!body.planId) {
        // Swap to the plan with the matching billing cycle
        const targetPlan = await db.platformPlan.findFirst({ where: { billingCycle: body.billingCycle, isActive: true } });
        if (targetPlan) {
          updateData.planId = targetPlan.id;
          updateData.planPrice = targetPlan.price;
        }
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (body.billingCycle === 'YEARLY') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);
      updateData.currentPeriodStart = now;
      updateData.currentPeriodEnd = periodEnd;
      updateData.nextBillingDate = periodEnd;
    }

    if (body.autoRenew !== undefined) updateData.autoRenew = body.autoRenew;
    if (body.currentPeriodStart) updateData.currentPeriodStart = new Date(body.currentPeriodStart);
    if (body.currentPeriodEnd) updateData.currentPeriodEnd = new Date(body.currentPeriodEnd);
    if (body.nextBillingDate) updateData.nextBillingDate = new Date(body.nextBillingDate);

    if (body.customPrice !== undefined) {
      const result = await overrideSubscriptionPricing({
        subscriptionId: existing.id, customPrice: body.customPrice,
        reason: body.overrideReason || 'Price updated via API',
      });
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      const updated = await db.businessSubscription.findUnique({ where: { businessId }, include: { plan: true } });
      return NextResponse.json({ success: true, data: updated, message: 'Subscription pricing updated' });
    }

    if (Object.keys(updateData).length > 0) {
      await db.businessSubscription.update({ where: { businessId }, data: updateData });
    }

    const updated = await db.businessSubscription.findUnique({ where: { businessId }, include: { plan: true } });
    return NextResponse.json({ success: true, data: updated, message: 'Subscription updated successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update subscription';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const body = (await req.json()) as {
      planId: string;
      billingCycle?: PlatformBillingCycle;
      customPrice?: number;
      overrideReason?: string;
    };

    if (!body.planId) return NextResponse.json({ success: false, error: 'Missing required field: planId' }, { status: 400 });

    const result = await createPlatformSubscription({
      businessId,
      planId: body.planId,
      billingCycle: body.billingCycle || 'MONTHLY',
      customPrice: body.customPrice,
      overrideReason: body.overrideReason,
    });

    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

    return NextResponse.json(
      { success: true, data: result.subscription, message: 'Subscription created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create subscription';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
