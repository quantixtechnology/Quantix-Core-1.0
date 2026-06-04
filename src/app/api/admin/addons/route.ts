// ============================================================================
// GET /api/admin/addons — platform-wide add-ons list across all businesses
// Supports filters: status, billingType, businessId, search
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';

export const GET = withMiddleware({
  requireAuth: true,
  requiredPermission: 'subscriptions:view',
})(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? '';
    const billingType = searchParams.get('billingType') ?? '';
    const businessId = searchParams.get('businessId') ?? '';
    const search = searchParams.get('search') ?? '';
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (billingType) where.billingType = billingType;
    if (businessId) where.businessId = businessId;
    if (search) where.name = { contains: search };

    const [addons, total] = await Promise.all([
      db.addon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          business: {
            select: { id: true, name: true, slug: true, businessType: true },
          },
        },
      }),
      db.addon.count({ where }),
    ]);

    // Stats
    const [activeCount, recurringTotal, oneTimeTotal] = await Promise.all([
      db.addon.count({ where: { status: 'ACTIVE' } }),
      db.addon.aggregate({ where: { status: 'ACTIVE', billingType: 'RECURRING' }, _sum: { amount: true }, _count: { id: true } }),
      db.addon.aggregate({ where: { status: 'ACTIVE', billingType: 'ONE_TIME' }, _sum: { amount: true }, _count: { id: true } }),
    ]);

    return NextResponse.json({
      success: true,
      data: addons,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        activeCount,
        recurringMonthlyValue: recurringTotal._sum.amount ?? 0,
        recurringCount: recurringTotal._count.id,
        pendingOneTimeCount: oneTimeTotal._count.id,
        pendingOneTimeValue: oneTimeTotal._sum.amount ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch add-ons';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
