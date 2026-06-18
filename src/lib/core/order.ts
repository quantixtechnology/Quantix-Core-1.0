// ============================================================================
// QUANTIX CORE PLATFORM — Order Engine (CORE — Polymorphic)
//
// ARCHITECTURE:
//   OrderItem uses itemType/itemId (polymorphic) so ANY module's products
//   can be added to an order without the core knowing about them.
//   itemType = "grocery_product", "menu_item", "pharmacy_product", etc.
//   itemId   = ID in that module's product/service table
//
// STATE MACHINE:
//   1. Regular Delivery: PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP
//      → OUT_FOR_DELIVERY → DELIVERED
//   2. Pickup & Delivery: PENDING → PICKUP_ASSIGNED → PICKED_UP → PROCESSING
//      → READY_FOR_DELIVERY → OUT_FOR_DELIVERY → DELIVERED
//   3. POS: PENDING → CONFIRMED → DELIVERED (counter sale)
// ============================================================================

import { db } from '@/lib/db';
import type {
  CreateOrderParams,
  OrderItemInput,
  OrderTotals,
  OrderStatus,
  OrderStatusTransitions,
  OrderType as OrderTypeType,
  PaymentMethod as PaymentMethodType,
} from '@/lib/core/types';

// ============================================================================
// ORDER STATUS STATE MACHINE
// ============================================================================

/**
 * Valid status transitions per order type.
 * Key = current status, Value = array of valid next statuses.
 */
const REGULAR_DELIVERY_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
};

const PICKUP_AND_DELIVERY_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['PICKUP_ASSIGNED', 'CANCELLED'],
  PICKUP_ASSIGNED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
  SCHEDULED: ['PICKUP_ASSIGNED', 'CANCELLED'],
};

const POS_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const PICKUP_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const DINE_IN_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const SUBSCRIPTION_TRANSITIONS: OrderStatusTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_PICKUP: ['DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Get the state machine for a given order type.
 */
function getTransitionsForOrderType(orderType: string): OrderStatusTransitions {
  switch (orderType) {
    case 'DELIVERY':
    case 'DINE_IN':
      if (orderType === 'DINE_IN') return DINE_IN_TRANSITIONS;
      return REGULAR_DELIVERY_TRANSITIONS;
    case 'PICKUP_AND_DELIVERY':
      return PICKUP_AND_DELIVERY_TRANSITIONS;
    case 'POS':
      return POS_TRANSITIONS;
    case 'PICKUP':
      return PICKUP_TRANSITIONS;
    case 'SUBSCRIPTION':
      return SUBSCRIPTION_TRANSITIONS;
    default:
      return REGULAR_DELIVERY_TRANSITIONS;
  }
}

/**
 * Validate if a status transition is allowed for the given order type.
 */
export function isValidStatusTransition(
  orderType: string,
  currentStatus: string,
  newStatus: string
): boolean {
  const transitions = getTransitionsForOrderType(orderType);
  const allowed = transitions[currentStatus] || [];
  return allowed.includes(newStatus);
}

// ============================================================================
// GENERATE ORDER NUMBER
// ============================================================================

/**
 * Generate order number: ORD-YYYYMMDD-NNN
 * NNN is a sequential number based on existing orders for the business today.
 */
export async function generateOrderNumber(businessId: string): Promise<string> {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');

  const prefix = `ORD-${dateStr}-`;

  // Find the highest sequential number for today
  const lastOrder = await db.order.findFirst({
    where: {
      businessId,
      orderNumber: { startsWith: prefix },
    },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// ============================================================================
// CALCULATE ORDER TOTALS
// ============================================================================

/**
 * Calculate subtotal, GST (CGST/SGST/IGST), discounts, delivery fee, round off.
 * For intra-state: CGST + SGST (each = GST rate / 2)
 * For inter-state: IGST (= full GST rate)
 * Currently defaults to intra-state (CGST + SGST).
 */
export function calculateOrderTotals(items: OrderItemInput[]): OrderTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let cessAmount = 0;

  for (const item of items) {
    const quantity = item.quantity;
    const unitPrice = item.unitPrice;
    const mrp = item.mrp || unitPrice;
    const discountPrice = item.discountPrice;
    const discountPercent = item.discountPercent;
    const gstRate = item.gstRate || 0;

    // Calculate item total price
    let effectivePrice = unitPrice;
    let itemDiscount = 0;

    if (discountPrice !== undefined && discountPrice !== null && discountPrice < unitPrice) {
      itemDiscount = (unitPrice - discountPrice) * quantity;
      effectivePrice = discountPrice;
    } else if (discountPercent !== undefined && discountPercent !== null && discountPercent > 0) {
      itemDiscount = (unitPrice * discountPercent / 100) * quantity;
      effectivePrice = unitPrice * (1 - discountPercent / 100);
    }

    const lineTotal = effectivePrice * quantity;

    // Calculate GST on the discounted price
    // Intra-state: CGST + SGST (each half of GST rate)
    const itemTaxableAmount = lineTotal;
    const itemGstAmount = itemTaxableAmount * gstRate / 100;
    const itemCgst = itemGstAmount / 2;
    const itemSgst = itemGstAmount / 2;

    subtotal += lineTotal;
    totalDiscount += itemDiscount;
    totalTax += itemGstAmount;
    cgstAmount += itemCgst;
    sgstAmount += itemSgst;
  }

  // Round to 2 decimal places
  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  cgstAmount = Math.round(cgstAmount * 100) / 100;
  sgstAmount = Math.round(sgstAmount * 100) / 100;
  igstAmount = Math.round(igstAmount * 100) / 100;
  cessAmount = Math.round(cessAmount * 100) / 100;

  // Calculate raw total (before rounding)
  const rawTotal = subtotal - totalDiscount + totalTax;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  const totalAmount = roundedTotal;

  return {
    subtotal,
    totalDiscount,
    totalTax,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    deliveryFee: 0, // Set separately
    packagingFee: 0,
    convenienceFee: 0,
    tip: 0,
    roundOff,
    totalAmount,
  };
}

// ============================================================================
// CREATE ORDER
// ============================================================================

/**
 * Create order with polymorphic items. Each item has itemType, itemId,
 * plus snapshot fields (itemName, unitPrice, mrp, etc.).
 * Auto-generates orderNumber, calculates GST, sets initial status.
 */
export async function createOrder(params: CreateOrderParams) {
  // 1. Verify business exists and is active
  const business = await db.business.findUnique({
    where: { id: params.businessId },
  });
  if (!business) {
    throw new Error(`Business "${params.businessId}" not found`);
  }

  // 2. Verify store exists and belongs to business
  const store = await db.store.findFirst({
    where: { id: params.storeId, businessId: params.businessId },
  });
  if (!store) {
    throw new Error(`Store "${params.storeId}" not found or does not belong to business`);
  }

  // 3. Validate items
  if (!params.items || params.items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  for (const item of params.items) {
    if (!item.itemType || !item.itemId || !item.itemName) {
      throw new Error('Each order item must have itemType, itemId, and itemName');
    }
    if (item.quantity <= 0) {
      throw new Error('Item quantity must be greater than 0');
    }
    if (item.unitPrice < 0) {
      throw new Error('Item unitPrice cannot be negative');
    }
  }

  // 4. Calculate order totals
  const totals = calculateOrderTotals(params.items);

  // Add delivery/packaging/convenience/tip fees
  totals.deliveryFee = params.deliveryFee || 0;
  totals.packagingFee = params.packagingFee || 0;
  totals.convenienceFee = params.convenienceFee || 0;
  totals.tip = params.tip || 0;

  // Recalculate total with fees
  const rawTotalWithFees =
    totals.subtotal -
    totals.totalDiscount +
    totals.totalTax +
    totals.deliveryFee +
    totals.packagingFee +
    totals.convenienceFee +
    totals.tip;
  const roundedTotalWithFees = Math.round(rawTotalWithFees);
  totals.roundOff = Math.round((roundedTotalWithFees - rawTotalWithFees) * 100) / 100;
  totals.totalAmount = roundedTotalWithFees;

  // 5. Generate order number
  const orderNumber = await generateOrderNumber(params.businessId);

  // 6. Generate OTPs for delivery orders
  const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));
  const needsDeliveryOtp = ['DELIVERY', 'PICKUP_AND_DELIVERY'].includes(params.orderType);
  const needsPickupOtp = params.orderType === 'PICKUP_AND_DELIVERY';

  // 7. Create order + items + status history in transaction
  const order = await db.$transaction(async (tx) => {
    // Create order
    const newOrder = await tx.order.create({
      data: {
        businessId: params.businessId,
        storeId: params.storeId,
        originStoreId: params.originStoreId || null,
        processingStoreId: params.processingStoreId || null,
        deliveryStoreId: params.deliveryStoreId || null,
        orderNumber,
        orderType: params.orderType as OrderTypeType,
        orderSource: params.orderSource || 'online',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: (params.paymentMethod as PaymentMethodType) || null,
        // Customer info
        customerId: params.customerId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerEmail: params.customerEmail,
        // Delivery
        deliveryAddressId: params.deliveryAddressId,
        deliveryAddress: params.deliveryAddress,
        deliveryLat: params.deliveryLat,
        deliveryLng: params.deliveryLng,
        deliveryInstructions: params.deliveryInstructions,
        scheduledAt: params.scheduledAt,
        // Pickup
        pickupAddress: params.pickupAddress,
        pickupScheduledAt: params.pickupScheduledAt,
        // Billing
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        deliveryFee: totals.deliveryFee,
        packagingFee: totals.packagingFee,
        convenienceFee: totals.convenienceFee,
        tip: totals.tip,
        roundOff: totals.roundOff,
        totalAmount: totals.totalAmount,
        // GST
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        cessAmount: totals.cessAmount,
        // POS
        posSessionId: params.posSessionId,
        posOperatorId: params.posOperatorId,
        tableNumber: params.tableNumber,
        // Subscription
        subscriptionId: params.subscriptionId,
        // Promo
        promoCodeId: params.promoCodeId,
        // OTPs
        deliveryOtp: needsDeliveryOtp ? generateOtp() : null,
        pickupOtp: needsPickupOtp ? generateOtp() : null,
        // Metadata
        notes: params.notes,
        metadata: params.metadata || '{}',
      },
    });

    // Create order items
    await tx.orderItem.createMany({
      data: params.items.map((item) => {
        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const effectivePrice = item.discountPrice !== undefined && item.discountPrice !== null && item.discountPrice < unitPrice
          ? item.discountPrice
          : item.discountPercent !== undefined && item.discountPercent !== null && item.discountPercent > 0
            ? unitPrice * (1 - item.discountPercent / 100)
            : unitPrice;

        const lineTotal = effectivePrice * quantity;
        const gstRate = item.gstRate || 0;
        const itemGstAmount = lineTotal * gstRate / 100;
        const itemCgst = itemGstAmount / 2;
        const itemSgst = itemGstAmount / 2;

        return {
          orderId: newOrder.id,
          itemType: item.itemType,
          itemId: item.itemId,
          itemName: item.itemName,
          variantName: item.variantName,
          sku: item.sku,
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          mrp: item.mrp,
          discountPrice: item.discountPrice,
          discountPercent: item.discountPercent,
          totalPrice: Math.round(lineTotal * 100) / 100,
          totalMrp: item.mrp ? Math.round(item.mrp * quantity * 100) / 100 : null,
          gstRate: gstRate,
          gstAmount: Math.round(itemGstAmount * 100) / 100,
          cgstAmount: Math.round(itemCgst * 100) / 100,
          sgstAmount: Math.round(itemSgst * 100) / 100,
          igstAmount: 0,
          specialInstructions: item.specialInstructions,
          customizations: item.customizations,
          isVeg: item.isVeg,
          unit: item.unit,
          metadata: item.metadata || '{}',
        };
      }),
    });

    // Create initial status history entry
    await tx.orderStatusHistory.create({
      data: {
        orderId: newOrder.id,
        status: 'PENDING',
        note: 'Order created',
        changedBy: params.posOperatorId || params.customerId || 'system',
      },
    });

    // Create delivery record for delivery orders
    if (['DELIVERY', 'PICKUP_AND_DELIVERY'].includes(params.orderType)) {
      await tx.delivery.create({
        data: {
          orderId: newOrder.id,
          status: 'ASSIGNING',
          pickupLat: store.latitude,
          pickupLng: store.longitude,
          pickupAddress: store.address
            ? JSON.stringify({ address: store.address, city: store.city, pincode: store.pincode })
            : null,
          dropLat: params.deliveryLat,
          dropLng: params.deliveryLng,
          dropAddress: params.deliveryAddress,
          deliveryOtp: needsDeliveryOtp ? newOrder.deliveryOtp : null,
          pickupOtp: needsPickupOtp ? newOrder.pickupOtp : null,
        },
      });
    }

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: params.businessId,
        action: 'order.created',
        entity: 'Order',
        entityId: newOrder.id,
        details: JSON.stringify({
          orderNumber,
          orderType: params.orderType,
          totalAmount: totals.totalAmount,
          itemCount: params.items.length,
        }),
      },
    });

    return newOrder;
  });

  // Return order with items
  return getOrder(order.id);
}

// ============================================================================
// UPDATE ORDER STATUS
// ============================================================================

/**
 * Update order status with state machine validation.
 * Records each transition in OrderStatusHistory.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  changedBy: string,
  note?: string
) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) {
    throw new Error(`Order "${orderId}" not found`);
  }

  // Cannot update status of cancelled or refunded orders
  if (order.status === 'CANCELLED') {
    throw new Error('Cannot update status of a cancelled order');
  }
  if (order.status === 'REFUNDED') {
    throw new Error('Cannot update status of a refunded order');
  }

  // Already in the target status
  if (order.status === newStatus) {
    throw new Error(`Order is already in "${newStatus}" status`);
  }

  // Validate transition via state machine
  if (!isValidStatusTransition(order.orderType, order.status, newStatus)) {
    throw new Error(
      `Invalid status transition for ${order.orderType} order: ${order.status} → ${newStatus}`
    );
  }

  // Build update data with timestamps
  const updateData: Record<string, unknown> = { status: newStatus };

  if (newStatus === 'CONFIRMED') {
    updateData.confirmedAt = new Date();
  } else if (newStatus === 'PREPARING') {
    updateData.preparedAt = new Date();
  } else if (newStatus === 'DELIVERED') {
    updateData.deliveredAt = new Date();
    // If payment was pending, mark as completed for POS/counter sales
    if (order.paymentStatus === 'PENDING' && order.orderType === 'POS') {
      updateData.paymentStatus = 'COMPLETED';
    }
  }

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Record status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus as OrderStatus,
        note: note || `Status changed from ${order.status} to ${newStatus}`,
        changedBy,
      },
    });

    // Inventory: deduct on CONFIRMED (with stock check), restore on CANCELLED
    if (newStatus === 'CONFIRMED' || newStatus === 'CANCELLED') {
      for (const item of order.items) {
        const inv = await tx.inventory.findFirst({
          where: {
            storeId:   order.storeId,
            productId: item.itemId,
          },
        });
        if (!inv) continue;

        if (newStatus === 'CONFIRMED') {
          const needed = Math.ceil(item.quantity);
          // Non-blocking: the business owner's confirmation is authoritative.
          // Deduct what's available; if stock is insufficient, mark OUT_OF_STOCK
          // but never block the status transition — prevents workflow deadlock
          // when stores haven't set up inventory levels (default qty = 0).
          const newQty    = Math.max(0, inv.quantity - needed);
          const newStatus2: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' =
            newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= inv.minStock ? 'LOW_STOCK' : 'IN_STOCK';
          await tx.inventory.update({
            where: { id: inv.id },
            data:  { quantity: newQty, status: newStatus2 },
          });
          await tx.inventoryLog.create({
            data: {
              inventoryId: inv.id,
              action:      'ORDER_CONFIRMED',
              quantity:    -Math.ceil(item.quantity),
              previousQty: inv.quantity,
              newQty,
              note:        `Order ${orderId} confirmed`,
              performedBy: changedBy,
            },
          });
        } else {
          // CANCELLED — restore the stock
          const restored = inv.quantity + Math.ceil(item.quantity);
          const newStatusR: 'IN_STOCK' | 'LOW_STOCK' =
            restored <= inv.minStock ? 'LOW_STOCK' : 'IN_STOCK';
          await tx.inventory.update({
            where: { id: inv.id },
            data:  { quantity: restored, status: newStatusR },
          });
          await tx.inventoryLog.create({
            data: {
              inventoryId: inv.id,
              action:      'ORDER_CANCELLED',
              quantity:    Math.ceil(item.quantity),
              previousQty: inv.quantity,
              newQty:      restored,
              note:        `Order ${orderId} cancelled — stock restored`,
              performedBy: changedBy,
            },
          });
        }
      }
    }

    // Update delivery status in tandem if applicable
    if (['DELIVERY', 'PICKUP_AND_DELIVERY'].includes(order.orderType)) {
      const deliveryStatusMap: Record<string, 'ASSIGNED' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED'> = {
        CONFIRMED: 'ASSIGNED',
        OUT_FOR_DELIVERY: 'ON_THE_WAY',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
      };
      const mappedDeliveryStatus = deliveryStatusMap[newStatus];
      if (mappedDeliveryStatus) {
        await tx.delivery.updateMany({
          where: { orderId },
          data: { status: mappedDeliveryStatus },
        });
      }
    }

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: order.businessId,
        action: 'order.status_changed',
        entity: 'Order',
        entityId: orderId,
        details: JSON.stringify({
          from: order.status,
          to: newStatus,
          changedBy,
          note,
        }),
      },
    });

    return updated;
  });

  return result;
}

// ============================================================================
// CANCEL ORDER
// ============================================================================

/**
 * Cancel an order with a reason. Only pending or confirmed orders can be cancelled.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy: string
) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new Error(`Order "${orderId}" not found`);
  }

  // Only allow cancellation from certain statuses
  const cancellableStatuses = [
    'PENDING', 'CONFIRMED', 'SCHEDULED',
    'PICKUP_ASSIGNED', 'PREPARING',
    'READY_FOR_PICKUP', 'READY_FOR_DELIVERY',
  ];

  if (!cancellableStatuses.includes(order.status)) {
    throw new Error(
      `Cannot cancel order in "${order.status}" status. Only orders in [${cancellableStatuses.join(', ')}] can be cancelled.`
    );
  }

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledAt: new Date(),
      },
    });

    // Record in status history
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: 'CANCELLED',
        note: `Cancelled: ${reason}`,
        changedBy: cancelledBy,
      },
    });

    // Cancel delivery if exists
    await tx.delivery.updateMany({
      where: { orderId },
      data: { status: 'CANCELLED', cancelReason: reason },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        businessId: order.businessId,
        action: 'order.cancelled',
        entity: 'Order',
        entityId: orderId,
        details: JSON.stringify({
          orderNumber: order.orderNumber,
          reason,
          cancelledBy,
          previousStatus: order.status,
        }),
      },
    });

    return updated;
  });

  return result;
}

// ============================================================================
// GET ORDER
// ============================================================================

/**
 * Get order with items, delivery, and payments.
 */
export async function getOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      // Direct FK relation — set by the admin assign-partner action
      deliveryPartner: {
        select: {
          id: true, name: true, phone: true,
          vehicleType: true, vehicleNumber: true, avatar: true, rating: true,
        },
      },
      // Delivery sub-record with nested partner — set by /delivery/assign workflow
      delivery: {
        include: {
          deliveryPartner: {
            select: {
              id: true, name: true, phone: true,
              vehicleType: true, vehicleNumber: true, avatar: true, rating: true,
            },
          },
        },
      },
      payments: true,
      statusHistory: {
        orderBy: { createdAt: 'asc' },
      },
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          city: true,
          phone: true,
          gstNumber: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          gstNumber: true,
        },
      },
      promoCode: {
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order "${orderId}" not found`);
  }

  return order;
}

// ============================================================================
// LIST ORDERS
// ============================================================================

/**
 * List orders with filtering (status, type, date range, customer, search).
 */
export async function listOrders(
  businessId: string,
  filters?: {
    status?: string | string[];
    orderType?: string | string[];
    paymentStatus?: string | string[];
    storeId?: string | string[];
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    minAmount?: number;
    maxAmount?: number;
    page?: number;
    limit?: number;
  }
) {
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = { businessId };

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    where.status = { in: statuses };
  }

  if (filters?.orderType) {
    const types = Array.isArray(filters.orderType) ? filters.orderType : [filters.orderType];
    where.orderType = { in: types };
  }

  if (filters?.paymentStatus) {
    const statuses = Array.isArray(filters.paymentStatus) ? filters.paymentStatus : [filters.paymentStatus];
    where.paymentStatus = { in: statuses };
  }

  if (filters?.storeId) {
    const storeIds = Array.isArray(filters.storeId) ? filters.storeId : [filters.storeId];
    where.storeId = { in: storeIds };
  }

  if (filters?.customerId) {
    where.customerId = filters.customerId;
  }

  // Date range
  if (filters?.dateFrom || filters?.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
    where.createdAt = createdAt;
  }

  // Amount range
  if (filters?.minAmount !== undefined || filters?.maxAmount !== undefined) {
    const totalAmount: Record<string, number> = {};
    if (filters.minAmount !== undefined) totalAmount.gte = filters.minAmount;
    if (filters.maxAmount !== undefined) totalAmount.lte = filters.maxAmount;
    where.totalAmount = totalAmount;
  }

  // Search (order number, customer name, customer phone)
  if (filters?.search) {
    where.OR = [
      { orderNumber: { contains: filters.search } },
      { customerName: { contains: filters.search } },
      { customerPhone: { contains: filters.search } },
      { customerEmail: { contains: filters.search } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        items: {
          select: {
            id: true,
            itemType: true,
            itemName: true,
            variantName: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            isVeg: true,
          },
        },
        store: {
          select: { id: true, name: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
        deliveryPartner: {
          select: { id: true, name: true, phone: true },
        },
        delivery: {
          select: {
            id: true,
            status: true,
            deliveryPartner: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        payments: {
          select: { id: true, amount: true, status: true, method: true, gatewayName: true, paidAt: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: { status: true, note: true, createdAt: true },
        },
        promoCode: {
          select: { code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.order.count({ where }),
  ]);

  return {
    data: orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}
