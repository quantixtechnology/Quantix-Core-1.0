// ============================================================================
// QUANTIX API v1 — Storefront Banners (public)
// GET /api/v1/storefront/banners?businessId=&storeId=
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const storeId    = searchParams.get('storeId') ?? undefined;

    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const now = new Date();

    const banners = await db.banner.findMany({
      where: {
        businessId,
        isActive: true,
        OR: [{ storeId: null }, ...(storeId ? [{ storeId }] : [])],
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, title: true, imageUrl: true, link: true,
        sortOrder: true, startDate: true, endDate: true,
      },
    });

    return NextResponse.json({ success: true, data: banners });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
