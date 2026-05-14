// ============================================================================
// POST /api/core/auth/change-password
// Self-service password change — requires current password to verify identity.
// Any authenticated user can change their own password.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, hashPassword } from '@/lib/password-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      userId: string;
      currentPassword: string;
      newPassword: string;
    };

    const { userId, currentPassword, newPassword } = body;

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'userId, currentPassword, and newPassword are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'No password set on this account. Contact your administrator.' },
        { status: 400 }
      );
    }

    // Verify current password before allowing change
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, authProvider: 'PASSWORD' },
    });

    await db.activityLog.create({
      data: {
        businessId: 'platform',
        action: 'user.password_changed',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({ email: user.email, changedBy: 'self' }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to change password';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
