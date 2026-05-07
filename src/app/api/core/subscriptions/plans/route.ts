// ============================================================================
// QUANTIX CORE — Platform Subscription Plans API
// GET  /api/core/subscriptions/plans  — Get the 2 fixed platform plans
//
// BUSINESS MODEL:
//   ONLY 2 plans: ₹4,999/mo (MONTHLY) and ₹49,999/yr (YEARLY)
//   If no plans exist in DB, seed them automatically.
//   NO trial, NO custom plan creation through this endpoint.
//
// Note: This endpoint returns PLATFORM plans (Quantix → Business).
//       For customer-facing subscription plans (Business → Customer),
//       use the business-specific subscription plan endpoints.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/constants';

// ============================================================================
// Seed helper — ensures the 2 platform plans exist
// ============================================================================

async function ensurePlansSeeded() {
  const existingCount = await db.platformPlan.count();

  if (existingCount >= 2) {
    return; // Plans already seeded
  }

  // Seed the 2 fixed plans
  for (const plan of PRICING_PLANS) {
    await db.platformPlan.upsert({
      where: { billingCycle: plan.billingCycle },
      update: {
        name: plan.name,
        price: plan.price,
        description: plan.description,
        features: JSON.stringify(plan.features),
        maxStores: plan.maxStores,
        maxProducts: plan.maxProducts,
        maxOrders: plan.maxOrders,
        maxDeliveryPartners: plan.maxDeliveryPartners,
        maxStaff: plan.maxStaff,
        hasPOS: plan.hasPOS,
        hasDelivery: plan.hasDelivery,
        hasSubscription: plan.hasSubscription,
        hasCustomDomain: plan.hasCustomDomain,
        hasWhiteLabel: plan.hasWhiteLabel,
        hasAdvancedReports: plan.hasAdvancedReports,
        hasAPIAccess: plan.hasAPIAccess,
        isActive: true,
      },
      create: {
        billingCycle: plan.billingCycle,
        name: plan.name,
        price: plan.price,
        description: plan.description,
        features: JSON.stringify(plan.features),
        maxStores: plan.maxStores,
        maxProducts: plan.maxProducts,
        maxOrders: plan.maxOrders,
        maxDeliveryPartners: plan.maxDeliveryPartners,
        maxStaff: plan.maxStaff,
        hasPOS: plan.hasPOS,
        hasDelivery: plan.hasDelivery,
        hasSubscription: plan.hasSubscription,
        hasCustomDomain: plan.hasCustomDomain,
        hasWhiteLabel: plan.hasWhiteLabel,
        hasAdvancedReports: plan.hasAdvancedReports,
        hasAPIAccess: plan.hasAPIAccess,
        isActive: true,
      },
    });
  }
}

// ============================================================================
// GET /api/core/subscriptions/plans
// Returns the 2 fixed platform plans (MONTHLY and YEARLY)
// Also supports ?businessId= for backwards compat with customer plans
// ============================================================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    // If businessId is provided, return customer-facing subscription plans
    // (backwards compatibility with existing behavior)
    if (businessId) {
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

      return NextResponse.json({
        success: true,
        data: plans,
      });
    }

    // ========================================
    // Return PLATFORM plans (the 2 fixed plans)
    // ========================================

    // Ensure plans are seeded
    await ensurePlansSeeded();

    // Fetch the 2 platform plans
    const platformPlans = await db.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Parse features from JSON strings
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
          id: p.id,
          billingCycle: p.billingCycle,
          name: p.name,
          price: p.price,
          priceDisplay: p.billingCycle === 'MONTHLY'
            ? '₹4,999/month'
            : '₹49,999/year',
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list subscription plans';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
