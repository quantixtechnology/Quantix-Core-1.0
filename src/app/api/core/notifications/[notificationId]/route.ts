// ============================================================================
// QUANTIX CORE — Notification Detail API
// PUT /api/core/notifications/[notificationId] — Mark as read (auth required)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { markAsRead } from '@/lib/core/notification';

export const PUT = withMiddleware({ requireAuth: true })(async (_req, context) => {
  try {
    const params = await context?.params;
    const notificationId = params?.notificationId as string;

    if (!notificationId) {
      return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
    }

    const result = await markAsRead(notificationId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
