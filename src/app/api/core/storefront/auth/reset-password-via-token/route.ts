// ============================================================================
// POST /api/core/storefront/auth/reset-password-via-token
// Reset password using a token from the forgot-password email link.
// Token is single-use and expires in 15 minutes.
// Body: { token, password, confirmPassword }
// Returns: session (auto-login after reset)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { createStorefrontSession } from '@/lib/storefront-auth';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[@$!%*?&\-_#^]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      token: string;
      password: string;
      confirmPassword: string;
    };

    const { token, password, confirmPassword } = body;

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'token, password and confirmPassword are required' },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'Passwords do not match' }, { status: 400 });
    }
    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    const now = new Date();
    const tokenRecord = await db.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: { id: true, email: true, phone: true, isActive: true },
        },
      },
    });

    if (!tokenRecord || tokenRecord.expiresAt < now || tokenRecord.usedAt !== null) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 401 }
      );
    }
    if (!tokenRecord.user.isActive) {
      return NextResponse.json({ success: false, error: 'Account is deactivated' }, { status: 403 });
    }

    const passwordHash = await hashPassword(password);

    // Resolve the customer to find businessId for session creation
    const customer = await db.customer.findFirst({
      where: { userId: tokenRecord.userId },
      select: { id: true, businessId: true, name: true, phone: true, isPasswordSet: true },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    // Mark token used + update password + update customer atomically
    await db.$transaction([
      db.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash, hasPassword: true, authProvider: 'PASSWORD' },
      }),
      db.customer.update({
        where: { id: customer.id },
        data: { isPasswordSet: true, mustChangePassword: false, failedLoginAttempts: 0, accountLockedUntil: null },
      }),
    ]);

    console.log(`[storefront/auth/reset-password-via-token] ok userId=${tokenRecord.userId} email=${tokenRecord.user.email}`);

    await db.activityLog.create({
      data: {
        userId: tokenRecord.userId,
        action: 'customer.password_reset',
        entity: 'Customer',
        entityId: customer.id,
        details: JSON.stringify({ email: tokenRecord.user.email, businessId: customer.businessId }),
      },
    }).catch(() => null);

    // Auto-login: create a fresh session
    const session = await createStorefrontSession({
      email: tokenRecord.user.email,
      phone: tokenRecord.user.phone || customer.phone || '',
      name: customer.name,
      businessId: customer.businessId,
      emailVerified: true,
    });

    return NextResponse.json({ success: true, message: 'Password reset successfully', data: session });
  } catch (error) {
    console.error('[storefront/auth/reset-password-via-token]', error);
    return NextResponse.json({ success: false, error: 'Password reset failed' }, { status: 500 });
  }
}
