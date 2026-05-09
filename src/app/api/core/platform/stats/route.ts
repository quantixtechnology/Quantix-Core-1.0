// ============================================================================
// Route: GET /api/core/platform/stats
// Returns platform dashboard statistics
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Run all count queries in parallel for performance
    const [
      totalBusinesses,
      activeBusinesses,
      totalCustomers,
      totalOrders,
      totalRevenueResult,
      totalLeads,
      activeLeads,
      recentOrders,
    ] = await Promise.all([
      // Total businesses
      db.business.count(),

      // Active businesses
      db.business.count({
        where: { status: 'ACTIVE' },
      }),

      // Total customers
      db.customer.count(),

      // Total orders
      db.order.count(),

      // Total revenue (sum of totalAmount for completed/paid orders)
      db.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'COMPLETED' },
      }),

      // Total leads
      db.lead.count(),

      // Active leads (not LOST or CHURNED)
      db.lead.count({
        where: {
          stage: {
            notIn: ['LOST', 'CHURNED'],
          },
        },
      }),

      // Recent orders (last 30 days)
      db.order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const totalRevenue = totalRevenueResult._sum.totalAmount ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        totalBusinesses,
        activeBusinesses,
        totalCustomers,
        totalOrders,
        totalRevenue,
        totalLeads,
        activeLeads,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('[platform/stats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
