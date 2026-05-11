// ============================================================================
// QUANTIX CORE — Storefront Product Detail API
// GET    /api/core/storefront/products/[productId] — Get single product
// PUT    /api/core/storefront/products/[productId] — Update product
// DELETE /api/core/storefront/products/[productId] — Delete product
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
            stock: true,
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
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const body = await request.json();

    // Verify product exists
    const existing = await db.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Build update data — only include fields that are provided
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

    // Handle variants update — replace all variants
    if (body.variants !== undefined && Array.isArray(body.variants)) {
      // Delete existing variants and create new ones in a transaction
      const updated = await db.$transaction(async (tx) => {
        // Delete old variants
        await tx.productVariant.deleteMany({ where: { productId } });

        // Update product
        const product = await tx.product.update({
          where: { id: productId },
          data: {
            ...updateData,
            variants: {
              create: body.variants.map((v: Record<string, unknown>, i: number) => ({
                name: String(v.name || body.name || existing.name),
                sku: v.sku ? String(v.sku) : null,
                barcode: v.barcode ? String(v.barcode) : null,
                price: Number(v.price) || 0,
                mrp: Number(v.mrp) || Number(v.price) || 0,
                discountPrice: v.discountPrice ? Number(v.discountPrice) : null,
                discountPercent: v.discountPercent ? Number(v.discountPercent) : null,
                stock: Number(v.stock) || 0,
                isDefault: i === 0,
                isActive: true,
                attributes: JSON.stringify(v.attributes || {}),
              })),
            },
          },
          include: {
            category: true,
            variants: true,
          },
        });

        return product;
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Product updated successfully',
      });
    }

    // Simple update without variants
    const product = await db.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        category: true,
        variants: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update product';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    // Verify product exists
    const existing = await db.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Delete product (cascades will handle variants, inventory, etc.)
    await db.product.delete({ where: { id: productId } });

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete product';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
