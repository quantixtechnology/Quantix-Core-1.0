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
      const method = searchParams.get('method');
      const status = searchParams.get('status');
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');

      const where: Record<string, unknown> = { businessId };
      if (method) where.method = method;
      if (status) where.status = status;
      if (fromDate || toDate) {
        where.createdAt = {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(toDate) } : {}),
        };
      }
      if (search) {
        where.OR = [
          { transactionId: { contains: search } },
          { receiptNumber: { contains: search } },
          { order: { orderNumber: { contains: search } } },
        ];
      }

      const [payments, total] = await Promise.all([
        db.payment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerName: true,
                orderType: true,
              },
            },
          },
        }),
        db.payment.count({ where }),
      ]);

      // Payment summary
      const summary = await db.payment.groupBy({
        by: ['method'],
        where: { businessId, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...paginatedResponse(payments, total, page, limit),
          summary: summary.map(s => ({
            method: s.method,
            totalAmount: s._sum.amount || 0,
            count: s._count.id,
          })),
        },
      });
    } catch (error) {
      console.error('List payments error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
