import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  const { businessId, invoiceId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const invoice = await db.invoice.findFirst({
        where: { id: invoiceId, businessId },
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true, gstNumber: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              orderType: true,
              items: {
                select: {
                  productName: true,
                  variantName: true,
                  quantity: true,
                  unitPrice: true,
                  totalPrice: true,
                  gstRate: true,
                  gstAmount: true,
                  cgstAmount: true,
                  sgstAmount: true,
                },
              },
            },
          },
          subscription: { select: { id: true, plan: { select: { name: true } } } },
        },
      });

      if (!invoice) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: invoice });
    } catch (error) {
      console.error('Get invoice error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
