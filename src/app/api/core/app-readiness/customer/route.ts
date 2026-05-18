// ============================================================================
// GET /api/core/app-readiness/customer
// Returns a single store-scoped payload for the Customer App bootstrap:
//   - Store info + operating hours
//   - Business branding
//   - Active categories (scoped to store)
//   - Featured products (scoped to store inventory)
//   - Active delivery zones for the store
//   - Feature flags
// ============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const storeId    = searchParams.get('storeId')

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 })
    }

    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, name: true, slug: true, businessType: true, status: true,
        logo: true, primaryColor: true, secondaryColor: true, tagline: true,
        isOnline: true, defaultCurrency: true, defaultLocale: true, timezone: true,
        branding: true, appConfig: true,
        featureFlags: { select: { key: true, enabled: true, value: true } },
      },
    })

    if (!business || (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING')) {
      return NextResponse.json({ success: false, error: 'Business not available' }, { status: 404 })
    }

    // Resolve store — use provided storeId or fall back to main store
    const store = storeId
      ? await db.store.findFirst({
          where: { id: storeId, businessId, status: 'ACTIVE' },
          include: { storeTimings: { orderBy: { day: 'asc' } } },
        })
      : await db.store.findFirst({
          where: { businessId, isMainStore: true, status: 'ACTIVE' },
          include: { storeTimings: { orderBy: { day: 'asc' } } },
        })

    if (!store) {
      return NextResponse.json({ success: false, error: 'No active store found' }, { status: 404 })
    }

    // Fetch categories visible to this store
    const categories = await db.category.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [{ storeId: store.id }, { storeId: null }],
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, image: true, icon: true, workflowType: true, parentId: true, sortOrder: true },
    })

    // Fetch featured products with inventory at this store
    const featuredProducts = await db.product.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        isFeatured: true,
        inventory: { some: { storeId: store.id, status: { not: 'DISCONTINUED' } } },
      },
      take: 20,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true } },
        variants:  { where: { isActive: true }, select: { id: true, name: true, price: true, mrp: true, isDefault: true } },
        inventory: { where: { storeId: store.id }, select: { quantity: true, reservedQty: true, status: true } },
      },
    })

    // Active delivery zones
    const deliveryZones = await db.deliveryZone.findMany({
      where: { businessId, storeId: store.id, isActive: true },
      select: { id: true, name: true, zoneType: true, radius: true, polygon: true, pincodes: true, deliveryFee: true, minOrderAmount: true, estimatedTime: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        business: {
          id:              business.id,
          name:            business.name,
          slug:            business.slug,
          businessType:    business.businessType,
          isOnline:        business.isOnline,
          logo:            business.logo,
          primaryColor:    business.primaryColor,
          secondaryColor:  business.secondaryColor,
          tagline:         business.tagline,
          currency:        business.defaultCurrency,
          locale:          business.defaultLocale,
          timezone:        business.timezone,
          branding:        business.branding,
          appConfig:       business.appConfig,
        },
        store: {
          id:              store.id,
          name:            store.name,
          slug:            store.slug,
          address:         store.address,
          city:            store.city,
          phone:           store.phone,
          email:           store.email,
          deliveryRadius:  store.deliveryRadius,
          deliveryFee:     store.deliveryFee,
          minOrderAmount:  store.minOrderAmount,
          preparationTime: store.preparationTime,
          storeTimings:    store.storeTimings,
        },
        categories,
        featuredProducts: featuredProducts.map(p => ({
          id:         p.id,
          name:       p.name,
          slug:       p.slug,
          images:     JSON.parse(p.images || '[]') as string[],
          category:   p.category,
          variants:   p.variants,
          stockStatus: p.inventory[0]?.status ?? 'OUT_OF_STOCK',
          availableQty: Math.max(0, (p.inventory[0]?.quantity ?? 0) - (p.inventory[0]?.reservedQty ?? 0)),
        })),
        deliveryZones,
        featureFlags: Object.fromEntries(
          (business.featureFlags ?? []).map(f => [f.key, f.enabled])
        ),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load customer app data'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
