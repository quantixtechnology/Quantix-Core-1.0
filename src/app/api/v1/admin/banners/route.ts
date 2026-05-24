// ============================================================================
// QUANTIX API v1 — Admin: Banner Management
// GET  /api/v1/admin/banners?businessId=
// POST /api/v1/admin/banners
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const GET = withMiddleware({ requireAuth: true })(async (req) => {
  try {
    const user = req.user!;
    const { searchParams } = new URL(req.url);
    const businessId = user.isPlatformAdmin
      ? (searchParams.get('businessId') ?? user.businessId ?? '')
      : (user.businessId ?? '');

    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });

    const banners = await db.banner.findMany({
      where: { businessId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ success: true, data: banners });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json() as {
      businessId?: string; storeId?: string; title: string; imageUrl: string;
      link?: string; sortOrder?: number; startDate?: string; endDate?: string; isActive?: boolean;
    };

    const businessId = user.isPlatformAdmin ? (body.businessId ?? user.businessId ?? '') : (user.businessId ?? '');
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId required' }, { status: 400 });
    if (!body.title)    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
    if (!body.imageUrl) return NextResponse.json({ success: false, error: 'imageUrl is required' }, { status: 400 });

    const banner = await db.banner.create({
      data: {
        businessId,
        storeId: body.storeId ?? null,
        title: body.title,
        imageUrl: body.imageUrl,
        link: body.link ?? null,
        sortOrder: body.sortOrder ?? 0,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({ success: true, data: banner, message: 'Banner created' }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});
