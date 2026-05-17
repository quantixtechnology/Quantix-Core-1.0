// ============================================================================
// Route: GET /api/admin/subscriptions
// Returns all business subscriptions with business + plan info for the admin panel
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    const billingCycleParam = searchParams.get('billingCycle');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (statusParam) {
      where.status = { in: statusParam.split(',') };
    }

    if (billingCycleParam) {
      where.billingCycle = billingCycleParam === 'MONTHLY' ? 'MONTHLY' : 'YEARLY';
    }

    if (search) {
      where.business = {
        name: { contains: search },
      };
    }

    const subscriptions = await db.businessSubscription.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, slug: true, businessType: true, status: true },
        },
        plan: {
          select: {
            id: true,
            name: true,
            tier: true,
            maxStores: true,
            maxProducts: true,
            maxOrders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also get platform plans for the manage plans dialog
    const platformPlans = await db.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
    });

    // Compute stats
    const active = subscriptions.filter((s) => s.status === 'ACTIVE').length;
    const pastDue = subscriptions.filter((s) => s.status === 'PAST_DUE').length;
    const suspended = subscriptions.filter((s) => s.status === 'SUSPENDED').length;

    let monthlyMRR = 0;
    let yearlyProjected = 0;
    for (const sub of subscriptions.filter((s) => s.status === 'ACTIVE' || s.status === 'PAST_DUE')) {
      const price = sub.finalAmount ?? sub.subscriptionAmount ?? sub.customPrice ?? sub.planPrice ?? 0;
      const isMonthly = sub.billingCycle === 'MONTHLY';
      if (isMonthly) {
        monthlyMRR += price;
        yearlyProjected += price * 12;
      } else {
        monthlyMRR += Math.round(price / 12);
        yearlyProjected += price;
      }
    }

    return NextResponse.json({
      success: true,
      data: subscriptions,
      platformPlans,
      stats: {
        total: subscriptions.length,
        active,
        pastDue,
        suspended,
        monthlyMRR,
        yearlyProjected,
      },
    });
  } catch (error) {
    console.error('[admin/subscriptions] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
});
