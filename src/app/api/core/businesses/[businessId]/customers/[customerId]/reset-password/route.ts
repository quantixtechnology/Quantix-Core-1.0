// ============================================================================
// POST /api/core/businesses/[businessId]/customers/[customerId]/reset-password
// Admin: set a temporary password on the Customer record directly.
// Forces customer to change it on next login (mustChangePassword=true).
// Requires: CLIENT_OWNER or STORE_MANAGER role for this business.
// Body: { temporaryPassword }
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  return null;
}

export const POST = withMiddleware({ requireAuth: true })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    const customerId = params?.customerId as string;

    if (!businessId || !customerId) {
      return NextResponse.json({ success: false, error: 'businessId and customerId are required' }, { status: 400 });
    }

    const actor = req.user!;
    const allowedRoles = ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'];
    if (!actor.isPlatformAdmin && actor.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (!actor.isPlatformAdmin && !allowedRoles.includes(actor.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json() as { temporaryPassword: string };
    const { temporaryPassword } = body;

    if (!temporaryPassword) {
      return NextResponse.json({ success: false, error: 'temporaryPassword is required' }, { status: 400 });
    }
    const pwError = validatePassword(temporaryPassword);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    const customer = await db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, email: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const passwordHash = await hashPassword(temporaryPassword);
    const now = new Date();

    await db.customer.update({
      where: { id: customerId },
      data: {
        passwordHash,
        isPasswordSet: true,
        passwordUpdatedAt: now,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    console.log(
      `[admin/customers/reset-password] actorId=${actor.id} customerId=${customerId} businessId=${businessId} mustChangePassword=true`
    );

    await db.activityLog.create({
      data: {
        userId: actor.id,
        action: 'admin.customer_password_reset',
        entity: 'Customer',
        entityId: customerId,
        details: JSON.stringify({ businessId, customerEmail: customer.email }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: 'Temporary password set. Customer must change it on next login.',
    });
  } catch (error) {
    console.error('[admin/customers/reset-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 });
  }
});
