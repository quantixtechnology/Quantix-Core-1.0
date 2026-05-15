// ============================================================================
// QUANTIX CORE — Notifications API
// GET  /api/core/notifications  — List notifications for a user/business (auth required)
// POST /api/core/notifications  — Send notification (CLIENT_OWNER+)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { sendNotification } from '@/lib/core/notification';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId
    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) {
        return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
      }
      businessId = qb;
    } else {
      if (!user.businessId) {
        return NextResponse.json({ success: false, error: 'No business context found for this user' }, { status: 400 });
      }
      businessId = user.businessId;
    }

    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const channel = searchParams.get('channel');
    const isRead = searchParams.get('isRead');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      businessId,
      ...(userId && { userId }),
      ...(type && { type }),
      ...(channel && { channel }),
      ...(isRead !== null && { isRead: isRead === 'true' }),
      ...(dateFrom && dateTo && {
        createdAt: { gte: new Date(dateFrom), lte: new Date(dateTo) },
      }),
    };

    const [notifications, total] = await Promise.all([
      db.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      db.notification.count({ where }),
    ]);

    const unreadCount = await db.notification.count({
      where: { businessId, ...(userId && { userId }), isRead: false },
    });

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      unreadCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list notifications';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json();

    const businessId: string = user.isPlatformAdmin
      ? (body.businessId ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    if (!body.type) return NextResponse.json({ success: false, error: 'type is required' }, { status: 400 });
    if (!body.channel) return NextResponse.json({ success: false, error: 'channel is required' }, { status: 400 });
    if (!body.title) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    if (!body.message) return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });

    const validTypes = ['ORDER_STATUS', 'DELIVERY_UPDATE', 'PROMOTION', 'SUBSCRIPTION', 'PAYMENT', 'SYSTEM'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json({ success: false, error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const validChannels = ['PUSH', 'EMAIL', 'WHATSAPP', 'IN_APP'];
    if (!validChannels.includes(body.channel)) {
      return NextResponse.json({ success: false, error: `channel must be one of: ${validChannels.join(', ')}` }, { status: 400 });
    }

    const result = await sendNotification({
      businessId,
      userId: body.userId,
      type: body.type,
      channel: body.channel,
      title: body.title,
      message: body.message,
      data: body.data,
      sendImmediately: body.sendImmediately || false,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, data: result.notification, message: 'Notification sent successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send notification';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
