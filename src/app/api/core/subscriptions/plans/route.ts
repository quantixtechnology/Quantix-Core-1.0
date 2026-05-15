// ============================================================================
// QUANTIX CORE — Platform Subscription Plans API
// GET  /api/core/subscriptions/plans  — Get the 2 fixed platform plans (auth required)
//
// BUSINESS MODEL:
//   ONLY 2 plans: ₹4,999/mo (MONTHLY) and ₹49,999/yr (YEARLY)
//   If no plans exist in DB, seed them automatically.
//
// Note: This endpoint returns PLATFORM plans (Quantix → Business).
//       For customer-facing subscription plans (Business → Customer),
//       use the business-specific subscription plan endpoints.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/constants';

async function ensurePlansSeeded() {
  const existingCount = await db.platformPlan.count();
  if (existingCount >= 2) return;

  for (const plan of PRICING_PLANS) {
    await db.platformPlan.upsert({
      where: { tier_billingCycle: { tier: 'STANDARD', billingCycle: plan.billingCycle } },
      update: {
        name: plan.name, price: plan.price, description: plan.description,
        features: JSON.stringify(plan.features), maxStores: plan.maxStores,
        maxProducts: plan.maxProducts, maxOrders: plan.maxOrders,
        maxDeliveryPartners: plan.maxDeliveryPartners, maxStaff: plan.maxStaff,
        hasPOS: plan.hasPOS, hasDelivery: plan.hasDelivery,
        hasSubscription: plan.hasSubscription, hasCustomDomain: plan.hasCustomDomain,
        hasWhiteLabel: plan.hasWhiteLabel, hasAdvancedReports: plan.hasAdvancedReports,
        hasAPIAccess: plan.hasAPIAccess, isActive: true,
      },
      create: {
        tier: 'STANDARD', billingCycle: plan.billingCycle, name: plan.name, price: plan.price,
        description: plan.description, features: JSON.stringify(plan.features),
        maxStores: plan.maxStores, maxProducts: plan.maxProducts, maxOrders: plan.maxOrders,
        maxDeliveryPartners: plan.maxDeliveryPartners, maxStaff: plan.maxStaff,
        hasPOS: plan.hasPOS, hasDelivery: plan.hasDelivery,
        hasSubscription: plan.hasSubscription, hasCustomDomain: plan.hasCustomDomain,
        hasWhiteLabel: plan.hasWhiteLabel, hasAdvancedReports: plan.hasAdvancedReports,
        hasAPIAccess: plan.hasAPIAccess, isActive: true,
      },
    });
  }
}

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (businessId) {
      const user = req.user!;
      if (!user.isPlatformAdmin && user.businessId !== businessId) {
        return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
      }

      const serviceType = searchParams.get('serviceType');
      const isActive = searchParams.get('isActive');

      const where: Record<string, unknown> = {
        businessId,
        ...(serviceType && { serviceType }),
        ...(isActive !== null && { isActive: isActive !== 'false' }),
      };

      const plans = await db.subscriptionPlan.findMany({
        where,
        include: { planItems: true },
        orderBy: { sortOrder: 'asc' },
      });

      return NextResponse.json({ success: true, data: plans });
    }

    await ensurePlansSeeded();

    const platformPlans = await db.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    const formattedPlans = platformPlans.map((plan) => ({
      ...plan,
      features: typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features,
    }));

    return NextResponse.json({
      success: true,
      data: formattedPlans,
      meta: {
        totalPlans: formattedPlans.length,
        model: 'MANAGED_PLATFORM',
        noTrial: true,
        superAdminCanOverridePricing: true,
        plans: formattedPlans.map((p) => ({
          id: p.id, billingCycle: p.billingCycle, name: p.name, price: p.price,
          priceDisplay: p.billingCycle === 'MONTHLY' ? '₹4,999/month' : '₹49,999/year',
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list subscription plans';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
