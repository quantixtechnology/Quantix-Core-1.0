// ============================================================================
// POST /api/debug/repair-missing-inventory?businessId=<uuid|businessCode>
//
// Backfills missing Inventory rows for every product × store × variant in a
// business. Run this after migrating to the business-level products architecture
// so all existing products have an inventory row at every store (qty=0).
//
// Accepts: ?businessId=<uuid> OR ?businessId=BUS-XXXXXX (businessCode)
// Idempotent — safe to run multiple times.
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformOnly } from "@/lib/platform-guard"

export async function POST(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  const { searchParams } = new URL(request.url)
  const rawId = searchParams.get('businessId') || searchParams.get('businessCode')

  if (!rawId) {
    return NextResponse.json(
      { success: false, error: 'businessId or businessCode is required' },
      { status: 400 }
    )
  }

  const business = await db.business.findFirst({
    where: rawId.startsWith('BUS-') ? { businessCode: rawId } : { id: rawId },
    select: { id: true, businessCode: true, name: true },
  })
  if (!business) {
    return NextResponse.json(
      { success: false, error: `Business not found: ${rawId}` },
      { status: 404 }
    )
  }
  const businessId = business.id

  const stores = await db.store.findMany({
    where: { businessId, status: 'ACTIVE' },
    select: { id: true, name: true, storeCode: true },
  })
  if (stores.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No active stores found for this business' },
      { status: 404 }
    )
  }

  const products = await db.product.findMany({
    where: { businessId },
    include: {
      variants: { select: { id: true, name: true } },
      inventory: { select: { storeId: true, variantId: true } },
    },
  })

  const created: {
    product: string
    store: string
    variant: string
  }[] = []

  const minStock = 10

  for (const product of products) {
    if (product.variants.length === 0) continue

    const existingKeys = new Set(
      product.inventory.map((inv) => `${inv.storeId}::${inv.variantId}`)
    )

    for (const store of stores) {
      for (const variant of product.variants) {
        const key = `${store.id}::${variant.id}`
        if (existingKeys.has(key)) continue

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
          product: product.name,
          store: store.name,
          variant: variant.name,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      business: business.name,
      businessCode: business.businessCode,
      businessId,
      storesChecked: stores.length,
      productsChecked: products.length,
      inventoryRowsCreated: created.length,
    },
    created,
  })
}
