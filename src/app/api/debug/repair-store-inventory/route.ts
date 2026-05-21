// ============================================================================
// DEBUG: POST /api/debug/repair-store-inventory?businessId=<id>
//
// Backfills missing Inventory rows for every product × store × variant
// combination in a business. Products that were created before the "create
// inventory for all stores" fix would be missing rows at some stores, causing
// them to disappear from the store-scoped admin product list.
//
// Safe to run multiple times — uses findFirst before create (idempotent).
// Remove or gate behind platform-admin auth before full production.
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 })
  }

  // Fetch all active stores for the business
  const stores = await db.store.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, name: true, storeCode: true },
  })

  if (stores.length === 0) {
    return NextResponse.json({ success: false, error: 'No active stores found for this business' }, { status: 404 })
  }

  // Fetch all products with their variants
  const products = await db.product.findMany({
    where: { businessId },
    include: {
      variants: { select: { id: true, name: true, isDefault: true } },
      inventory: { select: { storeId: true, variantId: true } },
    },
  })

  const created: {
    productId: string
    productName: string
    storeId: string
    storeName: string
    variantId: string
    variantName: string
  }[] = []

  const skipped: {
    productId: string
    productName: string
    storeId: string
    storeName: string
    variantId: string
    reason: string
  }[] = []

  const minStock = 10

  for (const product of products) {
    if (product.variants.length === 0) {
      skipped.push({
        productId: product.id,
        productName: product.name,
        storeId: 'all',
        storeName: 'all',
        variantId: 'none',
        reason: 'No variants',
      })
      continue
    }

    // Build a Set of existing inventory keys for quick lookup
    const existingKeys = new Set(
      product.inventory.map((inv) => `${inv.storeId}::${inv.variantId}`)
    )

    for (const store of stores) {
      for (const variant of product.variants) {
        const key = `${store.id}::${variant.id}`
        if (existingKeys.has(key)) {
          // Already exists — skip
          continue
        }

        // Create missing inventory row with qty=0
        await db.inventory.create({
          data: {
            businessId,
            storeId: store.id,
            productId: product.id,
            variantId: variant.id,
            quantity: 0,
            minStock,
            maxStock: 1000,
            status: 'OUT_OF_STOCK',
          },
        })

        created.push({
          productId: product.id,
          productName: product.name,
          storeId: store.id,
          storeName: store.name,
          variantId: variant.id,
          variantName: variant.name,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      businessId,
      storesChecked: stores.length,
      productsChecked: products.length,
      inventoryRowsCreated: created.length,
      inventoryRowsSkipped: skipped.length,
    },
    stores,
    created,
    skipped,
  })
}
