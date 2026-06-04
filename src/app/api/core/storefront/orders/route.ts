// ============================================================================
// QUANTIX CORE — Storefront Orders API
// GET  /api/core/storefront/orders — List customer orders
// POST /api/core/storefront/orders — Create order from customer app
//
// Auth required (CUSTOMER role)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { emitStoreOrderEvent } from '@/lib/realtime-emitter';
import { checkStoreOpen } from '@/lib/core/store';
import { sendNewOrderEmail } from '@/lib/email-service';

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF'] })(
  async (req) => {
    try {
      const user = req.user!
      const businessId = user.businessId!

      const customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
      })

      if (!customer) {
        return NextResponse.json({ success: true, data: [] })
      }

      const orders = await db.order.findMany({
        where: { customerId: customer.id, businessId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          items: {
            select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true },
          },
        },
      })

      return NextResponse.json({ success: true, data: orders })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list orders'
      return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
  }
);

interface ResolvedOrderItem {
  itemType: string;
  itemId: string;
  itemName: string;
  variantName: string | undefined;
  sku: string | undefined;
  barcode: string | undefined;
  quantity: number;
  unitPrice: number;
  mrp: number | null;
  discountPrice: number | undefined;
  discountPercent: number | undefined;
  gstRate: number;
  isVeg: boolean | null | undefined;
  unit: string | null | undefined;
  specialInstructions: string | undefined;
  customizations: string | undefined;
}

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CUSTOMER', 'CLIENT_OWNER', 'STORE_MANAGER', 'STORE_OPERATOR', 'BILLING_STAFF', 'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF'] })(
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

      // ── Store availability + hours check ──────────────────────────────────
      const storeCheck = await checkStoreOpen(body.storeId as string);
      if (!storeCheck.isOpen) {
        return NextResponse.json(
          { success: false, error: storeCheck.reason || 'Store is currently closed', opensAt: storeCheck.opensAt ?? null },
          { status: 422 }
        );
      }

      // Resolve delivery address if provided
      let deliveryAddress: string | undefined;
      let deliveryLat: number | undefined;
      let deliveryLng: number | undefined;

      let addressInstructions: string | undefined;
      if (body.deliveryAddressId) {
        const address = await db.address.findUnique({
          where: { id: body.deliveryAddressId },
        });
        if (address) {
          const parts = [
            address.addressLine1,
            address.addressLine2,
            address.area,
            address.landmark ? `Near ${address.landmark}` : null,
            address.city,
            address.state,
            address.pincode,
          ].filter(Boolean);
          deliveryAddress = parts.join(', ');
          deliveryLat = address.latitude || undefined;
          deliveryLng = address.longitude || undefined;
          addressInstructions = address.instructions || undefined;
        }
      }

      // Determine businessId from user context early (needed for customer lookup)
      const businessId = user.businessId!;
      if (!businessId) {
        return NextResponse.json(
          { success: false, error: 'Business context required' },
          { status: 400 }
        );
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

      // Resolve or create the Customer record for this authenticated user.
      // Covers the edge case where OTP login was completed without a businessId context.
      let customer = await db.customer.findFirst({
        where: { userId: user.id, businessId },
      });

      if (!customer) {
        // Look up user's phone from DB to enable shadow customer deduplication
        const userRecord = await db.user.findUnique({ where: { id: user.id }, select: { phone: true } });
        const userPhone = userRecord?.phone || null;
        if (userPhone) {
          const shadow = await db.customer.findFirst({
            where: { businessId, phone: userPhone, userId: null },
          });
          if (shadow) {
            customer = await db.customer.update({
              where: { id: shadow.id },
              data: { userId: user.id, isGuest: false, verified: true, source: 'STORE_FRONT' },
            });
          }
        }
        if (!customer) {
          const isPlaceholder = user.email?.endsWith('@otp.placeholder') ?? false;
          customer = await db.customer.create({
            data: {
              businessId,
              userId: user.id,
              name: user.name,
              phone: userPhone,
              email: isPlaceholder ? null : (user.email || null),
              source: 'STORE_FRONT',
              isGuest: false,
              verified: true,
            },
          });
        }
      }

      // Resolve product details for each item
      const resolvedItems: ResolvedOrderItem[] = [];
      for (const item of body.items) {
        const product = await db.product.findUnique({
          where: { id: item.productId },
          include: { variants: { where: { isActive: true } } },
        });

        if (!product || product.status !== 'ACTIVE' || product.businessId !== businessId) {
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

        // Inventory pre-check: only enforce when a row exists (tracked products).
        // If no inventory row → product is untracked → allow order.
        const inv = await db.inventory.findFirst({
          where: { storeId: body.storeId, productId: product.id },
          select: { quantity: true, reservedQty: true },
        });
        if (inv) {
          const available = Math.max(0, inv.quantity - (inv.reservedQty || 0));
          if (available < item.quantity) {
            return NextResponse.json({
              success: false,
              error: `"${product.name}" is out of stock. Available: ${available}, requested: ${item.quantity}.`,
              code: 'OUT_OF_STOCK',
              productId: product.id,
              availableQty: available,
              requestedQty: item.quantity,
            }, { status: 422 });
          }
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
      let deliveryFee = body.deliveryFee || 0;
      let totalDiscount = 0;
      let resolvedPromoCodeId: string | null = body.promoCodeId || null;

      // ── Minimum order amount enforcement ─────────────────────────────────
      const storeForMinOrder = await db.store.findUnique({
        where: { id: body.storeId as string },
        select: { minOrderAmount: true, freeDeliveryAbove: true },
      });
      if (storeForMinOrder?.minOrderAmount && subtotal < storeForMinOrder.minOrderAmount) {
        return NextResponse.json(
          {
            success: false,
            error: `Minimum order amount is ₹${storeForMinOrder.minOrderAmount}. Your cart is ₹${Math.round(subtotal)}.`,
            minOrderAmount: storeForMinOrder.minOrderAmount,
          },
          { status: 422 }
        );
      }
      // Apply free delivery above threshold
      if (storeForMinOrder?.freeDeliveryAbove && subtotal >= storeForMinOrder.freeDeliveryAbove) {
        deliveryFee = 0;
      }

      // ── Promo code validation + discount calculation ──────────────────────
      if (body.promoCodeId) {
        const promo = await db.promoCode.findFirst({
          where: { id: body.promoCodeId, businessId },
        });

        if (!promo) {
          return NextResponse.json({ success: false, error: 'Promo code not found' }, { status: 400 });
        }
        if (!promo.isActive) {
          return NextResponse.json({ success: false, error: 'Promo code is not active' }, { status: 400 });
        }

        const nowPromo = new Date();
        if (promo.validFrom > nowPromo) {
          return NextResponse.json({ success: false, error: 'Promo code is not yet valid' }, { status: 400 });
        }
        if (promo.validUntil < nowPromo) {
          return NextResponse.json({ success: false, error: 'Promo code has expired' }, { status: 400 });
        }
        if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
          return NextResponse.json({ success: false, error: 'Promo code usage limit reached' }, { status: 400 });
        }
        if (subtotal < promo.minOrderAmount) {
          return NextResponse.json({
            success: false,
            error: `Minimum order amount of ₹${promo.minOrderAmount} required for this promo`,
          }, { status: 400 });
        }

        // Per-user limit check
        if (promo.perUserLimit > 0) {
          const userUsageCount = await db.order.count({
            where: { customerId: customer.id, promoCodeId: promo.id },
          });
          if (userUsageCount >= promo.perUserLimit) {
            return NextResponse.json({ success: false, error: 'You have already used this promo code' }, { status: 400 });
          }
        }

        // Calculate discount
        if (promo.type === 'PERCENTAGE') {
          totalDiscount = (subtotal * promo.value) / 100;
          if (promo.maxDiscount != null) totalDiscount = Math.min(totalDiscount, promo.maxDiscount);
        } else if (promo.type === 'FLAT') {
          totalDiscount = Math.min(promo.value, subtotal);
        } else if (promo.type === 'FREE_DELIVERY') {
          totalDiscount = deliveryFee;
          deliveryFee = 0;
        } else if (promo.type === 'BOGO') {
          // Cheapest item free (half price of cheapest line)
          const cheapestLine = resolvedItems.reduce((min, item) =>
            item.unitPrice < min.unitPrice ? item : min, resolvedItems[0]);
          if (cheapestLine) totalDiscount = cheapestLine.unitPrice;
        }

        totalDiscount = Math.round(totalDiscount * 100) / 100;
        resolvedPromoCodeId = promo.id;
      }
      // ─────────────────────────────────────────────────────────────────────

      const totalAmount = Math.round(Math.max(0, subtotal + totalTax + deliveryFee - totalDiscount));

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
          customerId: customer.id,
          customerName: customer.name || user.name,
          customerPhone: customer.phone || null,
          customerEmail: customer.email || (user.email?.endsWith('@otp.placeholder') ? null : user.email) || null,
          deliveryAddressId: body.deliveryAddressId || null,
          deliveryAddress: deliveryAddress || null,
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          deliveryInstructions: body.deliveryInstructions || addressInstructions || null,
          promoCodeId: resolvedPromoCodeId,
          notes: body.notes || null,
          subtotal: Math.round(subtotal * 100) / 100,
          totalTax: Math.round(totalTax * 100) / 100,
          cgstAmount: Math.round(cgstAmount * 100) / 100,
          sgstAmount: Math.round(sgstAmount * 100) / 100,
          totalDiscount,
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

      // Increment promo usedCount
      if (resolvedPromoCodeId) {
        try {
          await db.promoCode.update({
            where: { id: resolvedPromoCodeId },
            data: { usedCount: { increment: 1 } },
          });
        } catch { /* non-critical — order already committed */ }
      }

      // Create initial status history
      await db.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: 'PENDING',
          note: 'Order created',
          changedBy: customer.id,
        },
      });

      // Update customer aggregate stats
      try {
        await db.customer.update({
          where: { id: customer.id },
          data: {
            totalOrders: { increment: 1 },
            totalSpent: { increment: totalAmount },
            lastOrderAt: new Date(),
          },
        });
      } catch { /* non-critical */ }

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
              storeId: body.storeId,
            }),
          },
        });
      } catch (notifErr) {
        console.error('[Storefront Orders] Notification error:', notifErr);
      }

      // Emit store-scoped real-time event — store staff only see their store's orders
      try {
        await emitStoreOrderEvent(businessId, body.storeId, 'order:created', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderType: body.orderType,
          orderSource: 'online',
          totalAmount: order.totalAmount,
          subtotal: order.subtotal,
          totalTax: order.totalTax,
          totalDiscount: order.totalDiscount,
          deliveryFee: order.deliveryFee,
          customerName: customer.name || user.name,
          customerPhone: customer.phone || null,
          deliveryAddress: order.deliveryAddress || null,
          storeId: body.storeId,
          items: order.items.map((i) => ({
            name: i.itemName,
            variant: i.variantName || null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
            isVeg: i.isVeg ?? null,
          })),
        });
      } catch (wsErr) {
        console.error('[Storefront Orders] WebSocket broadcast error:', wsErr);
      }

      // Send email notification to business owner (fire-and-forget)
      try {
        const business = await db.business.findUnique({
          where: { id: businessId },
          select: { name: true, contactEmail: true, slug: true },
        });
        const ownerEmail = business?.contactEmail;
        if (ownerEmail) {
          const domain = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'app.quantixtechnology.in';
          const dashboardUrl = `https://${domain}/business/${businessId}?page=orders`;
          sendNewOrderEmail({
            to: ownerEmail,
            businessName: business?.name || 'Your Store',
            orderNumber: order.orderNumber,
            orderType: body.orderType,
            customerName: customer.name || user.name,
            customerPhone: customer.phone || null,
            customerEmail: customer.email || (user.email?.endsWith('@otp.placeholder') ? null : user.email) || null,
            items: order.items.map((i) => ({
              name: i.itemName,
              variant: i.variantName || null,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              isVeg: i.isVeg ?? null,
            })),
            subtotal: order.subtotal,
            totalTax: order.totalTax,
            totalDiscount: order.totalDiscount,
            deliveryFee: order.deliveryFee,
            totalAmount: order.totalAmount,
            paymentMethod: order.paymentMethod || null,
            paymentStatus: order.paymentStatus,
            deliveryAddress: order.deliveryAddress || null,
            notes: order.notes || null,
            dashboardUrl,
            createdAt: order.createdAt,
          }).catch((e) => console.error('[Storefront Orders] Owner email error:', e));
        }
      } catch (emailErr) {
        console.error('[Storefront Orders] Owner email lookup error:', emailErr);
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
