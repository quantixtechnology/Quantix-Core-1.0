// ============================================================================
// QUANTIX CORE — Category Products API
// GET /api/core/categories/{categoryId}/products
//
// Customer-facing. No auth required.
// Returns active products for a given category.
// Supports: ?limit=50&page=1&storeId=xxx (storeId scopes to store inventory)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) => {
  try {
    const { categoryId } = await params;
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const category = await db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, businessId: true, isActive: true },
    });

    if (!category || !category.isActive) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    const where: Record<string, unknown> = {
      categoryId,
      status: 'ACTIVE',
    };

    if (storeId) {
      where.inventory = {
        some: { storeId, status: { not: 'DISCONTINUED' } },
      };
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: {
            select: { id: true, name: true, slug: true, image: true },
          },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
              mrp: true,
              discountPrice: true,
              discountPercent: true,
              isDefault: true,
              attributes: true,
            },
            orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
          },
          inventory: {
            where: storeId ? { storeId } : undefined,
            select: { storeId: true, quantity: true, reservedQty: true, status: true },
          },
        },
        orderBy: [
          { isFeatured: 'desc' },
          { isPopular: 'desc' },
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      db.product.count({ where }),
    ]);

    const data = products.map((product) => {
      const availableStock = product.inventory.reduce(
        (sum, inv) => sum + Math.max(0, inv.quantity - inv.reservedQty),
        0
      );
      const stockStatus =
        availableStock > 10
          ? 'IN_STOCK'
          : availableStock > 0
            ? 'LOW_STOCK'
            : 'OUT_OF_STOCK';

      const defaultVariant =
        product.variants.find((v) => v.isDefault) ?? product.variants[0];

      return {
        id: product.id,
        businessId: product.businessId,
        storeId: product.storeId,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDesc: product.shortDesc,
        images: JSON.parse(product.images || '[]') as string[],
        unit: product.unit,
        unitQuantity: product.unitQuantity,
        isVeg: product.isVeg,
        isFeatured: product.isFeatured,
        isPopular: product.isPopular,
        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
              image: product.category.image,
            }
          : null,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          mrp: v.mrp,
          discountPrice: v.discountPrice,
          discountPercent: v.discountPercent,
          isDefault: v.isDefault,
          attributes: JSON.parse(v.attributes || '{}') as Record<string, string>,
        })),
        defaultPrice: defaultVariant?.price ?? 0,
        defaultMrp: defaultVariant?.mrp ?? 0,
        stockStatus,
        availableStock,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load products';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
};
