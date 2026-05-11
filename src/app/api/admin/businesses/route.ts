// ============================================================================
// Route: GET /api/admin/businesses
// Returns businesses for the admin panel with subscription, domain, deployment info
// No auth required — internal admin route
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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
              plan: { select: { name: true, tier: true, billingCycle: true, price: true } },
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
      name: b.name,
      slug: b.slug,
      businessType: b.businessType,
      status: b.status,
      city: b.city,
      state: b.state,
      address: b.address,
      contactEmail: b.contactEmail,
      contactPhone: b.contactPhone,
      gstNumber: b.gstNumber,
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
            planPrice: b.businessSubscription.planPrice,
            customPrice: b.businessSubscription.customPrice,
            discountPercentage: b.businessSubscription.discountPercentage,
            manualPriceOverride: b.businessSubscription.manualPriceOverride,
            overrideReason: b.businessSubscription.overrideReason,
            billingCycle: b.businessSubscription.billingCycle,
            nextBillingDate: b.businessSubscription.nextBillingDate,
            plan: b.businessSubscription.plan
              ? {
                  name: b.businessSubscription.plan.name,
                  tier: b.businessSubscription.plan.tier,
                  billingCycle: b.businessSubscription.plan.billingCycle,
                  price: b.businessSubscription.plan.price,
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
}
