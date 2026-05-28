// ============================================================================
// POST /api/core/businesses/[businessId]/customers/[customerId]/reset-password
// Admin: set a temporary password for a customer (Option B).
// Forces the customer to change it on next login (mustChangePassword=true).
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

    const user = req.user!;
    const allowedRoles = ['CLIENT_OWNER', 'STORE_MANAGER', 'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN'];
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (!user.isPlatformAdmin && !allowedRoles.includes(user.role)) {
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
      select: { id: true, userId: true, email: true, name: true },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    if (!customer.userId) {
      return NextResponse.json(
        { success: false, error: 'Customer has no linked account. Ask them to login via OTP first.' },
        { status: 400 }
      );
    }

    const linkedUser = await db.user.findUnique({
      where: { id: customer.userId },
      select: { id: true, isActive: true },
    });
    if (!linkedUser?.isActive) {
      return NextResponse.json({ success: false, error: 'Customer account is inactive' }, { status: 400 });
    }

    const passwordHash = await hashPassword(temporaryPassword);

    await db.$transaction([
      db.user.update({
        where: { id: customer.userId },
        data: { passwordHash, hasPassword: true, authProvider: 'PASSWORD' },
      }),
      db.customer.update({
        where: { id: customer.id },
        data: {
          isPasswordSet: true,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          accountLockedUntil: null,
        },
      }),
    ]);

    console.log(
      `[admin/customers/reset-password] adminId=${user.id} customerId=${customerId} businessId=${businessId} mustChangePassword=true`
    );

    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'admin.customer_password_reset',
        entity: 'Customer',
        entityId: customerId,
        details: JSON.stringify({ businessId, customerEmail: customer.email }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: 'Temporary password set. Customer will be required to change it on next login.',
    });
  } catch (error) {
    console.error('[admin/customers/reset-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to reset password' }, { status: 500 });
  }
});
