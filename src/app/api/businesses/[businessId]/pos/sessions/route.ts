import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const storeId = searchParams.get('storeId');

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (storeId) where.storeId = storeId;

    const sessions = await db.pOSSession.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        _count: { select: { orders: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get POS sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch POS sessions' },
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
    const { storeId, operatorId, openingBalance } = body;

    if (!storeId || !operatorId) {
      return NextResponse.json(
        { success: false, error: 'storeId and operatorId are required' },
        { status: 400 }
      );
    }

    // Check for existing open session
    const openSession = await db.pOSSession.findFirst({
      where: { businessId, storeId, status: 'OPEN' },
    });
    if (openSession) {
      return NextResponse.json(
        { success: false, error: 'An open session already exists for this store' },
        { status: 409 }
      );
    }

    const sessionCount = await db.pOSSession.count({ where: { businessId } });
    const sessionNumber = `POS-${String(sessionCount + 1).padStart(6, '0')}`;

    const session = await db.pOSSession.create({
      data: {
        businessId,
        storeId,
        operatorId,
        sessionNumber,
        status: 'OPEN',
        openingBalance: openingBalance ?? 0,
      },
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (error) {
    console.error('Create POS session error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create POS session' },
      { status: 500 }
    );
  }
}
