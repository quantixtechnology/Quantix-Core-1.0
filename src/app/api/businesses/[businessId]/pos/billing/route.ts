import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, validateBusinessExists } from '@/lib/api-utils';

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
      const {
        storeId, posSessionId, items, customerId, customerName,
        paymentMethod, subtotal, totalDiscount, totalTax, totalAmount,
        deliveryFee, packagingFee, cgstAmount, sgstAmount, igstAmount,
        notes, tableNumber,
      } = body;

      if (!storeId || !items || items.length === 0) {
        return NextResponse.json({ success: false, error: 'Store ID and items are required' }, { status: 400 });
      }

      // Validate POS session
      if (posSessionId) {
        const posSession = await db.pOSSession.findFirst({
          where: { id: posSessionId, businessId, storeId, status: 'OPEN' },
        });
        if (!posSession) {
          return NextResponse.json({ success: false, error: 'Invalid or closed POS session' }, { status: 400 });
        }
      }

      // Generate order number
      const orderCount = await db.order.count({ where: { businessId } });
      const orderNumber = `POS-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      const businessUser = await db.businessUser.findFirst({
        where: { userId: user.id, businessId, isActive: true },
      });

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
          posSessionId,
          posOperatorId: businessUser?.id || user.id,
          tableNumber,
          subtotal: subtotal || 0,
          totalDiscount: totalDiscount || 0,
          totalTax: totalTax || 0,
          deliveryFee: deliveryFee || 0,
          packagingFee: packagingFee || 0,
          totalAmount: totalAmount || 0,
          cgstAmount: cgstAmount || 0,
          sgstAmount: sgstAmount || 0,
          igstAmount: igstAmount || 0,
          confirmedAt: new Date(),
          notes,
          items: {
            create: items.map((item: Record<string, unknown>) => ({
              productId: item.productId as string,
              variantId: item.variantId as string | null,
              productName: item.productName as string,
              variantName: item.variantName as string | null,
              sku: item.sku as string | null,
              quantity: item.quantity as number,
              unitPrice: item.unitPrice as number,
              mrp: item.mrp as number | null,
              totalPrice: item.totalPrice as number,
              gstRate: (item.gstRate as number) || 0,
              gstAmount: (item.gstAmount as number) || 0,
              cgstAmount: (item.cgstAmount as number) || 0,
              sgstAmount: (item.sgstAmount as number) || 0,
            })),
          },
          statusHistory: {
            create: {
              status: 'CONFIRMED',
              note: 'POS order created',
              changedBy: user.id,
            },
          },
        },
        include: { items: true },
      });

      // Create payment record
      if (paymentMethod && totalAmount > 0) {
        await db.payment.create({
          data: {
            orderId: order.id,
            businessId,
            amount: totalAmount,
            method: paymentMethod,
            status: 'COMPLETED',
            receiptNumber: `RCT-${orderNumber}`,
          },
        });
      }

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId: user.id,
          action: 'pos.order_created',
          entity: 'Order',
          entityId: order.id,
          details: JSON.stringify({ orderNumber, totalAmount, paymentMethod }),
        },
      });

      return NextResponse.json(
        { success: true, data: order, message: 'POS order created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create POS bill error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
