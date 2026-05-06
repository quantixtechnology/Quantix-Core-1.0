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
  return withBusinessAccess(request, businessId, async () => {
    try {
      const { page, limit, skip } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const storeId = searchParams.get('storeId');

      const where: Record<string, unknown> = { businessId };
      if (status) where.status = status;
      if (storeId) where.storeId = storeId;

      const [sessions, total] = await Promise.all([
        db.pOSSession.findMany({
          where,
          skip,
          take: limit,
          orderBy: { openedAt: 'desc' },
          include: {
            store: { select: { id: true, name: true, code: true } },
            _count: { select: { orders: true } },
          },
        }),
        db.pOSSession.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(sessions, total, page, limit),
      });
    } catch (error) {
      console.error('List POS sessions error:', error);
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
      const body = await request.json();
      const { storeId, openingBalance } = body;

      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Store ID is required' }, { status: 400 });
      }

      // Check for existing open session in this store
      const existingSession = await db.pOSSession.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (existingSession) {
        return NextResponse.json({ success: false, error: 'An open session already exists for this store' }, { status: 409 });
      }

      // Get the business user for this user
      const businessUser = await db.businessUser.findFirst({
        where: { userId: user.id, businessId, isActive: true },
      });

      // Generate session number
      const sessionCount = await db.pOSSession.count({ where: { businessId } });
      const sessionNumber = `POS-${new Date().getFullYear()}-${String(sessionCount + 1).padStart(4, '0')}`;

      const session = await db.pOSSession.create({
        data: {
          businessId,
          storeId,
          operatorId: businessUser?.id || user.id,
          sessionNumber,
          status: 'OPEN',
          openingBalance: openingBalance || 0,
        },
        include: {
          store: { select: { name: true, code: true } },
        },
      });

      return NextResponse.json(
        { success: true, data: session, message: 'POS session opened' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Open POS session error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
