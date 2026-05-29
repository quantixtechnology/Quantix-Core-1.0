// ============================================================================
// POST /api/customer/auth/verify-otp
// Mobile customer: verify email OTP and create session.
// Returns FLAT response (not nested in data{}) — mobile routing depends on it.
//
// Request:  { email, code, businessId, name?, phone?, storeId? }
// Response: { success, token, refreshToken, user, customerId, isPasswordSet,
//             mustChangePassword, businesses }
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStorefrontSession, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      phone?: string;
      code: string;
      name?: string;
      businessId: string;
      storeId?: string;
    };

    const email = normalizeEmail(body.email || '');
    const phone = normalizePhone(body.phone || '');
    const { code, businessId, storeId } = body;
    const name = body.name?.trim() || email.split('@')[0];

    if (!email || !code || !businessId) {
      return NextResponse.json(
        { success: false, error: 'email, code and businessId are required' },
        { status: 400 }
      );
    }

    // Verify OTP
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        email, code, channel: 'EMAIL_OTP',
        isVerified: false, expiresAt: { gte: new Date() },
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

    // Check isLoginDisabled for existing customers
    const existingCustomer = await db.customer.findFirst({
      where: { businessId, email },
      select: { isLoginDisabled: true },
    });
    if (existingCustomer?.isLoginDisabled) {
      return NextResponse.json(
        { success: false, error: 'Account disabled. Contact the store.' },
        { status: 403 }
      );
    }

    const session = await createStorefrontSession({
      email, phone, name, businessId, storeId, emailVerified: true,
    });

    // Mobile-flat response — token is the refreshToken (stored in DB, used as Bearer)
    return NextResponse.json({
      success: true,
      token: session.refreshToken,
      refreshToken: session.refreshToken,
      user: session.user,
      customerId: session.customerId,
      isPasswordSet: session.isPasswordSet,
      mustChangePassword: session.mustChangePassword,
      businesses: session.businesses,
    });
  } catch (error) {
    console.error('[customer/auth/verify-otp]', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
