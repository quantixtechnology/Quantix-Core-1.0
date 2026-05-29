// ============================================================================
// POST /api/core/delivery/auth/change-password
// Self-service password change for an authenticated delivery partner.
// Requires DELIVERY_STAFF role and verifies the current password before update.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password-utils';

export const POST = withMiddleware({
  requireAuth: true,
  requiredRoles: ['DELIVERY_STAFF'],
})(async (req) => {
  try {
    const user = req.user!;
    const body = await req.json() as { currentPassword: string; newPassword: string };
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'currentPassword and newPassword are required' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!dbUser || !dbUser.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set on this account. Contact your administrator.' },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    const hash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, hasPassword: true, authProvider: 'PASSWORD' },
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to change password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
