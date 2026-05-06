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
      const status = searchParams.get('status');
      const orderType = searchParams.get('orderType');
      const storeId = searchParams.get('storeId');
      const customerId = searchParams.get('customerId');
      const paymentStatus = searchParams.get('paymentStatus');
      const fromDate = searchParams.get('fromDate');
      const toDate = searchParams.get('toDate');

      const where: Record<string, unknown> = { businessId };
      if (status) where.status = status;
      if (orderType) where.orderType = orderType;
      if (storeId) where.storeId = storeId;
      if (customerId) where.customerId = customerId;
      if (paymentStatus) where.paymentStatus = paymentStatus;
      if (fromDate || toDate) {
        where.createdAt = {
          ...(fromDate ? { gte: new Date(fromDate) } : {}),
          ...(toDate ? { lte: new Date(toDate) } : {}),
        };
      }
      if (search) {
        where.OR = [
          { orderNumber: { contains: search } },
          { customerName: { contains: search } },
          { customerPhone: { contains: search } },
        ];
      }

      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { id: true, name: true, phone: true, avatar: true } },
            store: { select: { id: true, name: true } },
            items: { take: 5 },
            delivery: { select: { id: true, status: true, deliveryPartner: { select: { name: true, phone: true } } } },
            _count: { select: { items: true } },
          },
        }),
        db.order.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: paginatedResponse(orders, total, page, limit),
      });
    } catch (error) {
      console.error('List orders error:', error);
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
      const {
        storeId, orderType, customerId, customerName, customerPhone, customerEmail,
        deliveryAddressId, deliveryAddress, deliveryLat, deliveryLng, deliveryInstructions,
        scheduledAt, items, subtotal, totalDiscount, totalTax, deliveryFee,
        packagingFee, convenienceFee, tip, totalAmount,
        cgstAmount, sgstAmount, igstAmount, cessAmount,
        paymentMethod, promoCodeId, notes, posSessionId, posOperatorId, tableNumber,
      } = body;

      if (!storeId || !items || items.length === 0) {
        return NextResponse.json({ success: false, error: 'Store ID and items are required' }, { status: 400 });
      }

      // Generate order number
      const orderCount = await db.order.count({ where: { businessId } });
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      const order = await db.order.create({
        data: {
          businessId,
          storeId,
          orderNumber,
          orderType: orderType || 'DELIVERY',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod,
          customerId,
          customerName,
          customerPhone,
          customerEmail,
          deliveryAddressId,
          deliveryAddress: deliveryAddress ? JSON.stringify(deliveryAddress) : null,
          deliveryLat,
          deliveryLng,
          deliveryInstructions,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          subtotal: subtotal || 0,
          totalDiscount: totalDiscount || 0,
          totalTax: totalTax || 0,
          deliveryFee: deliveryFee || 0,
          packagingFee: packagingFee || 0,
          convenienceFee: convenienceFee || 0,
          tip: tip || 0,
          totalAmount: totalAmount || 0,
          cgstAmount: cgstAmount || 0,
          sgstAmount: sgstAmount || 0,
          igstAmount: igstAmount || 0,
          cessAmount: cessAmount || 0,
          promoCodeId,
          notes,
          posSessionId,
          posOperatorId,
          tableNumber,
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
              discountPrice: item.discountPrice as number | null,
              discountPercent: item.discountPercent as number | null,
              totalPrice: item.totalPrice as number,
              totalMrp: item.totalMrp as number | null,
              gstRate: (item.gstRate as number) || 0,
              gstAmount: (item.gstAmount as number) || 0,
              cgstAmount: (item.cgstAmount as number) || 0,
              sgstAmount: (item.sgstAmount as number) || 0,
              igstAmount: (item.igstAmount as number) || 0,
              specialInstructions: item.specialInstructions as string | null,
              customizations: item.customizations ? JSON.stringify(item.customizations) : null,
              isVeg: item.isVeg as boolean | null,
            })),
          },
          statusHistory: {
            create: {
              status: 'PENDING',
              note: 'Order placed',
              changedBy: user.id,
            },
          },
        },
        include: {
          items: true,
          statusHistory: true,
        },
      });

      // Log activity
      await db.activityLog.create({
        data: {
          businessId,
          userId: user.id,
          action: 'order.created',
          entity: 'Order',
          entityId: order.id,
          details: JSON.stringify({ orderNumber, totalAmount }),
        },
      });

      return NextResponse.json(
        { success: true, data: order, message: 'Order created successfully' },
        { status: 201 }
      );
    } catch (error) {
      console.error('Create order error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
