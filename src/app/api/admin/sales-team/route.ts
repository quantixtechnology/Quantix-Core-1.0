// ============================================================================
// Route: GET /api/admin/sales-team
// Returns active sales team members for admin dialogs (reassign, etc.)
// No auth required — internal admin route
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const salesTeam = await db.salesTeamMember.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        region: true,
        target: true,
        achieved: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: salesTeam,
    });
  } catch (error) {
    console.error('[admin/sales-team] Error:', error);
    return NextResponse.json(
      { success: false, error: `Failed to fetch sales team: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
