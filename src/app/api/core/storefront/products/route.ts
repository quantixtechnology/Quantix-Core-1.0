// ============================================================================
// QUANTIX CORE — Storefront Products API
// GET /api/core/storefront/products — Public product listing (no auth)
// POST /api/core/storefront/products — Create product (auth required)
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { resolveImageUrl, resolveImageUrls } from '@/lib/image-url';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId') || request.headers.get('x-business-id');
    const storeId = searchParams.get('storeId') || undefined;
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

    // Products are BUSINESS-level entities — never filter the product list by store.
    // filterByStore=true: customer storefront only — only return products with inventory at this store.
    // Admin Products module: omit filterByStore → returns ALL business products.
    // storeId alone only scopes the inventory rows included per product (for stock display).
    const filterByStore = searchParams.get('filterByStore') === 'true';
    if (storeId && filterByStore) {
      where.inventory = {
        some: {
          storeId,
          status: { not: 'DISCONTINUED' },
        },
      };
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
              isDefault: true,
              isActive: includeAllVariants ? true : undefined,
              sku: true,
              attributes: true,
            },
            orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
          },
          inventory: {
            // When scoped to a store, only return that store's inventory rows
            where: storeId ? { storeId } : undefined,
            select: {
              variantId: true,
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
      // Build variantId → inventory lookup for per-variant stock
      const invByVariant = new Map(
        product.inventory.map(inv => [inv.variantId, inv])
      );

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

      // hasInventory: true only when storeId was passed AND rows exist for this store.
      // false means inventory is not tracked for this product → treat as purchasable.
      const hasInventory = !!storeId && product.inventory.length > 0;

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
        images: resolveImageUrls(JSON.parse(product.images || '[]') as string[]),
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
          image: resolveImageUrl(product.category.image),
          workflowType: (product.category as Record<string, unknown>)?.workflowType || undefined,
        } : null,
        variants: product.variants.map((v) => {
          const inv = invByVariant.get(v.id)
          const variantStock = inv ? Math.max(0, inv.quantity - inv.reservedQty) : 0
          return {
            id: v.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            mrp: v.mrp,
            discountPrice: v.discountPrice,
            discountPercent: v.discountPercent,
            isDefault: v.isDefault,
            isActive: (v as Record<string, unknown>)?.isActive ?? true,
            attributes: JSON.parse(v.attributes || '{}') as Record<string, string>,
            stock: variantStock,
          }
        }),
        defaultPrice: defaultVariant?.price || 0,
        defaultMrp: defaultVariant?.mrp || 0,
        stockStatus,
        availableStock,
        hasInventory,
        metadata: JSON.parse((product as unknown as Record<string, string>).metadata || '{}') as Record<string, unknown>,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: storefrontProducts,
      // Echo back the storeId used so the client can confirm store context
      storeId: storeId || null,
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
// POST — Create a new product (auth required: CLIENT_OWNER+)
// ============================================================================
export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'],
})(async (req) => {
  try {
    const body = await req.json();
    const user = req.user!;

    console.log(`[products/POST] userId=${user.id} role=${user.role} isPlatformAdmin=${user.isPlatformAdmin} userBusinessId=${user.businessId} bodyBusinessId=${body.businessId} productName=${body.name}`);

    if (!body.businessId) {
      return NextResponse.json(
        { success: false, error: 'businessId is required' },
        { status: 400 }
      );
    }

    if (!user.isPlatformAdmin && user.businessId !== body.businessId) {
      console.error(`[products/POST] REJECTED — user.businessId=${user.businessId} !== body.businessId=${body.businessId}`);
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Product name is required' },
        { status: 400 }
      );
    }

    const business = await db.business.findUnique({ where: { id: body.businessId } });
    if (!business) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    // addToAllStores (default true): create inventory rows for every active store at qty=0.
    // false: create inventory only for the selected/primary store.
    const addToAllStores = body.addToAllStores !== false;

    const allStores = await db.store.findMany({
      where: { businessId: body.businessId, status: 'ACTIVE' },
      select: { id: true },
    });

    const slug = (body.slug || body.name)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    // Deduplicate slug — same pattern as business-specific POST route
    const existingSlug = await db.product.findFirst({ where: { businessId: body.businessId, slug } });
    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    // Primary storeId for the product record itself (used for order routing)
    const storeId = body.storeId || allStores[0]?.id || null;

    console.log(`[products/POST] businessId=${body.businessId} slug=${finalSlug} deduplicated=${!!existingSlug} primaryStoreId=${storeId} allStores=${allStores.length}`);

    const product = await db.product.create({
      data: {
        businessId: body.businessId,
        storeId,
        categoryId: body.categoryId || null,
        name: body.name,
        slug: finalSlug,
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

    // Create inventory rows.
    // addToAllStores=true  → every active store gets a row (qty=0 for non-selected, real qty for selected).
    // addToAllStores=false → only the selected/primary store gets a row with the entered stock.
    const storesToInit = addToAllStores ? allStores : allStores.filter(s => s.id === storeId);
    if (storesToInit.length > 0) {
      const variantStockMap: Record<number, number> = {};
      if (body.variants && body.variants.length > 0) {
        body.variants.forEach((v: Record<string, unknown>, i: number) => {
          variantStockMap[i] = Number(v.stock) || 0;
        });
      }
      const minStock = 10;
      for (const s of storesToInit) {
        const isSelectedStore = s.id === storeId;
        for (let i = 0; i < product.variants.length; i++) {
          const variant = product.variants[i];
          const qty = isSelectedStore ? (variantStockMap[i] ?? Number(body.stock) ?? 0) : 0;
          const exists = await db.inventory.findFirst({
            where: { productId: product.id, variantId: variant.id, storeId: s.id },
          });
          if (!exists) {
            await db.inventory.create({
              data: {
                businessId: body.businessId,
                storeId: s.id,
                productId: product.id,
                variantId: variant.id,
                quantity: qty,
                minStock,
                maxStock: 1000,
                status: qty <= 0 ? 'OUT_OF_STOCK' : qty <= minStock ? 'LOW_STOCK' : 'IN_STOCK',
              },
            });
          }
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
    console.error(`[products/POST] error: ${message}`, error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
