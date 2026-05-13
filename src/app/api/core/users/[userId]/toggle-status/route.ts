// ============================================================================
// QUANTIX CORE — Activate / Suspend User
// POST /api/core/users/[userId]/toggle-status
//
// Body: { active: boolean, reason?: string }
// Admin-only. Suspending a user blocks all their logins immediately.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    const body = await request.json() as { active: boolean; reason?: string };

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '"active" (boolean) is required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    await db.user.update({
      where: { id: userId },
      data: { isActive: body.active },
    });

    await db.activityLog.create({
      data: {
        businessId: 'platform',
        action: body.active ? 'user.activated' : 'user.suspended',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({
          email: user.email,
          reason: body.reason || null,
        }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      data: { id: userId, isActive: body.active },
      message: body.active ? 'User activated' : 'User suspended',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle user status';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
