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
    const method = searchParams.get('method');

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (method) where.method = method;

    const payments = await db.payment.findMany({
      where,
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      completed: payments.filter((p) => p.status === 'COMPLETED').length,
      pending: payments.filter((p) => p.status === 'PENDING').length,
      failed: payments.filter((p) => p.status === 'FAILED').length,
    };

    return NextResponse.json({ success: true, data: payments, summary });
  } catch (error) {
    console.error('Get payments error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
