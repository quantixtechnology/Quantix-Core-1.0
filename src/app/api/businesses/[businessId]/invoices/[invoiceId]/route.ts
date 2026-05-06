import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  try {
    const { businessId, invoiceId } = await params;

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: {
        customer: true,
        order: { include: { items: true } },
        subscription: { include: { plan: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}
