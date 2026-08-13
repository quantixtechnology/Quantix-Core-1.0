// GET /api/debug/storefront?slug=arbazchicken
// Diagnostic endpoint — validates full storefront resolution chain.
// Remove this file after routing is confirmed working.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { platformOnly } from "@/lib/platform-guard"

export async function GET(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug param required — e.g. /api/debug/storefront?slug=arbazchicken' }, { status: 400 })
  }

  try {
    const business = await db.business.findUnique({
      where: { slug },
      select: {
        id: true, name: true, slug: true, businessType: true,
        status: true, isOnline: true, primaryColor: true,
      },
    })

    if (!business) {
      return NextResponse.json({
        businessFound: false,
        slug,
        message: `No business with slug="${slug}" exists in the database.`,
        routingDetected: false,
      })
    }

    const store = await db.store.findFirst({
      where: { businessId: business.id, status: 'ACTIVE' },
      select: { id: true, name: true, isMainStore: true, status: true },
    })

    const categoryCount = await db.category.count({
      where: { businessId: business.id, isActive: true },
    })

    const productCount = await db.product.count({
      where: { businessId: business.id, status: 'ACTIVE' },
    })

    const storefrontBase = process.env.NEXT_PUBLIC_STOREFRONT_DOMAIN || 'quantixtechnology.in'

    return NextResponse.json({
      routingDetected: true,
      businessFound: true,
      businessId: business.id,
      businessName: business.name,
      slug: business.slug,
      type: business.businessType,
      status: business.status,
      isOnline: business.isOnline,
      theme: business.primaryColor,
      storeFound: !!store,
      storeId: store?.id || null,
      storeName: store?.name || null,
      isMainStore: store?.isMainStore ?? null,
      categoryCount,
      productCount,
      expectedSubdomain: `${slug}.${storefrontBase}`,
      env: {
        NEXT_PUBLIC_STOREFRONT_DOMAIN: storefrontBase,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
