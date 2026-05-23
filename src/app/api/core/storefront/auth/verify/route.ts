// ============================================================================
// POST /api/core/storefront/auth/verify
// Verify EMAIL OTP → create session (storefront customers only)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStorefrontSession, normalizeEmail, normalizePhone } from '@/lib/storefront-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      phone: string;
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

    // Find valid OTP
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

    // Mark OTP used
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // Create session
    const session = await createStorefrontSession({
      email,
      phone,
      name,
      businessId,
      storeId,
      emailVerified: true,
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error) {
    console.error('[storefront/auth/verify]', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}
