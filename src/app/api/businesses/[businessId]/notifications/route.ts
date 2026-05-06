import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const isRead = searchParams.get('isRead');
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = { businessId };
    if (isRead !== null) where.isRead = isRead === 'true';
    if (type) where.type = type;
    if (userId) where.userId = userId;

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const unreadCount = await db.notification.count({
      where: { businessId, isRead: false },
    });

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { userId, type, title, message, data, channel } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { success: false, error: 'type, title, and message are required' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        businessId,
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : '{}',
        channel: channel || 'in_app',
      },
    });

    return NextResponse.json({ success: true, data: notification }, { status: 201 });
  } catch (error) {
    console.error('Create notification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
