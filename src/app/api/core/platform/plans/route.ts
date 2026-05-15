// ============================================================================
// Route: GET /api/core/platform/plans
// List all active platform subscription plans (platform admin only)
// ============================================================================

import { db } from '@/lib/db';
import { withPlatformAccess, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return withPlatformAccess(async (_req) => {
    try {
      const plans = await db.platformPlan.findMany({
        where: { isActive: true },
        orderBy: { price: 'asc' },
      });

      const parsedPlans = plans.map((plan) => ({
        ...plan,
        features: JSON.parse(plan.features),
      }));

      return createSuccessResponse(parsedPlans);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch platform plans';
      return createErrorResponse(message, 500);
    }
  })(request);
}
