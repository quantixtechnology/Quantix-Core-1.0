// ============================================================================
// PATCH /api/admin/businesses/[businessId]/update-login-id
// Updates the loginId for a business owner or store user.
// Super Admin only — business owners cannot modify their own loginId.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withMiddleware } from '@/lib/middleware';

export const PATCH = withMiddleware({
  requireAuth: true,
  requiredRoles: ['QUANTIX_SUPER_ADMIN'],
})(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    const body = await req.json();
    const { userId, newLoginId, userType } = body as {
      userId: string;
      newLoginId: string;
      userType?: 'owner' | 'store';
    };

    if (!userId || !newLoginId) {
      return NextResponse.json({ success: false, error: 'userId and newLoginId are required' }, { status: 400 });
    }

    const cleanLoginId = newLoginId.trim().toLowerCase();
    if (cleanLoginId.length < 3) {
      return NextResponse.json({ success: false, error: 'Login ID must be at least 3 characters' }, { status: 400 });
    }
    if (!/^[a-z0-9@._-]+$/.test(cleanLoginId)) {
      return NextResponse.json(
        { success: false, error: 'Login ID may only contain letters, numbers, @, ., _ or -' },
        { status: 400 }
      );
    }

    // Verify user belongs to this business
    const bu = await db.businessUser.findFirst({
      where: { userId, businessId, isActive: true },
    });
    if (!bu) {
      return NextResponse.json({ success: false, error: 'User not found in this business' }, { status: 404 });
    }

    // Check loginId uniqueness
    const existing = await db.user.findUnique({ where: { loginId: cleanLoginId } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ success: false, error: `Login ID "${cleanLoginId}" is already taken` }, { status: 409 });
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: { loginId: cleanLoginId },
      select: { id: true, email: true, loginId: true, name: true },
    });

    await db.activityLog.create({
      data: {
        businessId,
        action: 'user.login_id_updated',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({ newLoginId: cleanLoginId, userType: userType || 'unknown', changedBy: req.user?.email }),
      },
    });

    return NextResponse.json({
      success: true,
      data: { loginId: updated.loginId, email: updated.email },
      message: 'Login ID updated successfully',
    });
  } catch (error) {
    console.error('[update-login-id] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update login ID' },
      { status: 500 }
    );
  }
});
