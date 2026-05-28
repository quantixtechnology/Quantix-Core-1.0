// ============================================================================
// POST /api/core/storefront/auth/change-password
// Change password for an authenticated storefront customer.
// Requires: Authorization: Bearer <refreshToken>
// Body: { currentPassword, newPassword, confirmPassword }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password-utils';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[@$!%*?&\-_#^]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

async function resolveUserFromToken(authHeader: string | null): Promise<{
  userId: string; customerId: string; email: string;
} | null> {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const rt = await db.refreshToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });
  if (!rt || rt.expiresAt < new Date() || !rt.user.isActive) return null;

  const customer = await db.customer.findFirst({
    where: { userId: rt.user.id },
    select: { id: true },
  });
  if (!customer) return null;

  return { userId: rt.user.id, customerId: customer.id, email: rt.user.email };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await resolveUserFromToken(authHeader);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json() as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'currentPassword, newPassword and confirmPassword are required' },
        { status: 400 }
      );
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'New passwords do not match' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      );
    }
    const pwError = validatePassword(newPassword);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true, hasPassword: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (!user.hasPassword || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set. Use set-password first.' },
        { status: 400 }
      );
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    }

    const newHash = await hashPassword(newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: session.userId },
        data: { passwordHash: newHash },
      }),
      db.customer.update({
        where: { id: session.customerId },
        data: { mustChangePassword: false, failedLoginAttempts: 0, accountLockedUntil: null },
      }),
    ]);

    console.log(`[storefront/auth/change-password] ok userId=${session.userId} email=${session.email}`);

    await db.activityLog.create({
      data: {
        userId: session.userId,
        action: 'customer.password_changed',
        entity: 'Customer',
        entityId: session.customerId,
        details: JSON.stringify({ email: session.email }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('[storefront/auth/change-password]', error);
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 });
  }
}
