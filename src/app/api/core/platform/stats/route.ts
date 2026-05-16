// ============================================================================
// Route: GET /api/core/platform/stats
// Returns platform dashboard statistics (platform admin only)
// ============================================================================

import { db } from '@/lib/db';
import { withPlatformAccess, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (_req) => {
    try {
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
        db.business.count(),
        db.business.count({ where: { status: 'ACTIVE' } }),
        db.customer.count(),
        db.order.count(),
        db.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'COMPLETED' } }),
        db.lead.count(),
        db.lead.count({ where: { stage: { notIn: ['NOT_INTERESTED', 'WRONG_NUMBER', 'RNR', 'LOST', 'DUPLICATE'] } } }),
        db.order.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      ]);

      return createSuccessResponse({
        totalBusinesses,
        activeBusinesses,
        totalCustomers,
        totalOrders,
        totalRevenue: totalRevenueResult._sum.totalAmount ?? 0,
        totalLeads,
        activeLeads,
        recentOrders,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch stats';
      return createErrorResponse(message, 500);
    }
  })(request);
}
