import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withBusinessAccess, parsePagination, paginatedResponse, validateBusinessExists } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async () => {
    try {
      const { page, limit, skip } = parsePagination(request);
      const { searchParams } = new URL(request.url);
      const storeId = searchParams.get('storeId');
      const status = searchParams.get('status');

      const where: Record<string, unknown> = { businessId };
      if (storeId) where.storeId = storeId;
      if (status) where.status = status;

      const [inventory, total] = await Promise.all([
        db.inventory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true, images: true } },
            variant: { select: { id: true, name: true, price: true, mrp: true } },
            store: { select: { id: true, name: true } },
          },
        }),
        db.inventory.count({ where }),
      ]);

      // Summary stats
      const [lowStockCount, outOfStockCount] = await Promise.all([
        db.inventory.count({ where: { businessId, status: 'LOW_STOCK' } }),
        db.inventory.count({ where: { businessId, status: 'OUT_OF_STOCK' } }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          ...paginatedResponse(inventory, total, page, limit),
          summary: { lowStockCount, outOfStockCount },
        },
      });
    } catch (error) {
      console.error('Get inventory error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  if (!(await validateBusinessExists(businessId))) {
    return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
  }
  return withBusinessAccess(request, businessId, async (_req, user) => {
    try {
      const body = await request.json();
      const { inventoryId, quantity, action, note, storeId, productId, variantId } = body;

      // Bulk update support
      if (Array.isArray(body.updates)) {
        const results = [];
        for (const update of body.updates) {
          const inv = await db.inventory.findFirst({
            where: {
              businessId,
              storeId: update.storeId,
              productId: update.productId,
              variantId: update.variantId || null,
            },
          });

          if (inv) {
            const previousQty = inv.quantity;
            const newQty = update.quantity;
            const newStatus = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= inv.minStock ? 'LOW_STOCK' : 'IN_STOCK';

            const updated = await db.inventory.update({
              where: { id: inv.id },
              data: { quantity: newQty, status: newStatus },
            });

            await db.inventoryLog.create({
              data: {
                inventoryId: inv.id,
                action: update.action || 'ADJUSTMENT',
                quantity: newQty - previousQty,
                previousQty,
                newQty,
                note: update.note,
                performedBy: user.id,
              },
            });

            results.push(updated);
          }
        }
        return NextResponse.json({ success: true, data: results, message: 'Inventory updated' });
      }

      // Single update
      if (!inventoryId && (!storeId || !productId)) {
        return NextResponse.json({ success: false, error: 'inventoryId or storeId+productId required' }, { status: 400 });
      }

      let inventory;
      if (inventoryId) {
        inventory = await db.inventory.findFirst({ where: { id: inventoryId, businessId } });
      } else {
        inventory = await db.inventory.findFirst({
          where: { businessId, storeId, productId, variantId: variantId || null },
        });
      }

      if (!inventory) {
        return NextResponse.json({ success: false, error: 'Inventory not found' }, { status: 404 });
      }

      const previousQty = inventory.quantity;
      const newQty = quantity !== undefined ? quantity : previousQty;
      const newStatus = newQty <= 0 ? 'OUT_OF_STOCK' : newQty <= inventory.minStock ? 'LOW_STOCK' : 'IN_STOCK';

      const updated = await db.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQty,
          status: newStatus,
          lastRestockedAt: action === 'RESTOCK' ? new Date() : undefined,
        },
      });

      await db.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          action: action || 'ADJUSTMENT',
          quantity: newQty - previousQty,
          previousQty,
          newQty,
          note,
          performedBy: user.id,
        },
      });

      return NextResponse.json({ success: true, data: updated, message: 'Inventory updated' });
    } catch (error) {
      console.error('Update inventory error:', error);
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  });
}
