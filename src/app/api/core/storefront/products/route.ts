// ============================================================================
// QUANTIX CORE — Storefront Products API
// GET /api/core/storefront/products — Public product listing for customer app
//
// No auth required (public browsing)
// Only returns ACTIVE products from ACTIVE businesses
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    // Verify business exists and is active
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: { id: true, status: true, isOnline: true },
    });

    if (!business || (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING')) {
      return NextResponse.json(
        { success: false, error: 'Business not found or not active' },
        { status: 404 }
      );
    }

    // Build where clause — only ACTIVE products
    const where: Record<string, unknown> = {
      businessId,
      status: 'ACTIVE',
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { shortDesc: { contains: search } },
        { sku: { contains: search } },
      ];
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
            },
          },
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              price: true,
              mrp: true,
              discountPrice: true,
              discountPercent: true,
              stock: true,
              isDefault: true,
              attributes: true,
            },
            orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
          },
          inventory: {
            select: {
              storeId: true,
              quantity: true,
              reservedQty: true,
              status: true,
            },
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

    // Transform products for customer-facing response
    const storefrontProducts = products.map((product) => {
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

      // Find the best (default or cheapest) variant
      const defaultVariant =
        product.variants.find((v) => v.isDefault) || product.variants[0];

      return {
        id: product.id,
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
        preparationTime: product.preparationTime,
        minOrderQty: product.minOrderQty,
        maxOrderQty: product.maxOrderQty,
        tags: JSON.parse(product.tags || '[]') as string[],
        category: product.category,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          mrp: v.mrp,
          discountPrice: v.discountPrice,
          discountPercent: v.discountPercent,
          stock: v.stock,
          isDefault: v.isDefault,
          attributes: JSON.parse(v.attributes || '{}') as Record<string, string>,
        })),
        defaultPrice: defaultVariant?.price || 0,
        defaultMrp: defaultVariant?.mrp || 0,
        stockStatus,
        availableStock,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: storefrontProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list storefront products';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
