// ============================================================================
// QUANTIX CORE — POS Billing/Calculate API
// POST /api/core/pos/billing — Calculate POS cart (preview totals without creating order)
// ============================================================================

import { NextResponse } from 'next/server';
import { calculatePOSCart } from '@/lib/core/pos';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of body.items) {
      if (!item.productId || !item.productName) {
        return NextResponse.json(
          { success: false, error: 'Each item must have productId and productName' },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item: ${item.productName}` },
          { status: 400 }
        );
      }
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid unitPrice for item: ${item.productName}` },
          { status: 400 }
        );
      }
      if (item.mrp === undefined || item.mrp < 0) {
        return NextResponse.json(
          { success: false, error: `Invalid mrp for item: ${item.productName}` },
          { status: 400 }
        );
      }
    }

    const summary = calculatePOSCart({
      items: body.items,
      isInterState: body.isInterState || false,
      deliveryFee: body.deliveryFee,
      packagingFee: body.packagingFee,
      convenienceFee: body.convenienceFee,
      roundOff: body.roundOff,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate cart';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
