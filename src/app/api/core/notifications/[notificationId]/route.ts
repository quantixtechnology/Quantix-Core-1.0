// ============================================================================
// QUANTIX CORE — Notification Detail API
// PUT /api/core/notifications/[notificationId] — Mark as read
// ============================================================================

import { NextResponse } from 'next/server';
import { markAsRead } from '@/lib/core/notification';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params;

    const result = await markAsRead(notificationId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to mark notification as read';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
