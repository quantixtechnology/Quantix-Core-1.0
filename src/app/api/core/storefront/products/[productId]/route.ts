// ============================================================================
// QUANTIX CORE — Storefront Product Detail API
// GET    /api/core/storefront/products/[productId] — Get single product (public)
// PUT    /api/core/storefront/products/[productId] — Update product (auth required)
// DELETE /api/core/storefront/products/[productId] — Delete product (auth required)
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/core/audit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          select: { id: true, name: true, slug: true, image: true, workflowType: true },
        },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            mrp: true,
            discountPrice: true,
            discountPercent: true,
            isDefault: true,
            isActive: true,
            attributes: true,
          },
          orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
        },
        inventory: {
          select: { storeId: true, quantity: true, reservedQty: true, status: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get product';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  return withMiddleware({
    requireAuth: true,
    requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
  })(async (req) => {
    try {
      const body = await req.json();
      const user = req.user!;

      const existing = await db.product.findUnique({ where: { id: productId } });
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      if (!user.isPlatformAdmin && user.businessId !== existing.businessId) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      const updateData: Record<string, unknown> = {};

      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.shortDesc !== undefined) updateData.shortDesc = body.shortDesc;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.sku !== undefined) updateData.sku = body.sku;
      if (body.images !== undefined) updateData.images = JSON.stringify(body.images);
      if (body.unit !== undefined) updateData.unit = body.unit;
      if (body.unitQuantity !== undefined) updateData.unitQuantity = body.unitQuantity;
      if (body.isVeg !== undefined) updateData.isVeg = body.isVeg;
      if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
      if (body.isPopular !== undefined) updateData.isPopular = body.isPopular;
      if (body.preparationTime !== undefined) updateData.preparationTime = body.preparationTime;
      if (body.minOrderQty !== undefined) updateData.minOrderQty = body.minOrderQty;
      if (body.maxOrderQty !== undefined) updateData.maxOrderQty = body.maxOrderQty;
      if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
      if (body.workflowType !== undefined) updateData.workflowType = body.workflowType;
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
      if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
      if (body.metadata !== undefined) updateData.metadata = JSON.stringify(body.metadata || {});

      if (body.variants !== undefined && Array.isArray(body.variants)) {
        const updated = await db.$transaction(async (tx) => {
          await tx.productVariant.deleteMany({ where: { productId } });

          const variantInputs = body.variants.map((v: Record<string, unknown>, i: number) => ({
            name: String(v.name || body.name || existing.name),
            sku: v.sku ? String(v.sku) : null,
            barcode: v.barcode ? String(v.barcode) : null,
            price: Number(v.price) || 0,
            mrp: Number(v.mrp) || Number(v.price) || 0,
            discountPrice: v.discountPrice ? Number(v.discountPrice) : null,
            discountPercent: v.discountPercent ? Number(v.discountPercent) : null,
            isDefault: i === 0,
            isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
            attributes: JSON.stringify(v.attributes || {}),
            _stock: Number(v.stock) || 0,
          }));

          const product = await tx.product.update({
            where: { id: productId },
            data: {
              ...updateData,
              variants: {
                create: variantInputs.map(({ _stock: _, ...rest }) => rest),
              },
            },
            include: { category: true, variants: true },
          });

          if (existing.storeId) {
            for (let i = 0; i < product.variants.length; i++) {
              const variant = product.variants[i];
              const qty = variantInputs[i]?._stock ?? 0;
              await tx.inventory.upsert({
                where: {
                  storeId_productId_variantId: {
                    storeId: existing.storeId,
                    productId: existing.id,
                    variantId: variant.id,
                  },
                },
                update: {
                  quantity: qty,
                  status: qty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                },
                create: {
                  businessId: existing.businessId,
                  storeId: existing.storeId,
                  productId: existing.id,
                  variantId: variant.id,
                  quantity: qty,
                  minStock: 10,
                  maxStock: 1000,
                  status: qty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                },
              });
            }
          }

          return product;
        });

        return NextResponse.json({ success: true, data: updated, message: 'Product updated successfully' });
      }

      const product = await db.product.update({
        where: { id: productId },
        data: updateData,
        include: { category: true, variants: true },
      });

      return NextResponse.json({ success: true, data: product, message: 'Product updated successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update product';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  })(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const { productId } = await params;
  return withMiddleware({
    requireAuth: true,
    requiredPermission: 'products:delete',
  })(async (req) => {
    try {
      const user = req.user!;

      const existing = await db.product.findUnique({ where: { id: productId } });
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      if (!user.isPlatformAdmin && user.businessId !== existing.businessId) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }

      await db.product.delete({ where: { id: productId } });

      await logActivity({
        userId: user.id,
        businessId: existing.businessId ?? null,
        action: 'product.deleted',
        entity: 'Product',
        entityId: productId,
        details: {
          name: existing.name,
          sku: (existing as Record<string, unknown>).sku ?? null,
          deletedBy: user.email,
        },
      });

      return NextResponse.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete product';
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  })(request);
}
