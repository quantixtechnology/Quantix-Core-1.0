// ============================================================================
// QUANTIX CORE — Storefront Products API
// GET /api/core/storefront/products — Public product listing for customer app
// POST /api/core/storefront/products — Create product (admin)
//
// No auth required (public browsing)
// Only returns ACTIVE products from ACTIVE businesses by default
// Pass status=ALL or comma-separated statuses to include non-active products (admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || request.headers.get('x-business-id');
    const categoryId = searchParams.get('categoryId');
    const search = searchParams.get('search');
    const statusParam = searchParams.get('status'); // e.g. "ALL" or "ACTIVE,INACTIVE,DRAFT"
    const includeAllVariants = searchParams.get('includeAllVariants') === 'true';
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

    // Build where clause — status filter
    const where: Record<string, unknown> = {
      businessId,
    };

    if (statusParam && statusParam.toUpperCase() === 'ALL') {
      // Don't filter by status — return all statuses (admin use)
    } else if (statusParam) {
      // Support comma-separated statuses
      where.status = { in: statusParam.split(',').map(s => s.trim().toUpperCase()) };
    } else {
      // Default: only ACTIVE products (public storefront)
      where.status = 'ACTIVE';
    }

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
            where: includeAllVariants ? undefined : { isActive: true },
            select: {
              id: true,
              name: true,
              price: true,
              mrp: true,
              discountPrice: true,
              discountPercent: true,
              stock: true,
              isDefault: true,
              isActive: includeAllVariants ? true : undefined,
              sku: true,
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

    // Transform products for response
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
        businessId: product.businessId,
        storeId: product.storeId,
        categoryId: product.categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        shortDesc: product.shortDesc,
        type: product.type,
        status: product.status,
        sku: product.sku,
        barcode: product.barcode,
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
        workflowType: product.workflowType,
        sortOrder: product.sortOrder,
        category: product.category ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
          image: product.category.image,
          workflowType: (product.category as Record<string, unknown>)?.workflowType || undefined,
        } : null,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          price: v.price,
          mrp: v.mrp,
          discountPrice: v.discountPrice,
          discountPercent: v.discountPercent,
          stock: v.stock,
          isDefault: v.isDefault,
          isActive: (v as Record<string, unknown>)?.isActive ?? true,
          attributes: JSON.parse(v.attributes || '{}') as Record<string, string>,
        })),
        defaultPrice: defaultVariant?.price || 0,
        defaultMrp: defaultVariant?.mrp || 0,
        stockStatus,
        availableStock,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
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

// ============================================================================
// POST — Create a new product (admin)
// ============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Product name is required' },
        { status: 400 }
      );
    }

    // Verify business exists
    const business = await db.business.findUnique({
      where: { id: body.businessId },
    });
    if (!business) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Find the main store for this business
    const store = await db.store.findFirst({
      where: { businessId: body.businessId },
    });

    // Generate slug if not provided
    const slug = body.slug || body.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    // Resolve storeId — use provided, or main store, or error if neither
    const storeId = body.storeId || store?.id || null;

    // Create product with variants
    const product = await db.product.create({
      data: {
        businessId: body.businessId,
        storeId,
        categoryId: body.categoryId || null,
        name: body.name,
        slug,
        description: body.description || null,
        shortDesc: body.shortDesc || null,
        type: body.type || 'PHYSICAL',
        status: body.status || 'ACTIVE',
        sku: body.sku || null,
        barcode: body.barcode || null,
        images: JSON.stringify(body.images || []),
        unit: body.unit || null,
        unitQuantity: body.unitQuantity || null,
        isVeg: body.isVeg ?? null,
        isFeatured: body.isFeatured || false,
        isPopular: body.isPopular || false,
        preparationTime: body.preparationTime || null,
        minOrderQty: body.minOrderQty || 1,
        maxOrderQty: body.maxOrderQty || 100,
        tags: JSON.stringify(body.tags || []),
        workflowType: body.workflowType || undefined,
        sortOrder: body.sortOrder || 0,
        metadata: JSON.stringify(body.metadata || {}),
        variants: body.variants && body.variants.length > 0
          ? {
              create: body.variants.map((v: Record<string, unknown>, i: number) => ({
                name: String(v.name || body.name),
                sku: v.sku ? String(v.sku) : null,
                barcode: v.barcode ? String(v.barcode) : null,
                price: Number(v.price) || 0,
                mrp: Number(v.mrp) || Number(v.price) || 0,
                discountPrice: v.discountPrice ? Number(v.discountPrice) : null,
                discountPercent: v.discountPercent ? Number(v.discountPercent) : null,
                stock: Number(v.stock) || 0,
                minStock: Number(v.minStock) || 0,
                isDefault: i === 0,
                isActive: true,
                attributes: JSON.stringify(v.attributes || {}),
              }))
            }
          : {
              create: {
                name: body.name,
                price: Number(body.price) || 0,
                mrp: Number(body.mrp) || Number(body.price) || 0,
                stock: Number(body.stock) || 0,
                isDefault: true,
                isActive: true,
                attributes: '{}',
              }
            },
      },
      include: {
        category: true,
        variants: true,
      },
    });

    // Create inventory records for each variant if storeId is available
    if (storeId) {
      for (const variant of product.variants) {
        const existingInventory = await db.inventory.findFirst({
          where: { productId: product.id, variantId: variant.id, storeId },
        });
        if (!existingInventory) {
          await db.inventory.create({
            data: {
              businessId: body.businessId,
              storeId,
              productId: product.id,
              variantId: variant.id,
              quantity: variant.stock,
              minStock: 0,
              maxStock: 1000,
              status: variant.stock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: product,
      message: 'Product created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
