import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { businessId };
    if (storeId) where.storeId = storeId;
    if (status) where.status = status;

    const inventory = await db.inventory.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true, images: true } },
        variant: { select: { id: true, name: true, price: true, mrp: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const summary = {
      total: inventory.length,
      inStock: inventory.filter((i) => i.status === 'IN_STOCK').length,
      lowStock: inventory.filter((i) => i.status === 'LOW_STOCK').length,
      outOfStock: inventory.filter((i) => i.status === 'OUT_OF_STOCK').length,
    };

    return NextResponse.json({ success: true, data: inventory, summary });
  } catch (error) {
    console.error('Get inventory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await request.json();
    const { inventoryId, quantity, action, note, performedBy } = body;

    if (!inventoryId || quantity === undefined || !action) {
      return NextResponse.json(
        { success: false, error: 'inventoryId, quantity, and action are required' },
        { status: 400 }
      );
    }

    const inv = await db.inventory.findFirst({
      where: { id: inventoryId, businessId },
    });

    if (!inv) {
      return NextResponse.json(
        { success: false, error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    const previousQty = inv.quantity;
    let newQty = inv.quantity;

    switch (action) {
      case 'RESTOCK':
        newQty = previousQty + quantity;
        break;
      case 'ORDER_RESERVED':
        newQty = previousQty - quantity;
        break;
      case 'ORDER_FULFILLED':
        newQty = previousQty;
        break;
      case 'ADJUSTMENT':
        newQty = quantity;
        break;
      case 'RETURN':
        newQty = previousQty + quantity;
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    const newStatus = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= inv.minStock ? 'LOW_STOCK' : 'IN_STOCK';

    const updated = await db.inventory.update({
      where: { id: inventoryId },
      data: {
        quantity: newQty,
        status: newStatus,
        ...(action === 'RESTOCK' ? { lastRestockedAt: new Date() } : {}),
      },
    });

    await db.inventoryLog.create({
      data: {
        inventoryId,
        action,
        quantity,
        previousQty,
        newQty,
        note,
        performedBy,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update inventory error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}
