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

async function ensurePlansSeeded() {
  const existingCount = await db.platformPlan.count();
  if (existingCount >= 2) return;

  const defaultPlans = [
    {
      tier: 'STANDARD' as const,
      name: 'Quantix Standard',
      description: 'Core features for growing businesses',
      features: JSON.stringify(['Ecommerce Workflow', 'POS', 'Delivery', 'Custom Domain', 'White Label', 'Reports', 'API Access']),
      maxStores: 5, maxProducts: 5000, maxOrders: 10000, maxDeliveryPartners: 50, maxStaff: 50,
      hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true,
      hasWhiteLabel: true, hasAdvancedReports: true, hasAPIAccess: true,
      hasEcommerceWorkflow: true, hasPickupWorkflow: false, hasAppointmentWorkflow: false,
      hasSubscriptionWorkflow: false, hasPostServiceWorkflow: false, hasAdvancedWorkflowEngine: false,
      isActive: true,
    },
    {
      tier: 'PRO' as const,
      name: 'Quantix Pro',
      description: 'All workflows for enterprise businesses',
      features: JSON.stringify(['All Standard Features', 'Pickup', 'Appointment', 'Subscription', 'Post-Service', 'Advanced Workflow Engine']),
      maxStores: 50, maxProducts: 50000, maxOrders: 100000, maxDeliveryPartners: 500, maxStaff: 500,
      hasPOS: true, hasDelivery: true, hasSubscription: true, hasCustomDomain: true,
      hasWhiteLabel: true, hasAdvancedReports: true, hasAPIAccess: true,
      hasEcommerceWorkflow: true, hasPickupWorkflow: true, hasAppointmentWorkflow: true,
      hasSubscriptionWorkflow: true, hasPostServiceWorkflow: true, hasAdvancedWorkflowEngine: true,
      isActive: true,
    },
  ];

  for (const p of defaultPlans) {
    await db.platformPlan.upsert({
      where: { tier: p.tier },
      update: p,
      create: p,
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
      orderBy: { tier: 'asc' },
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
          id: p.id, tier: p.tier, name: p.name,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list subscription plans';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
