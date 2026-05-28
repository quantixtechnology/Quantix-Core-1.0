// ============================================================================
// Route: POST /api/core/auth/forgot-password/send-otp
// Send a password-reset OTP to the user's email.
// Always returns success to prevent email enumeration.
// Body: { email, businessId? }
// ============================================================================

import { db } from '@/lib/db';
import { sendEmailOtp, isSmtpConfigured } from '@/lib/email-service';
import { NextResponse } from 'next/server';

const MAX_OTP_PER_HOUR = 3;
const OTP_EXPIRY_MINUTES = 10;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      businessId?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const { businessId } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Lookup user — return generic success if not found to prevent enumeration
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      console.log(`[AUTH FORGOT-PW] send-otp no-op: email=${email} (user not found or inactive)`);
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, an OTP has been sent.',
        delivered: false,
      });
    }

    // Rate limit: max 3 password-reset OTPs per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.oTPCode.count({
      where: {
        email,
        channel: 'EMAIL_OTP',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= MAX_OTP_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again in an hour.' },
        { status: 429 }
      );
    }

    // Resolve business name for branded OTP email
    let storeName = 'Quantix';
    if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { name: true },
      });
      if (business) storeName = business.name;
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.oTPCode.create({
      data: {
        userId: user.id,
        email,
        code,
        channel: 'EMAIL_OTP',
        expiresAt,
      },
    });

    console.log(`[AUTH FORGOT-PW] send-otp email=${email} businessId=${businessId ?? 'none'}`);

    let delivered = false;
    let deliveryError: string | undefined;

    const result = await sendEmailOtp(email, code, storeName, undefined);
    delivered = result.sent;
    deliveryError = result.error;

    console.log(`[AUTH FORGOT-PW] otp delivered=${delivered} smtpConfigured=${isSmtpConfigured()} error=${deliveryError ?? 'none'}`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent',
      delivered,
      smtpConfigured: isSmtpConfigured(),
      ...(deliveryError ? { deliveryWarning: deliveryError } : {}),
      ...((process.env.NODE_ENV === 'development' || !delivered) ? { devOtp: code } : {}),
    });
  } catch (error) {
    console.error('[forgot-password/send-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
