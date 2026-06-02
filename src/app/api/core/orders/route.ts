// ============================================================================
// QUANTIX CORE — Orders API
// GET  /api/core/orders — List orders (auth required, store-isolated for STORE_MANAGER)
// POST /api/core/orders — Create order (auth required)
//
// STORE ISOLATION:
//   STORE_MANAGER  → forced WHERE storeId = user.storeId  (backend-enforced, not frontend)
//   CLIENT_OWNER   → all stores for their business
//   QUANTIX_SUPER_ADMIN / PLATFORM_ADMIN → any business via query param
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { createOrder, listOrders } from '@/lib/core/order';
import { emitStoreOrderEvent } from '@/lib/realtime-emitter';
import { db } from '@/lib/db';
import { sendNewOrderEmail } from '@/lib/email-service';

// ============================================================================
// GET — List orders with store isolation
// ============================================================================

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);

    // Resolve businessId — platform admins pass it as a query param;
    // business staff use their auth context (prevents cross-tenant leakage)
    let businessId: string;
    if (user.isPlatformAdmin) {
      const qb = searchParams.get('businessId');
      if (!qb) {
        return NextResponse.json(
          { success: false, error: 'businessId query parameter is required' },
          { status: 400 }
        );
      }
      businessId = qb;
    } else {
      if (!user.businessId) {
        return NextResponse.json(
          { success: false, error: 'No business context found for this user' },
          { status: 400 }
        );
      }
      businessId = user.businessId;
    }

    // Parse comma-separated filter values
    const statusParam = searchParams.get('status');
    const orderTypeParam = searchParams.get('orderType');
    const paymentStatusParam = searchParams.get('paymentStatus');

    // STORE_MANAGER: backend-enforced storeId filter — cannot be overridden by query param
    const requestedStoreId = searchParams.get('storeId') || undefined;
    const enforcedStoreId =
      user.role === 'STORE_MANAGER' && user.storeId
        ? user.storeId
        : requestedStoreId;

    const result = await listOrders(businessId, {
      status: statusParam ? statusParam.split(',') : undefined,
      orderType: orderTypeParam ? orderTypeParam.split(',') : undefined,
      paymentStatus: paymentStatusParam ? paymentStatusParam.split(',') : undefined,
      storeId: enforcedStoreId,
      customerId: searchParams.get('customerId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list orders';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});

// ============================================================================
// POST — Create order (admin/staff; customer orders go via /storefront/orders)
// ============================================================================

export const POST = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json();

    // Validate required fields
    if (!body.storeId) {
      return NextResponse.json(
        { success: false, error: 'storeId is required' },
        { status: 400 }
      );
    }
    if (!body.orderType) {
      return NextResponse.json(
        { success: false, error: 'orderType is required' },
        { status: 400 }
      );
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one order item is required' },
        { status: 400 }
      );
    }

    // Resolve businessId
    const businessId: string = user.isPlatformAdmin
      ? body.businessId
      : (user.businessId ?? body.businessId);

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    // STORE_MANAGER may only create orders for their assigned store
    if (user.role === 'STORE_MANAGER' && user.storeId && body.storeId !== user.storeId) {
      return NextResponse.json(
        { success: false, error: 'You can only create orders for your assigned store' },
        { status: 403 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.itemType || !item.itemId || !item.itemName) {
        return NextResponse.json(
          { success: false, error: 'Each item must have itemType, itemId, and itemName' },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item: ${item.itemName}` },
          { status: 400 }
        );
      }
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid unitPrice for item: ${item.itemName}` },
          { status: 400 }
        );
      }
    }

    const order = await createOrder({
      businessId,
      storeId: body.storeId,
      orderType: body.orderType,
      orderSource: body.orderSource || 'admin',
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryAddressId: body.deliveryAddressId,
      deliveryAddress: body.deliveryAddress,
      deliveryLat: body.deliveryLat,
      deliveryLng: body.deliveryLng,
      deliveryInstructions: body.deliveryInstructions,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      pickupAddress: body.pickupAddress,
      pickupScheduledAt: body.pickupScheduledAt ? new Date(body.pickupScheduledAt) : undefined,
      paymentMethod: body.paymentMethod,
      deliveryFee: body.deliveryFee,
      packagingFee: body.packagingFee,
      convenienceFee: body.convenienceFee,
      tip: body.tip,
      posSessionId: body.posSessionId,
      posOperatorId: body.posOperatorId,
      tableNumber: body.tableNumber,
      subscriptionId: body.subscriptionId,
      promoCodeId: body.promoCodeId,
      notes: body.notes,
      metadata: body.metadata,
      items: body.items.map((item: Record<string, unknown>) => ({
        itemType: item.itemType as string,
        itemId: item.itemId as string,
        itemName: item.itemName as string,
        variantName: item.variantName as string | undefined,
        sku: item.sku as string | undefined,
        barcode: item.barcode as string | undefined,
        quantity: item.quantity as number,
        unitPrice: item.unitPrice as number,
        mrp: item.mrp as number | undefined,
        discountPrice: item.discountPrice as number | undefined,
        discountPercent: item.discountPercent as number | undefined,
        gstRate: (item.gstRate as number) || 0,
        isVeg: item.isVeg as boolean | undefined,
        unit: item.unit as string | undefined,
        specialInstructions: item.specialInstructions as string | undefined,
        customizations: item.customizations as string | undefined,
        metadata: item.metadata as string | undefined,
      })),
    });

    // Emit real-time event — scoped to business and store
    const typedOrder = order as Record<string, unknown>;
    const orderItems = (typedOrder.items as Array<Record<string, unknown>>) || [];
    try {
      await emitStoreOrderEvent(businessId, body.storeId, 'order:created', {
        orderId: order.id,
        orderNumber: typedOrder.orderNumber,
        orderType: body.orderType,
        orderSource: body.orderSource || 'admin',
        totalAmount: typedOrder.totalAmount,
        subtotal: typedOrder.subtotal,
        totalTax: typedOrder.totalTax,
        totalDiscount: typedOrder.totalDiscount,
        deliveryFee: typedOrder.deliveryFee,
        customerName: typedOrder.customerName,
        customerPhone: typedOrder.customerPhone,
        deliveryAddress: typedOrder.deliveryAddress,
        storeId: body.storeId,
        items: orderItems.map((i) => ({
          name: i.itemName,
          variant: i.variantName || null,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
          isVeg: i.isVeg ?? null,
        })),
        status: typedOrder.status,
      });
    } catch (emitErr) {
      console.error('[Orders API] Failed to emit order:created event:', emitErr);
    }

    // Send email to business owner for online/storefront orders only (not admin/POS manual entries)
    if (body.orderSource !== 'admin' && body.orderType !== 'POS') {
      try {
        const business = await db.business.findUnique({
          where: { id: businessId },
          select: { name: true, contactEmail: true },
        });
        if (business?.contactEmail) {
          const domain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'app.quantixtechnology.in';
          sendNewOrderEmail({
            to: business.contactEmail,
            businessName: business.name,
            orderNumber: String(typedOrder.orderNumber),
            orderType: body.orderType,
            customerName: String(typedOrder.customerName || ''),
            customerPhone: (typedOrder.customerPhone as string) || null,
            customerEmail: (typedOrder.customerEmail as string) || null,
            items: orderItems.map((i) => ({
              name: String(i.itemName),
              variant: (i.variantName as string) || null,
              quantity: Number(i.quantity),
              unitPrice: Number(i.unitPrice),
              totalPrice: Number(i.totalPrice),
              isVeg: (i.isVeg as boolean) ?? null,
            })),
            subtotal: Number(typedOrder.subtotal) || 0,
            totalTax: Number(typedOrder.totalTax) || 0,
            totalDiscount: Number(typedOrder.totalDiscount) || 0,
            deliveryFee: Number(typedOrder.deliveryFee) || 0,
            totalAmount: Number(typedOrder.totalAmount) || 0,
            paymentMethod: (typedOrder.paymentMethod as string) || null,
            paymentStatus: String(typedOrder.paymentStatus || 'PENDING'),
            deliveryAddress: (typedOrder.deliveryAddress as string) || null,
            notes: (typedOrder.notes as string) || null,
            dashboardUrl: `https://${domain}/business/${businessId}?page=orders`,
            createdAt: new Date(),
          }).catch((e) => console.error('[Orders API] Owner email error:', e));
        }
      } catch (emailErr) {
        console.error('[Orders API] Owner email lookup error:', emailErr);
      }
    }

    return NextResponse.json(
      { success: true, data: order, message: 'Order created successfully' },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
});
