// ============================================================================
// POST /api/core/storefront/auth/reset-password-via-token
// Reset User password using the token from forgot-password email link.
// Token is stored on PasswordResetToken model (User-level), single-use.
// After reset, creates a session and resolves/creates the Customer record.
// Body: { token, password, confirmPassword, businessId }
// Returns: session (auto-login after reset)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { createStorefrontSession } from '@/lib/storefront-auth';
import { resolveBusinessIdFromRequest } from '@/lib/tenant-resolver';
import crypto from 'crypto';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
      businessId?: string;
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

    // Resolve businessId for Customer session creation
    const hostnameBusinessId = await resolveBusinessIdFromRequest(request);
    const businessId = hostnameBusinessId || body.businessId;
    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });
    }

    // Look up the PasswordResetToken by hashed token
    const hashedToken = hashToken(token);
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: hashedToken },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid reset token' },
        { status: 401 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { success: false, error: 'This reset link has already been used' },
        { status: 401 }
      );
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Reset token has expired' },
        { status: 401 }
      );
    }

    // Validate the User exists and is active
    const user = await db.user.findUnique({
      where: { id: resetToken.userId },
      select: { id: true, email: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is disabled or not found' },
        { status: 403 }
      );
    }

    // Update User password
    const passwordHash = await hashPassword(password);
    const now = new Date();

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        hasPassword: true,
        passwordChangedAt: now,
        lastLoginAt: now,
        authProvider: 'EMAIL_OTP',
      },
    });

    // Invalidate the token (single-use)
    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now },
    });

    // Invalidate all existing refresh tokens for security
    await db.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Log activity
    await db.activityLog.create({
      data: {
        userId: user.id,
        action: 'user.password_reset',
        entity: 'User',
        entityId: user.id,
        details: JSON.stringify({ email: user.email }),
      },
    }).catch(() => null);

    // Create a session (finds/creates Customer record for this business)
    const session = await createStorefrontSession({
      email: user.email,
      phone: '',
      name: user.email.split('@')[0],
      businessId,
      emailVerified: true,
    });

    console.log(`[storefront/auth/reset-password-via-token] ok userId=${user.id} email=${user.email}`);

    return NextResponse.json({ success: true, message: 'Password reset successfully', data: session });
  } catch (error) {
    console.error('[storefront/auth/reset-password-via-token]', error);
    return NextResponse.json({ success: false, error: 'Password reset failed' }, { status: 500 });
  }
}
