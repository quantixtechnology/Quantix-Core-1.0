import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const updated = await db.business.update({
      where: { id: businessId },
      data: { isOnline: !business.isOnline },
    });

    await db.activityLog.create({
      data: {
        businessId,
        action: updated.isOnline ? 'BUSINESS_ONLINE' : 'BUSINESS_OFFLINE',
        entity: 'Business',
        entityId: businessId,
        details: JSON.stringify({ isOnline: updated.isOnline }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { isOnline: updated.isOnline },
    });
  } catch (error) {
    console.error('Toggle online error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to toggle online status' },
      { status: 500 }
    );
  }
}
