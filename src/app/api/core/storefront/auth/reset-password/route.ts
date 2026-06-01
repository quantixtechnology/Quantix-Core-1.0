// ============================================================================
// POST /api/core/storefront/auth/reset-password
// Verify OTP + set new password on User account → auto-login
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { createStorefrontSession, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(pw)) return 'Must contain at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Must contain at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Must contain at least one number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Must contain at least one special character';
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      code: string;
      password: string;
      businessId: string;
      storeId?: string;
      phone?: string;
    };

    const email = normalizeEmail(body.email || '');
    const phone = normalizePhone(body.phone || '');
    const { code, password, businessId, storeId } = body;

    if (!email || !code || !password || !businessId) {
      return NextResponse.json(
        { success: false, error: 'email, code, password and businessId are required' },
        { status: 400 }
      );
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ success: false, error: pwError }, { status: 400 });
    }

    // Verify OTP
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        email,
        code,
        channel: 'EMAIL_OTP',
        isVerified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification code' },
        { status: 401 }
      );
    }

    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // Set password on User (shared across all storefronts for this email)
    const passwordHash = await hashPassword(password);
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerified: true, lastLoginAt: new Date() },
      });
    }

    // Sync the new hash to this business's Customer record so login-password
    // can verify it directly without a User table lookup, and so check-customer
    // immediately returns hasPassword: true for this storefront.
    const customer = await db.customer.findFirst({
      where: { businessId, email },
      select: { id: true, name: true, phone: true },
    });
    if (customer?.id) {
      await db.customer.update({
        where: { id: customer.id },
        data:  { passwordHash, isPasswordSet: true },
      });
    }

    const name = customer?.name || email.split('@')[0];
    const resolvedPhone = phone || customer?.phone || '';

    const session = await createStorefrontSession({
      email,
      phone: resolvedPhone,
      name,
      businessId,
      storeId,
      emailVerified: true,
    });

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Password set successfully',
    });
  } catch (error) {
    console.error('[storefront/auth/reset-password]', error);
    return NextResponse.json({ success: false, error: 'Password reset failed' }, { status: 500 });
  }
}
