// ============================================================================
// QUANTIX CORE — POS Receipt API
// POST /api/core/pos/receipt — Generate thermal receipt
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateThermalReceipt, numberToWords, calculatePOSCart } from '@/lib/core/pos';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const paperSize = body.paperSize || '80mm';
    if (!['58mm', '80mm', 'A4'].includes(paperSize)) {
      return NextResponse.json(
        { success: false, error: 'paperSize must be 58mm, 80mm, or A4' },
        { status: 400 }
      );
    }

    // Fetch order with items and business
    const order = await db.order.findUnique({
      where: { id: body.orderId },
      include: {
        items: true,
        business: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            gstNumber: true,
            fssaiLicense: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
        store: {
          select: {
            name: true,
            address: true,
            city: true,
            phone: true,
            gstNumber: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Calculate tax breakdown for receipt
    const cartItems = order.items.map((item) => ({
      productId: item.itemId,
      productName: item.itemName,
      variantName: item.variantName || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      mrp: item.mrp || item.unitPrice,
      discountPrice: item.discountPrice || undefined,
      gstRate: item.gstRate,
      isVeg: item.isVeg || undefined,
      sku: item.sku || undefined,
      unit: item.unit || undefined,
    }));

    const cartSummary = calculatePOSCart({
      items: cartItems,
      isInterState: (order.igstAmount || 0) > 0,
      deliveryFee: order.deliveryFee,
      packagingFee: order.packagingFee,
      convenienceFee: order.convenienceFee,
      roundOff: true,
    });

    const receipt = generateThermalReceipt({
      orderNumber: order.orderNumber,
      date: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        name: item.itemName + (item.variantName ? ` (${item.variantName})` : ''),
        qty: item.quantity,
        price: item.unitPrice,
        total: item.totalPrice,
        gstRate: item.gstRate,
      })),
      subtotal: order.subtotal,
      totalTax: order.totalTax,
      totalAmount: order.totalAmount,
      cgst: order.cgstAmount,
      sgst: order.sgstAmount,
      igst: order.igstAmount,
      discount: order.totalDiscount || undefined,
      deliveryFee: order.deliveryFee || undefined,
      packagingFee: order.packagingFee || undefined,
      convenienceFee: order.convenienceFee || undefined,
      roundOff: order.roundOff || undefined,
      businessName: order.business.name,
      businessAddress: order.business.address || order.store.address || undefined,
      businessGst: order.business.gstNumber || order.store.gstNumber || undefined,
      businessPhone: order.business.contactPhone || order.store.phone || undefined,
      businessEmail: order.business.contactEmail || undefined,
      businessFssai: order.business.fssaiLicense || undefined,
      customerName: order.customerName || undefined,
      customerPhone: order.customerPhone || undefined,
      paymentMethod: order.paymentMethod || undefined,
      paperSize: paperSize as '58mm' | '80mm' | 'A4',
      taxBreakdown: cartSummary.taxBreakdown,
      amountInWords: numberToWords(Math.round(order.totalAmount)),
    });

    return NextResponse.json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate receipt';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
