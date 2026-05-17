// ============================================================================
// Route: GET /api/admin/businesses
// Returns businesses for the admin panel with subscription, domain, deployment info
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'businesses:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const businessTypeParam = searchParams.get('businessType');
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search') || undefined;
    const isOnlineParam = searchParams.get('isOnline');

    const where: Record<string, unknown> = {};

    if (businessTypeParam) {
      where.businessType = { in: businessTypeParam.split(',') };
    }

    if (statusParam) {
      where.status = { in: statusParam.split(',') };
    }

    if (isOnlineParam !== null) {
      where.isOnline = isOnlineParam === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { contactEmail: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [businesses, total] = await Promise.all([
      db.business.findMany({
        where,
        skip,
        take: limit,
        include: {
          businessSubscription: {
            include: {
              plan: { select: { name: true, tier: true } },
            },
          },
          domain: { select: { domain: true, status: true } },
          deployments: {
            select: { id: true, type: true, status: true, version: true, healthStatus: true },
          },
          modules: {
            select: { moduleKey: true, moduleName: true, status: true },
          },
          salesRep: { select: { name: true } },
          stores: {
            where: { isMainStore: true },
            select: { id: true, storeCode: true },
            take: 1,
          },
          _count: {
            select: { stores: true, orders: true, customers: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.business.count({ where }),
    ]);

    // Compute order revenue for each business
    const businessIds = businesses.map((b) => b.id);
    const revenueByBusiness = await db.order.groupBy({
      by: ['businessId'],
      where: { businessId: { in: businessIds }, paymentStatus: 'COMPLETED' },
      _sum: { totalAmount: true },
    });

    const revenueMap = new Map<string, number>();
    for (const r of revenueByBusiness) {
      revenueMap.set(r.businessId, r._sum.totalAmount ?? 0);
    }

    // Serialize for the frontend
    const data = businesses.map((b) => ({
      id: b.id,
      businessCode: b.businessCode,
      name: b.name,
      slug: b.slug,
      businessType: b.businessType,
      status: b.status,
      city: b.city,
      state: b.state,
      pincode: b.pincode,
      address: b.address,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      gstNumber: b.gstNumber,
      logo: b.logo,
      isOnline: b.isOnline,
      primaryColor: b.primaryColor,
      createdAt: b.createdAt,
      onboardedAt: b.onboardedAt,
      activatedAt: b.activatedAt,
      // Subscription info
      subscription: b.businessSubscription
        ? {
            id: b.businessSubscription.id,
            status: b.businessSubscription.status,
            // New billing fields
            subscriptionAmount: b.businessSubscription.subscriptionAmount,
            discountAmount: b.businessSubscription.discountAmount,
            finalAmount: b.businessSubscription.finalAmount,
            implementationAmount: b.businessSubscription.implementationAmount,
            iosAppAmount: b.businessSubscription.iosAppAmount,
            iosDiscountAmount: b.businessSubscription.iosDiscountAmount,
            iosFinalAmount: b.businessSubscription.iosFinalAmount,
            iosSubscriptionCycle: b.businessSubscription.iosSubscriptionCycle,
            addOns: b.businessSubscription.addOns,
            // Legacy
            planPrice: b.businessSubscription.planPrice,
            customPrice: b.businessSubscription.customPrice,
            discountPercentage: b.businessSubscription.discountPercentage,
            manualPriceOverride: b.businessSubscription.manualPriceOverride,
            overrideReason: b.businessSubscription.overrideReason,
            billingCycle: b.businessSubscription.billingCycle,
            billingCycleDay: b.businessSubscription.billingCycleDay,
            currentPeriodStart: b.businessSubscription.currentPeriodStart,
            nextBillingDate: b.businessSubscription.nextBillingDate,
            notes: b.businessSubscription.notes,
            plan: b.businessSubscription.plan
              ? {
                  name: b.businessSubscription.plan.name,
                  tier: b.businessSubscription.plan.tier,
                }
              : null,
          }
        : null,
      // Domain info
      domain: b.domain
        ? { domain: b.domain.domain, status: b.domain.status }
        : null,
      // Deployments
      deployments: b.deployments,
      // Modules
      modules: b.modules,
      // Sales rep
      salesRep: b.salesRep?.name || null,
      // Main store
      mainStore: b.stores[0]
        ? { id: b.stores[0].id, storeCode: b.stores[0].storeCode }
        : null,
      // Counts
      storeCount: b._count.stores,
      orderCount: b._count.orders,
      customerCount: b._count.customers,
      // Revenue
      totalRevenue: revenueMap.get(b.id) || 0,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('[admin/businesses] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch businesses: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
});
