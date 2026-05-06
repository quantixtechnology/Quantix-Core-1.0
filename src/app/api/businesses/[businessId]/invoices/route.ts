import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const invoiceType = searchParams.get('invoiceType');

    const where: Record<string, unknown> = { businessId };
    if (invoiceType) where.invoiceType = invoiceType;

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          order: { select: { id: true, orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.invoice.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invoices' },
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

    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const invoiceCount = await db.invoice.count({ where: { businessId } });
    const invoiceNumber = `INV-${String(invoiceCount + 1).padStart(6, '0')}`;

    const invoice = await db.invoice.create({
      data: {
        businessId,
        orderId: body.orderId || null,
        customerId: body.customerId || null,
        subscriptionId: body.subscriptionId || null,
        invoiceNumber,
        invoiceType: body.invoiceType || 'TAX_INVOICE',
        businessName: business.name,
        businessAddress: business.address,
        businessGst: business.gstNumber,
        businessPan: business.panNumber,
        customerName: body.customerName || 'Walk-in Customer',
        customerAddress: body.customerAddress,
        customerGst: body.customerGst,
        customerPan: body.customerPan,
        customerState: body.customerState,
        subtotal: body.subtotal ?? 0,
        totalDiscount: body.totalDiscount ?? 0,
        totalTax: body.totalTax ?? 0,
        cgstTotal: body.cgstTotal ?? 0,
        sgstTotal: body.sgstTotal ?? 0,
        igstTotal: body.igstTotal ?? 0,
        cessTotal: body.cessTotal ?? 0,
        deliveryFee: body.deliveryFee ?? 0,
        packagingFee: body.packagingFee ?? 0,
        roundOff: body.roundOff ?? 0,
        totalAmount: body.totalAmount ?? 0,
        amountInWords: body.amountInWords,
        reverseCharge: body.reverseCharge ?? false,
        placeOfSupply: body.placeOfSupply || business.state,
        terms: body.terms,
        notes: body.notes,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        isGstCompliant: body.isGstCompliant ?? true,
      },
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
