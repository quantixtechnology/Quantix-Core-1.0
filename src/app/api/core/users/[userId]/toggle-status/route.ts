// ============================================================================
// QUANTIX CORE — Activate / Suspend User
// POST /api/core/users/[userId]/toggle-status (platform admin only)
//
// Body: { active: boolean, reason?: string }
// Suspending a user blocks all their logins immediately.
// ============================================================================

import { NextResponse } from 'next/server';
import { withPlatformAccess, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NextRequest } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { userId } = await params;
      const body = await req.json() as { active: boolean; reason?: string };

      if (typeof body.active !== 'boolean') {
        return createErrorResponse('"active" (boolean) is required', 400);
      }

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, isActive: true },
      });
      if (!user) return createErrorResponse('User not found', 404);

      await db.user.update({ where: { id: userId }, data: { isActive: body.active } });

      await db.activityLog.create({
        data: {
          businessId: 'platform',
          action: body.active ? 'user.activated' : 'user.suspended',
          entity: 'User', entityId: userId,
          details: JSON.stringify({ email: user.email, reason: body.reason || null }),
        },
      }).catch(() => null);

      return NextResponse.json({
        success: true,
        data: { id: userId, isActive: body.active },
        message: body.active ? 'User activated' : 'User suspended',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle user status';
      return createErrorResponse(message, 500);
    }
  })(request);
}
