// ============================================================================
// DEBUG: GET /api/debug/store-products?businessId=<id>&storeId=<id>
//
// Compares what POS vs Product module sees for every product in a business.
// Remove this file before going to production.
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformOnly } from "@/lib/platform-guard"

export async function GET(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const storeId = searchParams.get('storeId') || undefined

  if (!businessId) {
    return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 })
  }

  // Fetch ALL products for the business — no filters
  const rawProducts = await db.product.findMany({
    where: { businessId },
    include: {
      variants: {
        select: {
          id: true,
          name: true,
          price: true,
          mrp: true,
          isDefault: true,
          isActive: true,
          sku: true,
        },
      },
      inventory: {
        select: {
          storeId: true,
          quantity: true,
          reservedQty: true,
          status: true,
        },
      },
      category: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const report = rawProducts.map((p) => {
    let images: string[] = []
    try { images = JSON.parse(p.images) } catch { /* keep empty */ }

    const inventoryAll = p.inventory
    const inventoryAtStore = storeId
      ? p.inventory.filter((inv) => inv.storeId === storeId)
      : []

    const totalStockAll = inventoryAll.reduce(
      (sum, inv) => sum + Math.max(0, inv.quantity - inv.reservedQty), 0
    )
    const totalStockAtStore = inventoryAtStore.reduce(
      (sum, inv) => sum + Math.max(0, inv.quantity - inv.reservedQty), 0
    )
    const hasInventoryAtStore = inventoryAtStore.length > 0
    const hasInventoryAnywhere = inventoryAll.length > 0

    // ── POS visibility ──────────────────────────────────────────────────────
    // POS calls productApi.list() → GET /api/core/storefront/products
    //   ?businessId=X (no storeId, no status override → API defaults to ACTIVE)
    // Then locally filters: p.status === 'ACTIVE'
    const visibleInPos = p.status === 'ACTIVE'
    const posReasonHidden = !visibleInPos ? `status=${p.status} (not ACTIVE)` : null

    // ── Products module visibility (BEFORE fix) ─────────────────────────────
    // Products module called with: status=ALL + storeId (if set)
    // With storeId: WHERE inventory.some({ storeId }) → hides products with no inventory at store
    const visibleInProductsBeforeFix = storeId ? hasInventoryAtStore : true
    const productsBeforeFixReasonHidden = !visibleInProductsBeforeFix
      ? `No inventory row at storeId=${storeId}`
      : null

    // ── Products module visibility (AFTER fix) ──────────────────────────────
    // Products module now calls: status=ALL (no storeId filter)
    // All products visible regardless of inventory
    const visibleInProductsAfterFix = true
    const productsAfterFixReasonHidden = null

    return {
      productId: p.id,
      name: p.name,
      businessId: p.businessId,
      storeId: p.storeId,
      status: p.status,
      categoryId: p.categoryId,
      category: p.category?.name ?? null,
      images,
      hasImages: images.length > 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      inventory: {
        totalStoreCount: inventoryAll.length,
        totalStockAll,
        ...(storeId ? {
          atRequestedStore: {
            storeId,
            hasRow: hasInventoryAtStore,
            rows: inventoryAtStore,
            totalStock: totalStockAtStore,
          },
        } : {}),
        allInventory: inventoryAll,
      },
      variants: p.variants,
      visibleInPos,
      posReasonHidden,
      // Before fix: storeId filter in admin products view hid products with no inventory
      visibleInProductsBeforeFix,
      productsBeforeFixReasonHidden,
      // After fix: no storeId filter → always visible in admin
      visibleInProductsAfterFix,
      productsAfterFixReasonHidden,
      mismatch: visibleInPos !== visibleInProductsBeforeFix
        ? `POS shows this, Products module (before fix) hides it — ${productsBeforeFixReasonHidden}`
        : null,
    }
  })

  const mismatched = report.filter((r) => r.mismatch)

  return NextResponse.json({
    success: true,
    summary: {
      businessId,
      storeId: storeId ?? null,
      total: report.length,
      visibleInPos: report.filter((r) => r.visibleInPos).length,
      visibleInProductsBeforeFix: report.filter((r) => r.visibleInProductsBeforeFix).length,
      visibleInProductsAfterFix: report.length,
      mismatchCount: mismatched.length,
      mismatchedProducts: mismatched.map((r) => ({
        productId: r.productId,
        name: r.name,
        status: r.status,
        mismatch: r.mismatch,
      })),
    },
    products: report,
  })
}
