import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, parsePagination, paginatedResponse, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const { page, limit, skip } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');
      const isRead = searchParams.get('isRead');
      const userId = searchParams.get('userId');

      const where: Record<string, unknown> = { businessId };
      if (type) where.type = type;
      if (isRead !== null && isRead !== undefined) where.isRead = isRead === 'true';
      if (userId) {
        where.OR = [{ userId }, { userId: null }]; // Include broadcasts
      } else {
        where.OR = [{ userId: user.id }, { userId: null }];
      }

      const [notifications, total] = await Promise.all([
        db.notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        db.notification.count({ where }),
      ]);

      // Get unread count
      const unreadCount = await db.notification.count({
        where: { businessId, userId: user.id, isRead: false },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...paginatedResponse(notifications, total, page, limit),
          unreadCount,
        },
      });
    } catch (error) {
      console.error('List notifications error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const bu = user.businessUsers.find(b => b.businessId === businessId);
      if (!bu || (bu.role !== 'SUPER_ADMIN' && bu.role !== 'BUSINESS_OWNER' && bu.role !== 'BUSINESS_ADMIN')) {
        return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
      }

      const body = await request.json();
      const { userId, type, title, message, data, channel } = body;

      if (!title || !message) {
        return NextResponse.json({ success: false, error: 'Title and message are required' }, { status: 400 });
      }

      // If broadcast (no userId), create for all users in business
      if (!userId && body.broadcast) {
        const businessUsers = await db.businessUser.findMany({
          where: { businessId, isActive: true },
          select: { userId: true },
        });

        const notifications = await db.notification.createMany({
          data: businessUsers.map(bu => ({
            businessId,
            userId: bu.userId,
            type: type || 'SYSTEM',
            title,
            message,
            data: data ? JSON.stringify(data) : '{}',
            channel: channel || 'in_app',
            sentAt: new Date(),
          })),
        });

        return NextResponse.json(
          { success: true, data: { sent: notifications.count }, message: `Notification sent to ${notifications.count} users` },
          { status: 201 }
        );
      }

      const notification = await db.notification.create({
        data: {
          businessId,
          userId,
          type: type || 'SYSTEM',
          title,
          message,
          data: data ? JSON.stringify(data) : '{}',
          channel: channel || 'in_app',
          sentAt: new Date(),
        },
      });

      return NextResponse.json(
        { success: true, data: notification, message: 'Notification sent' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Send notification error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
