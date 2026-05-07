// ============================================================================
// QUANTIX CORE — Orders API
// GET  /api/core/orders          — List orders with filtering
// POST /api/core/orders          — Create order
// ============================================================================

import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '@/lib/core/order';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    const result = await listOrders(businessId, {
      status: searchParams.get('status') || undefined,
      orderType: searchParams.get('orderType') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      storeId: searchParams.get('storeId') || undefined,
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }
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

    // Validate each item has required fields
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
      businessId: body.businessId,
      storeId: body.storeId,
      orderType: body.orderType,
      orderSource: body.orderSource || 'online',
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

    return NextResponse.json({
      success: true,
      data: order,
      message: 'Order created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
