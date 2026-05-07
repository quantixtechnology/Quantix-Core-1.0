// ============================================================================
// Route: GET /api/core/platform/plans
// List all active platform subscription plans
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const plans = await db.platformPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });

    // Parse JSON features field
    const parsedPlans = plans.map((plan) => ({
      ...plan,
      features: JSON.parse(plan.features),
    }));

    return NextResponse.json({
      success: true,
      data: parsedPlans,
    });
  } catch (error) {
    console.error('[plans] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch platform plans' },
      { status: 500 }
    );
  }
}
