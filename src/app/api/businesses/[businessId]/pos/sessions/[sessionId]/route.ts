import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; sessionId: string }> }
) {
  try {
    const { businessId, sessionId } = await params;

    const session = await db.pOSSession.findFirst({
      where: { id: sessionId, businessId },
      include: {
        store: { select: { id: true, name: true } },
        orders: { take: 50, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'POS session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('Get POS session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch POS session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; sessionId: string }> }
) {
  try {
    const { businessId, sessionId } = await params;
    const body = await request.json();

    const existing = await db.pOSSession.findFirst({ where: { id: sessionId, businessId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'POS session not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.action === 'close') {
      updateData.status = 'CLOSED';
      updateData.closedAt = new Date();
      updateData.closingBalance = body.closingBalance ? parseFloat(String(body.closingBalance)) : existing.openingBalance + existing.totalSales;
      updateData.totalCash = body.totalCash ? parseFloat(String(body.totalCash)) : existing.totalCash;
      updateData.totalCard = body.totalCard ? parseFloat(String(body.totalCard)) : existing.totalCard;
      updateData.totalUpi = body.totalUpi ? parseFloat(String(body.totalUpi)) : existing.totalUpi;
      updateData.totalRefunds = body.totalRefunds ? parseFloat(String(body.totalRefunds)) : existing.totalRefunds;
    }

    if (body.action === 'suspend') {
      updateData.status = 'SUSPENDED';
    }

    if (body.cashDrawer) updateData.cashDrawer = JSON.stringify(body.cashDrawer);
    if (body.printerQueue) updateData.printerQueue = JSON.stringify(body.printerQueue);

    const session = await db.pOSSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('Update POS session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update POS session' },
      { status: 500 }
    );
  }
}
