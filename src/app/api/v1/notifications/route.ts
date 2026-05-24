// ============================================================================
// QUANTIX API v1 — Customer Notifications
// GET /api/v1/notifications?page=1&limit=20&unreadOnly=true
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import type { NotificationType } from '@prisma/client';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
    const skip   = (page - 1) * limit;
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const typeParam = searchParams.get('type') ?? undefined;

    const where = {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(typeParam ? { type: typeParam as NotificationType } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, type: true, channel: true, title: true,
          message: true, data: true, isRead: true, readAt: true,
          sentAt: true, createdAt: true,
        },
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications.map((n) => ({
        ...n,
        data: (() => { try { return JSON.parse(n.data); } catch { return {}; } })(),
      })),
      meta: {
        page, limit, total, unreadCount,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch notifications';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
});
