// ============================================================================
// Route: GET /api/admin/stats
// Returns platform dashboard statistics for the admin panel
// No auth required — internal admin route
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses,
      onboardingBusinesses,
      churnedBusinesses,
      totalCustomers,
      totalOrders,
      totalRevenueResult,
      totalLeads,
      activeLeads,
      leadsByStageResult,
      recentOrders,
      totalSubscriptions,
      activeSubscriptions,
      pastDueSubscriptions,
      suspendedSubscriptions,
      subscriptionRevenueResult,
      totalDomains,
      activeDomains,
      pendingDomains,
      totalDeployments,
      liveDeployments,
      pendingDeployments,
      recentActivity,
    ] = await Promise.all([
      db.business.count(),
      db.business.count({ where: { status: 'ACTIVE' } }),
      db.business.count({ where: { status: 'SUSPENDED' } }),
      db.business.count({ where: { status: 'ONBOARDING' } }),
      db.business.count({ where: { status: 'CHURNED' } }),
      db.customer.count(),
      db.order.count(),
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'COMPLETED' },
      }),
      db.lead.count(),
      db.lead.count({ where: { stage: { notIn: ['LOST', 'CHURNED'] } } }),
      db.lead.groupBy({ by: ['stage'], _count: { stage: true } }),
      db.order.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      db.businessSubscription.count(),
      db.businessSubscription.count({ where: { status: 'ACTIVE' } }),
      db.businessSubscription.count({ where: { status: 'PAST_DUE' } }),
      db.businessSubscription.count({ where: { status: 'SUSPENDED' } }),
      db.businessSubscription.findMany({
        where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        select: { planPrice: true, customPrice: true, billingCycle: true },
      }),
      db.domainMapping.count(),
      db.domainMapping.count({ where: { status: 'ACTIVE' } }),
      db.domainMapping.count({ where: { status: { notIn: ['ACTIVE'] } } }),
      db.deployment.count(),
      db.deployment.count({ where: { status: 'LIVE' } }),
      db.deployment.count({ where: { status: { notIn: ['LIVE'] } } }),
      db.activityLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          business: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

    const totalRevenue = totalRevenueResult._sum.totalAmount ?? 0;

    // Calculate MRR and yearly revenue from subscriptions
    let monthlyMRR = 0;
    let yearlyProjected = 0;
    for (const sub of subscriptionRevenueResult) {
      const price = sub.customPrice || sub.planPrice;
      if (sub.billingCycle === 'MONTHLY' || sub.billingCycle === 'monthly') {
        monthlyMRR += price;
        yearlyProjected += price * 12;
      } else {
        monthlyMRR += Math.round(price / 12);
        yearlyProjected += price;
      }
    }

    // Build leads by stage map
    const leadsByStage: Record<string, number> = {};
    for (const item of leadsByStageResult) {
      leadsByStage[item.stage] = item._count.stage;
    }

    return NextResponse.json({
      success: true,
      data: {
        businesses: {
          total: totalBusinesses,
          active: activeBusinesses,
          suspended: suspendedBusinesses,
          onboarding: onboardingBusinesses,
          churned: churnedBusinesses,
        },
        orders: { total: totalOrders, recent: recentOrders },
        revenue: { total: totalRevenue, monthlyMRR, yearlyProjected },
        leads: { total: totalLeads, active: activeLeads, byStage: leadsByStage },
        subscriptions: {
          total: totalSubscriptions,
          active: activeSubscriptions,
          pastDue: pastDueSubscriptions,
          suspended: suspendedSubscriptions,
          expiringSoon: pastDueSubscriptions + suspendedSubscriptions,
        },
        domains: { total: totalDomains, active: activeDomains, pending: pendingDomains },
        deployments: { total: totalDeployments, live: liveDeployments, pending: pendingDeployments },
        customers: { total: totalCustomers },
        recentActivity: recentActivity.map((a) => ({
          id: a.id,
          action: a.action,
          entity: a.entity,
          entityId: a.entityId,
          details: a.details,
          businessName: a.business?.name || null,
          userName: a.user?.name || null,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[admin/stats] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch stats: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
