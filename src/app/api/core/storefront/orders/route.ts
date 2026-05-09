// ============================================================================
// QUANTIX CORE — Storefront Orders API
// POST /api/core/storefront/orders — Create order from customer app
//
// Auth required (CUSTOMER role)
// Uses direct Prisma db.order.create() instead of missing createOrder
// Broadcasts order:created via WebSocket
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware, createSuccessResponse, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER'] })(
  async (req) => {
    try {
      const body = await req.json();
      const user = req.user!;

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

      // Resolve delivery address if provided
      let deliveryAddress: string | undefined;
      let deliveryLat: number | undefined;
      let deliveryLng: number | undefined;

      if (body.deliveryAddressId) {
        const address = await db.address.findUnique({
          where: { id: body.deliveryAddressId },
        });
        if (address) {
          deliveryAddress = `${address.addressLine1}${address.addressLine2 ? ', ' + address.addressLine2 : ''}, ${address.city}, ${address.state} - ${address.pincode}`;
          deliveryLat = address.latitude || undefined;
          deliveryLng = address.longitude || undefined;
        }
      }

      // Validate each item
      for (const item of body.items) {
        if (!item.productId || !item.quantity || item.quantity <= 0) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid item: productId and positive quantity required`,
            },
            { status: 400 }
          );
        }
      }

      // Look up customer profile for the user
      const customer = await db.customer.findFirst({
        where: {
          userId: user.id,
          businessId: user.businessId || undefined,
        },
      });

      // Resolve product details for each item
      const resolvedItems = [];
      for (const item of body.items) {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          include: { variants: { where: { isActive: true } } },
        });

        if (!product || product.status !== 'ACTIVE') {
          return NextResponse.json(
            { success: false, error: `Product not found or inactive: ${item.productId}` },
            { status: 400 }
          );
        }

        // Find variant
        let variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          variant = product.variants.find((v) => v.isDefault) || product.variants[0];
        }

        if (!variant) {
          return NextResponse.json(
            { success: false, error: `No available variant for product: ${product.name}` },
            { status: 400 }
          );
        }

        resolvedItems.push({
          itemType: 'product',
          itemId: product.id,
          itemName: product.name,
          variantName: variant.name !== 'Default' ? variant.name : undefined,
          sku: variant.sku || product.sku || undefined,
          barcode: variant.barcode || product.barcode || undefined,
          quantity: item.quantity,
          unitPrice: variant.discountPrice != null && variant.discountPrice < variant.price
            ? variant.discountPrice
            : variant.price,
          mrp: variant.mrp,
          discountPrice: variant.discountPrice != null && variant.discountPrice < variant.price
            ? variant.discountPrice
            : variant.discountPercent != null && variant.discountPercent > 0
              ? variant.price * (1 - variant.discountPercent / 100)
              : undefined,
          discountPercent: variant.discountPercent || undefined,
          gstRate: 0,
          isVeg: product.isVeg || undefined,
          unit: product.unit || undefined,
          specialInstructions: item.specialInstructions || undefined,
          customizations: item.customizations
            ? JSON.stringify(item.customizations)
            : undefined,
        });
      }

      // Determine businessId from user context
      const businessId = user.businessId!;
      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
      }

      // Calculate subtotal from resolved items
      let subtotal = 0;
      let totalTax = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      for (const item of resolvedItems) {
        const lineTotal = item.unitPrice * item.quantity;
        const itemGst = lineTotal * (item.gstRate || 0) / 100;
        subtotal += lineTotal;
        totalTax += itemGst;
        cgstAmount += itemGst / 2;
        sgstAmount += itemGst / 2;
      }
      const deliveryFee = body.deliveryFee || 0;
      const totalAmount = Math.round(subtotal + totalTax + deliveryFee);

      // Generate order number: ORD-YYYYMMDD-NNN
      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const prefix = `ORD-${dateStr}-`;
      const lastOrder = await db.order.findFirst({
        where: { businessId, orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: 'desc' },
        select: { orderNumber: true },
      });
      let seq = 1;
      if (lastOrder) {
        const lastSeq = parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10);
        seq = lastSeq + 1;
      }
      const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;

      // Create order using direct Prisma call
      const order = await db.order.create({
        data: {
          businessId,
          storeId: body.storeId,
          orderNumber,
          orderType: body.orderType,
          orderSource: 'online',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: body.paymentMethod || null,
          customerId: customer?.id || body.customerId || null,
          customerName: customer?.name || user.name,
          customerPhone: customer?.phone || null,
          customerEmail: customer?.email || user.email,
          deliveryAddressId: body.deliveryAddressId || null,
          deliveryAddress: deliveryAddress || null,
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          deliveryInstructions: body.deliveryInstructions || null,
          promoCodeId: body.promoCodeId || null,
          notes: body.notes || null,
          subtotal: Math.round(subtotal * 100) / 100,
          totalTax: Math.round(totalTax * 100) / 100,
          cgstAmount: Math.round(cgstAmount * 100) / 100,
          sgstAmount: Math.round(sgstAmount * 100) / 100,
          deliveryFee,
          totalAmount,
          items: {
            create: resolvedItems.map((item) => {
              const lineTotal = item.unitPrice * item.quantity;
              const itemGst = lineTotal * (item.gstRate || 0) / 100;
              return {
                itemType: item.itemType,
                itemId: item.itemId,
                itemName: item.itemName,
                variantName: item.variantName || null,
                sku: item.sku || null,
                barcode: item.barcode || null,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                mrp: item.mrp || null,
                discountPrice: item.discountPrice || null,
                discountPercent: item.discountPercent || null,
                totalPrice: Math.round(lineTotal * 100) / 100,
                gstRate: item.gstRate || 0,
                gstAmount: Math.round(itemGst * 100) / 100,
                cgstAmount: Math.round((itemGst / 2) * 100) / 100,
                sgstAmount: Math.round((itemGst / 2) * 100) / 100,
                specialInstructions: item.specialInstructions || null,
                customizations: item.customizations || null,
                isVeg: item.isVeg || null,
                unit: item.unit || null,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Create initial status history
      await db.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
          note: 'Order created',
          changedBy: customer?.id || user.id,
        },
      });

      // Send notification to business owner
      try {
        await db.notification.create({
          data: {
            businessId,
            type: 'ORDER_STATUS',
            channel: 'IN_APP',
            title: 'New Order Received! 🎉',
            message: `Order #${order.orderNumber} has been placed.`,
            data: JSON.stringify({
              orderId: order.id,
              orderNumber: order.orderNumber,
            }),
          },
        });
      } catch (notifErr) {
        console.error('[Storefront Orders] Notification error:', notifErr);
      }

      // Broadcast order:created via WebSocket
      try {
        await fetch('/api/emit?XTransformPort=3003', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            event: 'order:created',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              orderType: body.orderType,
              totalAmount: order.totalAmount,
              customerName: customer?.name || user.name,
            },
          }),
        });
      } catch (wsErr) {
        console.error('[Storefront Orders] WebSocket broadcast error:', wsErr);
      }

      return NextResponse.json(
        {
          success: true,
          data: order,
          message: 'Order created successfully',
        },
        { status: 201 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create order';
      return NextResponse.json(
        { success: false, error: message },
        { status: 500 }
      );
    }
  }
);
