import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const {
      storeId, operatorId, posSessionId, tableNumber,
      customerId, customerName, customerPhone, customerEmail,
      items, paymentMethod, subtotal, totalDiscount, totalTax,
      deliveryFee, packagingFee, convenienceFee, cgstAmount, sgstAmount,
      igstAmount, cessAmount, roundOff, totalAmount, notes,
    } = body;

    if (!storeId || !items || !items.length) {
      return NextResponse.json(
        { success: false, error: 'storeId and items are required' },
        { status: 400 }
      );
    }

    // Generate order number
    const orderCount = await db.order.count({ where: { businessId } });
    const orderNumber = `POS-${String(orderCount + 1).padStart(6, '0')}`;

    const order = await db.order.create({
      data: {
        businessId,
        storeId,
        orderNumber,
        orderType: 'POS',
        status: 'CONFIRMED',
        paymentStatus: paymentMethod ? 'COMPLETED' : 'PENDING',
        paymentMethod: paymentMethod || 'CASH',
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        subtotal: subtotal ?? 0,
        totalDiscount: totalDiscount ?? 0,
        totalTax: totalTax ?? 0,
        deliveryFee: 0,
        packagingFee: packagingFee ?? 0,
        convenienceFee: convenienceFee ?? 0,
        cgstAmount: cgstAmount ?? 0,
        sgstAmount: sgstAmount ?? 0,
        igstAmount: igstAmount ?? 0,
        cessAmount: cessAmount ?? 0,
        roundOff: roundOff ?? 0,
        totalAmount: totalAmount ?? 0,
        posSessionId,
        posOperatorId: operatorId,
        tableNumber,
        notes,
        confirmedAt: new Date(),
      },
    });

    // Create order items
    for (const item of items) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          quantity: parseFloat(String(item.quantity)),
          unitPrice: parseFloat(String(item.unitPrice)),
          mrp: item.mrp ? parseFloat(String(item.mrp)) : null,
          discountPrice: item.discountPrice ? parseFloat(String(item.discountPrice)) : null,
          totalPrice: parseFloat(String(item.totalPrice)),
          gstRate: item.gstRate ?? 0,
          gstAmount: item.gstAmount ?? 0,
          cgstAmount: item.cgstAmount ?? 0,
          sgstAmount: item.sgstAmount ?? 0,
          igstAmount: item.igstAmount ?? 0,
        },
      });
    }

    // Create status history
    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'CONFIRMED',
        note: 'POS bill created',
        changedBy: operatorId,
      },
    });

    // Update POS session totals
    if (posSessionId) {
      const updateSession: Record<string, unknown> = {
        totalSales: { increment: totalAmount ?? 0 },
        totalOrders: { increment: 1 },
      };
      switch (paymentMethod) {
        case 'CASH': updateSession.totalCash = { increment: totalAmount ?? 0 }; break;
        case 'CARD': updateSession.totalCard = { increment: totalAmount ?? 0 }; break;
        case 'UPI': updateSession.totalUpi = { increment: totalAmount ?? 0 }; break;
      }
      await db.pOSSession.update({
        where: { id: posSessionId },
        data: updateSession,
      });
    }

    const result = await db.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Create POS bill error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create POS bill' },
      { status: 500 }
    );
  }
}
