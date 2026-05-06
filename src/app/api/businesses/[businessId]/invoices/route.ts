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
      const invoiceType = searchParams.get('invoiceType');
      const customerId = searchParams.get('customerId');

      const where: Record<string, unknown> = { businessId };
      if (invoiceType) where.invoiceType = invoiceType;
      if (customerId) where.customerId = customerId;
      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search } },
          { customerName: { contains: search } },
        ];
      }

      const [invoices, total] = await Promise.all([
        db.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            order: { select: { id: true, orderNumber: true } },
          },
        }),
        db.invoice.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(invoices, total, page, limit),
      });
    } catch (error) {
      console.error('List invoices error:', error);
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
  return withBusinessAccess(request, businessId, async () => {
    try {
      const body = await request.json();
      const {
        orderId, customerId, subscriptionId, invoiceType,
        customerName, customerAddress, customerGst, customerPan, customerState,
        subtotal, totalDiscount, totalTax, cgstTotal, sgstTotal, igstTotal, cessTotal,
        deliveryFee, packagingFee, roundOff, totalAmount, amountInWords,
        reverseCharge, placeOfSupply, terms, notes, dueDate,
      } = body;

      // Get business details for invoice
      const business = await db.business.findUnique({ where: { id: businessId } });
      if (!business) {
        return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
      }

      // Generate invoice number
      const invoiceCount = await db.invoice.count({ where: { businessId } });
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(invoiceCount + 1).padStart(4, '0')}`;

      const invoice = await db.invoice.create({
        data: {
          businessId,
          orderId,
          customerId,
          subscriptionId,
          invoiceNumber,
          invoiceType: invoiceType || 'TAX_INVOICE',
          businessName: business.name,
          businessAddress: business.address ? `${business.address}, ${business.city}, ${business.state} - ${business.pincode}` : null,
          businessGst: business.gstNumber,
          businessPan: business.panNumber,
          customerName: customerName || 'Walk-in Customer',
          customerAddress,
          customerGst,
          customerPan,
          customerState,
          subtotal: subtotal || 0,
          totalDiscount: totalDiscount || 0,
          totalTax: totalTax || 0,
          cgstTotal: cgstTotal || 0,
          sgstTotal: sgstTotal || 0,
          igstTotal: igstTotal || 0,
          cessTotal: cessTotal || 0,
          deliveryFee: deliveryFee || 0,
          packagingFee: packagingFee || 0,
          roundOff: roundOff || 0,
          totalAmount: totalAmount || 0,
          amountInWords,
          reverseCharge: reverseCharge || false,
          placeOfSupply,
          terms,
          notes,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      return NextResponse.json(
        { success: true, data: invoice, message: 'Invoice generated' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Generate invoice error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
