// ============================================================================
// Route: POST /api/core/auth/forgot-password/reset
// Reset the user's password using the resetToken issued by forgot-password/verify.
// The token is single-use and expires in 15 minutes.
// Body: { resetToken, newPassword }
// ============================================================================

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { NextResponse } from 'next/server';

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      resetToken: string;
      newPassword: string;
    };

    const { resetToken, newPassword } = body;

    if (!resetToken || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'resetToken and newPassword are required' },
        { status: 400 }
      );
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json(
        { success: false, error: strengthError },
        { status: 400 }
      );
    }

    const now = new Date();

    const tokenRecord = await db.passwordResetToken.findUnique({
      where: { token: resetToken },
      include: {
        user: {
          select: { id: true, email: true, isActive: true },
        },
      },
    });

    if (!tokenRecord || tokenRecord.expiresAt < now || tokenRecord.usedAt !== null) {
      console.log(`[AUTH FORGOT-PW] reset FAILED: token invalid/expired/used`);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 401 }
      );
    }

    if (!tokenRecord.user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    // Mark token as used + update password atomically
    await db.$transaction([
      db.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          hasPassword: true,
          authProvider: 'PASSWORD',
        },
      }),
    ]);

    console.log(`[AUTH FORGOT-PW] reset ok userId=${tokenRecord.userId} email=${tokenRecord.user.email}`);

    await db.activityLog.create({
      data: {
        userId: tokenRecord.userId,
        action: 'user.password_reset',
        entity: 'User',
        entityId: tokenRecord.userId,
        details: JSON.stringify({ email: tokenRecord.user.email }),
      },
    }).catch(() => null);

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[forgot-password/reset] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
