// ============================================================================
// GET /api/core/app-readiness/pos
// Returns the POS App bootstrap payload for a given store:
//   - Store config (printer, paper size, operating hours)
//   - Active POS session (if any)
//   - Product catalogue with real-time inventory quantities
//   - Tax configs applicable to this store
//   - Payment methods (from PaymentGateway)
//   - Feature flags
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!
    const { searchParams } = new URL(req.url)
    const storeId    = searchParams.get('storeId')
    const businessId = searchParams.get('businessId') ?? user.businessId

    if (!businessId) return createErrorResponse('businessId is required', 400)
    if (!storeId)    return createErrorResponse('storeId is required',    400)

    const { db } = await import('@/lib/db')

    const store = await db.store.findFirst({
      where: { id: storeId, businessId, status: 'ACTIVE' },
      include: { storeTimings: { orderBy: { day: 'asc' } } },
    })

    if (!store) return createErrorResponse('Store not found or not active', 404)

    const [activeSession, products, taxConfigs, paymentGateways, featureFlags] = await Promise.all([
      db.pOSSession.findFirst({
        where: { storeId, businessId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      }),

      db.product.findMany({
        where: {
          businessId,
          status: 'ACTIVE',
          inventory: { some: { storeId, status: { not: 'DISCONTINUED' } } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          category: { select: { id: true, name: true } },
          variants:  { where: { isActive: true }, select: { id: true, name: true, price: true, mrp: true, sku: true, barcode: true, isDefault: true, attributes: true } },
          inventory: { where: { storeId }, select: { quantity: true, reservedQty: true, status: true, minStock: true } },
        },
      }),

      db.taxConfig.findMany({
        where: { businessId, isActive: true, OR: [{ storeId }, { storeId: null }] },
        orderBy: { rate: 'asc' },
      }),

      db.paymentGateway.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, gateway: true, isTestMode: true },
      }),

      db.featureFlag.findMany({
        where: { businessId },
        select: { key: true, enabled: true, value: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        store: {
          id:             store.id,
          name:           store.name,
          storeCode:      store.storeCode,
          posEnabled:     store.posEnabled,
          printerType:    store.printerType,
          paperSize:      store.paperSize,
          printerConfig:  JSON.parse(store.printerConfig || '{}') as Record<string, unknown>,
          operatingHours: JSON.parse(store.operatingHours || '{}') as Record<string, unknown>,
          storeTimings:   store.storeTimings,
        },
        activeSession,
        products: products.map(p => ({
          id:         p.id,
          name:       p.name,
          sku:        p.sku,
          barcode:    p.barcode,
          images:     JSON.parse(p.images || '[]') as string[],
          isVeg:      p.isVeg,
          category:   p.category,
          variants:   p.variants.map(v => ({
            ...v,
            attributes: JSON.parse(v.attributes || '{}') as Record<string, string>,
          })),
          inventory: p.inventory[0] ?? null,
          stockStatus: p.inventory[0]?.status ?? 'OUT_OF_STOCK',
          availableQty: Math.max(0, (p.inventory[0]?.quantity ?? 0) - (p.inventory[0]?.reservedQty ?? 0)),
        })),
        taxConfigs,
        paymentMethods: paymentGateways,
        featureFlags: Object.fromEntries(featureFlags.map(f => [f.key, f.enabled])),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load POS app data'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
