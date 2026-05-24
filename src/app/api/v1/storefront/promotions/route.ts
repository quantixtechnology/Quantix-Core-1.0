// ============================================================================
// QUANTIX API v1 — Active Promotions / Coupons for display
// GET /api/v1/storefront/promotions?businessId=&storeId=
// Public endpoint — returns display info only (no sensitive fields).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const now = new Date();

    const rows = await db.promoCode.findMany({
      where: {
        businessId,
        isActive: true,
        validFrom:  { lte: now },
        validUntil: { gte: now },
      },
      select: {
        id: true, code: true, description: true, type: true,
        value: true, minOrderAmount: true, maxDiscount: true,
        validUntil: true, usageLimit: true, usedCount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Filter exhausted promos in application layer (Prisma can't compare two columns in where)
    const promos = rows
      .filter(p => p.usageLimit == null || p.usedCount < p.usageLimit)
      .slice(0, 20)
      .map(({ usageLimit: _ul, usedCount: _uc, ...rest }) => rest);

    return NextResponse.json({ success: true, data: promos });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
