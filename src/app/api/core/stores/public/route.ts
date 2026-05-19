// ============================================================================
// QUANTIX CORE — Public Stores API
// GET /api/core/stores/public?slug=freshmart
//
// Customer-facing. No auth required.
// Returns ACTIVE stores for the given tenant slug.
// Sorted by business creation date (newest first).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const GET = async (req: Request) => {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug query parameter is required' },
        { status: 400 }
      );
    }

    const business = await db.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        businessCode: true,
        logo: true,
        businessType: true,
        status: true,
        createdAt: true,
      },
    });

    if (!business || (business.status !== 'ACTIVE' && business.status !== 'ONBOARDING')) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const stores = await db.store.findMany({
      where: { businessId: business.id, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        isMainStore: true,
        phone: true,
        address: true,
        city: true,
      },
      orderBy: [{ isMainStore: 'desc' }, { name: 'asc' }],
    });

    const data = stores.map((store) => ({
      id: store.id,
      businessId: business.id,
      tenantSlug: business.slug,
      businessCode: business.businessCode,
      name: store.name,
      slug: store.slug,
      logo: business.logo,
      businessType: business.businessType,
      phone: store.phone,
      address: store.address,
      city: store.city,
      isMainStore: store.isMainStore,
    }));

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load stores';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
};
