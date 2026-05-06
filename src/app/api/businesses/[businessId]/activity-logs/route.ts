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
      const { page, limit, skip, search } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      const entity = searchParams.get('entity');
      const userId = searchParams.get('userId');
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');

      const where: Record<string, unknown> = { businessId };
      if (action) where.action = { contains: action };
      if (entity) where.entity = entity;
      if (userId) where.userId = userId;
      if (fromDate || toDate) {
        where.createdAt = {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(toDate) } : {}),
        };
      }
      if (search) {
        where.OR = [
          { action: { contains: search } },
          { entity: { contains: search } },
          { details: { contains: search } },
        ];
      }

      const [logs, total] = await Promise.all([
        db.activityLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        }),
        db.activityLog.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(logs, total, page, limit),
      });
    } catch (error) {
      console.error('List activity logs error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
