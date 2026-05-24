// ============================================================================
// QUANTIX API v1 — Mark single notification read
// PATCH /api/v1/notifications/:notificationId/read
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const PATCH = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const user = req.user!;
    const params = await context?.params;
    const notificationId = params?.notificationId as string;
    if (!notificationId) return NextResponse.json({ success: false, error: 'notificationId required' }, { status: 400 });

    const notification = await db.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    if (!notification.isRead) {
      await db.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, data: { id: notificationId, isRead: true } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to mark notification read';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
