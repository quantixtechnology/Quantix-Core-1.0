// ============================================================================
// Route: GET /api/admin/activity
// Returns recent platform activity for the admin dashboard
// No auth required — internal admin route
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const businessId = searchParams.get('businessId');

    const where: Record<string, unknown> = {};
    if (businessId) {
      where.businessId = businessId;
    }

    const activity = await db.activityLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        business: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: activity.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        details: a.details,
        businessId: a.businessId,
        businessName: a.business?.name || null,
        userName: a.user?.name || null,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('[admin/activity] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch activity: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
