import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalBusinesses,
      activeBusinesses,
      totalLeads,
      wonLeads,
      platformPlans,
      businesses,
    ] = await Promise.all([
      db.business.count(),
      db.business.count({ where: { status: 'ACTIVE' } }),
      db.lead.count(),
      db.lead.count({ where: { status: 'WON' } }),
      db.platformPlan.findMany({ where: { isActive: true } }),
      db.business.findMany({
        where: { status: { in: ['ACTIVE', 'TRIAL'] } },
        include: { businessSubscription: true },
      }),
    ]);

    const totalRevenue = businesses.reduce((sum, b) => {
      if (b.businessSubscription) {
        const price = b.businessSubscription.manualPriceOverride
          ? (b.businessSubscription.customPrice ?? b.businessSubscription.planPrice)
          : b.businessSubscription.planPrice;
        return sum + price;
      }
      return sum;
    }, 0);

    const activeSubscriptions = businesses.filter(
      (b) => b.businessSubscription && b.businessSubscription.status === 'ACTIVE'
    ).length;

    const trialSubscriptions = businesses.filter(
      (b) => b.businessSubscription && b.businessSubscription.status === 'TRIAL'
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        totalBusinesses,
        activeBusinesses,
        totalLeads,
        wonLeads,
        totalRevenue,
        activeSubscriptions,
        trialSubscriptions,
        planDistribution: platformPlans.map((p) => ({
          planId: p.id,
          name: p.name,
          tier: p.tier,
          monthlyPrice: p.monthlyPrice,
        })),
      },
    });
  } catch (error) {
    console.error('Platform stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform stats' },
      { status: 500 }
    );
  }
}
