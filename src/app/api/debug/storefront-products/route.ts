// GET /api/debug/storefront-products?slug=arbazchicken
// Full product retrieval chain diagnostic.
// Remove this file after product loading is confirmed working.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug param required' }, { status: 400 })
  }

  try {
    // ── Step 1: resolve business ──────────────────────────────────────────
    const business = await db.business.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, businessType: true, status: true, isOnline: true },
    })

    if (!business) {
      return NextResponse.json({
        slug,
        businessFound: false,
        error: `No business with slug="${slug}"`,
      })
    }

    // ── Step 2: resolve active store ──────────────────────────────────────
    const store = await db.store.findFirst({
      where: { businessId: business.id, status: 'ACTIVE' },
      orderBy: [{ isMainStore: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, isMainStore: true, status: true },
    })

    // ── Step 3: raw product counts ────────────────────────────────────────
    const countAll = await db.product.count({
      where: { businessId: business.id },
    })

    const countActive = await db.product.count({
      where: { businessId: business.id, status: 'ACTIVE' },
    })

    // Products with variants
    const countWithVariants = await db.product.count({
      where: {
        businessId: business.id,
        status: 'ACTIVE',
        variants: { some: { isActive: true } },
      },
    })

    // Products with inventory at the active store
    const countWithInventory = store
      ? await db.product.count({
          where: {
            businessId: business.id,
            status: 'ACTIVE',
            inventory: { some: { storeId: store.id } },
          },
        })
      : null

    // ── Step 4: sample products (up to 10) ───────────────────────────────
    const products = await db.product.findMany({
      where: { businessId: business.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        storeId: true,
        businessId: true,
        workflowType: true,
        isFeatured: true,
        isPopular: true,
        categoryId: true,
        variants: {
          select: { id: true, name: true, price: true, isDefault: true, isActive: true },
        },
        inventory: {
          select: { storeId: true, quantity: true, status: true },
        },
      },
    })

    // ── Step 5: storefront API simulation ────────────────────────────────
    // Mimics exactly what the storefront does: businessId + status ACTIVE, no storeId
    const storefrontProducts = await db.product.findMany({
      where: { businessId: business.id, status: 'ACTIVE' },
      take: 20,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        status: true,
        workflowType: true,
        isFeatured: true,
        variants: { select: { id: true, name: true, price: true, isActive: true } },
      },
    })

    console.log('[debug/storefront-products]', {
      slug,
      businessId: business.id,
      storeId: store?.id,
      countAll,
      countActive,
      countWithVariants,
      countWithInventory,
      storefrontProductCount: storefrontProducts.length,
    })

    return NextResponse.json({
      slug,
      businessFound: true,
      businessId: business.id,
      businessName: business.name,
      businessType: business.businessType,
      businessStatus: business.status,
      storeFound: !!store,
      storeId: store?.id || null,
      storeName: store?.name || null,
      isMainStore: store?.isMainStore ?? null,
      counts: {
        all: countAll,
        active: countActive,
        activeWithVariants: countWithVariants,
        activeWithInventoryAtStore: countWithInventory,
      },
      storefrontQuery: {
        filter: { businessId: business.id, status: 'ACTIVE' },
        results: storefrontProducts.length,
        products: storefrontProducts,
      },
      allProductsSample: products.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        businessId: p.businessId,
        storeId: p.storeId,
        workflowType: p.workflowType,
        isFeatured: p.isFeatured,
        categoryId: p.categoryId,
        variantCount: p.variants.length,
        activeVariantCount: p.variants.filter((v) => v.isActive).length,
        inventoryAtStore: store
          ? p.inventory.filter((i) => i.storeId === store.id).length
          : 0,
        inventoryTotal: p.inventory.length,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
