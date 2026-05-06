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
    const status = searchParams.get('status');
    const orderType = searchParams.get('orderType');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { businessId };
    if (status) where.status = status;
    if (orderType) where.orderType = orderType;
    if (paymentStatus) where.paymentStatus = paymentStatus;
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
        include: {
          items: true,
          customer: { select: { id: true, name: true, phone: true } },
          store: { select: { id: true, name: true } },
          delivery: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
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
    const {
      storeId, orderType, customerId, customerName, customerPhone, customerEmail,
      deliveryAddress, deliveryLat, deliveryLng, deliveryInstructions, scheduledAt,
      pickupAddress, pickupScheduledAt,
      items, subtotal, totalDiscount, totalTax, deliveryFee,
      packagingFee, convenienceFee, tip, roundOff, totalAmount,
      cgstAmount, sgstAmount, igstAmount, cessAmount,
      paymentMethod, paymentStatus, notes, promoCodeId,
      subscriptionId, posSessionId, posOperatorId, tableNumber,
    } = body;

    if (!storeId || !orderType) {
      return NextResponse.json(
        { success: false, error: 'storeId and orderType are required' },
        { status: 400 }
      );
    }

    // Generate order number
    const orderCount = await db.order.count({ where: { businessId } });
    const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

    const order = await db.order.create({
      data: {
        businessId,
        storeId,
        orderNumber,
        orderType,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        deliveryAddress,
        deliveryLat: deliveryLat ? parseFloat(String(deliveryLat)) : null,
        deliveryLng: deliveryLng ? parseFloat(String(deliveryLng)) : null,
        deliveryInstructions,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        pickupAddress,
        pickupScheduledAt: pickupScheduledAt ? new Date(pickupScheduledAt) : undefined,
        subtotal: subtotal ?? 0,
        totalDiscount: totalDiscount ?? 0,
        totalTax: totalTax ?? 0,
        deliveryFee: deliveryFee ?? 0,
        packagingFee: packagingFee ?? 0,
        convenienceFee: convenienceFee ?? 0,
        tip: tip ?? 0,
        roundOff: roundOff ?? 0,
        totalAmount: totalAmount ?? 0,
        cgstAmount: cgstAmount ?? 0,
        sgstAmount: sgstAmount ?? 0,
        igstAmount: igstAmount ?? 0,
        cessAmount: cessAmount ?? 0,
        paymentMethod,
        paymentStatus: paymentStatus || 'PENDING',
        notes,
        promoCodeId,
        subscriptionId,
        posSessionId,
        posOperatorId,
        tableNumber,
        deliveryOtp: String(Math.floor(1000 + Math.random() * 9000)),
        pickupOtp: orderType === 'PICKUP_AND_DELIVERY' ? String(Math.floor(1000 + Math.random() * 9000)) : undefined,
      },
    });

    // Create order items
    if (items && Array.isArray(items)) {
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
            discountPercent: item.discountPercent ? parseFloat(String(item.discountPercent)) : null,
            totalPrice: parseFloat(String(item.totalPrice)),
            totalMrp: item.totalMrp ? parseFloat(String(item.totalMrp)) : null,
            gstRate: item.gstRate ?? 0,
            gstAmount: item.gstAmount ?? 0,
            cgstAmount: item.cgstAmount ?? 0,
            sgstAmount: item.sgstAmount ?? 0,
            igstAmount: item.igstAmount ?? 0,
            specialInstructions: item.specialInstructions,
            customizations: item.customizations ? JSON.stringify(item.customizations) : null,
            isVeg: item.isVeg,
          },
        });
      }
    }

    // Create initial status history
    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
        note: 'Order created',
      },
    });

    const result = await db.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
