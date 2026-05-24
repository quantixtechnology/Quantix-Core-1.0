// ============================================================================
// QUANTIX API v1 — Mark all notifications read
// POST /api/v1/notifications/read-all
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const result = await db.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return NextResponse.json({ success: true, data: { updated: result.count } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to mark all notifications read';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
