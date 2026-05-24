// ============================================================================
// QUANTIX API v1 — Admin: Banner CRUD
// PATCH /api/v1/admin/banners/:bannerId
// DELETE /api/v1/admin/banners/:bannerId
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const user = req.user!;
    const params = await context?.params;
    const bannerId = params?.bannerId as string;
    if (!bannerId) return NextResponse.json({ success: false, error: 'bannerId required' }, { status: 400 });

    const existing = await db.banner.findUnique({ where: { id: bannerId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Banner not found' }, { status: 404 });

    if (!user.isPlatformAdmin && existing.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as {
      title?: string; imageUrl?: string; link?: string | null;
      sortOrder?: number; startDate?: string | null; endDate?: string | null;
      isActive?: boolean; storeId?: string | null;
    };

    const banner = await db.banner.update({
      where: { id: bannerId },
      data: {
        ...(body.title      !== undefined && { title: body.title }),
        ...(body.imageUrl   !== undefined && { imageUrl: body.imageUrl }),
        ...(body.link       !== undefined && { link: body.link }),
        ...(body.sortOrder  !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive   !== undefined && { isActive: body.isActive }),
        ...(body.storeId    !== undefined && { storeId: body.storeId }),
        ...(body.startDate  !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate    !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      },
    });

    return NextResponse.json({ success: true, data: banner });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});

export const DELETE = withMiddleware({
  requireAuth: true,
  requiredRoles: ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const user = req.user!;
    const params = await context?.params;
    const bannerId = params?.bannerId as string;
    if (!bannerId) return NextResponse.json({ success: false, error: 'bannerId required' }, { status: 400 });

    const existing = await db.banner.findUnique({ where: { id: bannerId } });
    if (!existing) return NextResponse.json({ success: false, error: 'Banner not found' }, { status: 404 });

    if (!user.isPlatformAdmin && existing.businessId !== user.businessId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await db.banner.delete({ where: { id: bannerId } });
    return NextResponse.json({ success: true, message: 'Banner deleted' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
});
