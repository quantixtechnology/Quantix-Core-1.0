// ============================================================================
// POST /api/core/storefront/auth/reset-password-via-token
// Reset customer password using the token from forgot-password email link.
// Token is stored on Customer record, single-use (cleared after use).
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

    const customer = await db.customer.findFirst({
      where: { passwordResetToken: token },
      select: {
        id: true, businessId: true, name: true, email: true, phone: true,
        passwordResetTokenExpiry: true, isLoginDisabled: true, userId: true,
      },
    });

    if (
      !customer ||
      !customer.passwordResetTokenExpiry ||
      customer.passwordResetTokenExpiry < new Date()
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 401 }
      );
    }

    if (customer.isLoginDisabled) {
      return NextResponse.json({ success: false, error: 'Account is disabled.' }, { status: 403 });
    }

    if (!customer.email) {
      return NextResponse.json({ success: false, error: 'Customer email not found' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    await db.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash,
        isPasswordSet: true,
        passwordUpdatedAt: now,
        lastPasswordResetAt: now,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    console.log(`[storefront/auth/reset-password-via-token] ok customerId=${customer.id} email=${customer.email}`);

    if (customer.userId) {
      await db.activityLog.create({
        data: {
          userId: customer.userId,
          action: 'customer.password_reset',
          entity: 'Customer',
          entityId: customer.id,
          details: JSON.stringify({ email: customer.email, businessId: customer.businessId }),
        },
      }).catch(() => null);
    }

    const session = await createStorefrontSession({
      email: customer.email,
      phone: customer.phone || '',
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
