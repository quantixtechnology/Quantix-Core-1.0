// ============================================================================
// Storefront Guest Order API
// POST /api/core/storefront/orders/guest — Create order without auth
//
// Accepts COD orders from unauthenticated (guest) customers.
// Requires: storeId, items, customerName, customerPhone, deliveryAddress
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitStoreOrderEvent } from '@/lib/realtime-emitter'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.storeId) {
      return NextResponse.json({ success: false, error: 'storeId is required' }, { status: 400 })
    }
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one item is required' }, { status: 400 })
    }
    if (!body.customerName) {
      return NextResponse.json({ success: false, error: 'customerName is required' }, { status: 400 })
    }
    if (!body.customerPhone) {
      return NextResponse.json({ success: false, error: 'customerPhone is required' }, { status: 400 })
    }

    const store = await db.store.findUnique({
      where: { id: body.storeId },
      select: { id: true, businessId: true, status: true },
    })
    if (!store || store.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'Store not found or inactive' }, { status: 404 })
    }

    const businessId = store.businessId

    // Resolve and validate products
    const resolvedItems: {
      itemType: string; itemId: string; itemName: string; variantName: string | null
      sku: string | null; quantity: number; unitPrice: number; mrp: number | null
      totalPrice: number; gstRate: number; gstAmount: number; cgstAmount: number; sgstAmount: number
      isVeg: boolean | null; unit: string | null; specialInstructions: string | null
    }[] = []
    let subtotal = 0

    for (const item of body.items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid item: productId and quantity required' }, { status: 400 })
      }

      const product = await db.product.findUnique({
        where: { id: item.productId },
        include: { variants: { where: { isActive: true } } },
      })
      if (!product || product.status !== 'ACTIVE') {
        return NextResponse.json({ success: false, error: `Product unavailable: ${item.productId}` }, { status: 400 })
      }

      let variant = product.variants.find((v) => v.id === item.variantId)
      if (!variant) variant = product.variants.find((v) => v.isDefault) ?? product.variants[0]
      if (!variant) {
        return NextResponse.json({ success: false, error: `No variant for: ${product.name}` }, { status: 400 })
      }

      // Inventory pre-check: only enforce when a row exists (tracked products).
      const inv = await db.inventory.findFirst({
        where: { storeId: body.storeId, productId: product.id },
        select: { quantity: true, reservedQty: true },
      })
      if (inv) {
        const available = Math.max(0, inv.quantity - (inv.reservedQty || 0))
        if (available < item.quantity) {
          return NextResponse.json({
            success: false,
            error: `"${product.name}" is out of stock. Available: ${available}, requested: ${item.quantity}.`,
            code: 'OUT_OF_STOCK',
            productId: product.id,
            availableQty: available,
            requestedQty: item.quantity,
          }, { status: 422 })
        }
      }

      const unitPrice = variant.discountPrice != null && variant.discountPrice < variant.price
        ? variant.discountPrice : variant.price
      const lineTotal = unitPrice * item.quantity
      subtotal += lineTotal

      resolvedItems.push({
        itemType: 'product',
        itemId: product.id,
        itemName: product.name,
        variantName: variant.name !== 'Default' ? variant.name : null,
        sku: variant.sku || product.sku || null,
        quantity: item.quantity,
        unitPrice,
        mrp: variant.mrp,
        totalPrice: Math.round(lineTotal * 100) / 100,
        gstRate: 0,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        isVeg: product.isVeg ?? null,
        unit: product.unit ?? null,
        specialInstructions: item.specialInstructions || null,
      })
    }

    const deliveryFee = body.deliveryFee ?? 0
    const totalAmount = Math.round(subtotal + deliveryFee)

    // Generate order number
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const prefix = `ORD-${dateStr}-`
    const lastOrder = await db.order.findFirst({
      where: { businessId, orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    })
    const seq = lastOrder ? parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10) + 1 : 1
    const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`

    const order = await db.order.create({
      data: {
        businessId,
        storeId: body.storeId,
        orderNumber,
        orderType: body.orderType || 'DELIVERY',
        orderSource: 'online',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'COD',
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail || null,
        deliveryAddress: body.deliveryAddress || null,
        deliveryInstructions: body.deliveryInstructions || null,
        notes: body.notes || null,
        subtotal: Math.round(subtotal * 100) / 100,
        totalTax: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        deliveryFee,
        totalAmount,
        items: { create: resolvedItems },
      },
      include: { items: true },
    })

    await db.orderStatusHistory.create({
      data: { orderId: order.id, status: 'PENDING', note: 'Guest order created', changedBy: 'guest' },
    })

    try {
      await db.notification.create({
        data: {
          businessId,
          type: 'ORDER_STATUS',
          channel: 'IN_APP',
          title: 'New Guest Order! 🛒',
          message: `Guest order #${order.orderNumber} from ${body.customerName}`,
          data: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
        },
      })
    } catch { /* non-critical */ }

    try {
      await emitStoreOrderEvent(businessId, body.storeId, 'order:created', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderType: order.orderType,
        totalAmount: order.totalAmount,
        customerName: body.customerName,
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, data: order, message: 'Guest order created' }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create guest order'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
