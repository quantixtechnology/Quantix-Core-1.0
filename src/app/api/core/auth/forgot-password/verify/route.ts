// ============================================================================
// Route: POST /api/core/auth/forgot-password/verify
// Verify the OTP from forgot-password/send-otp and return a short-lived resetToken.
// Body: { email, code }
// Returns: { data: { resetToken } }
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const RESET_TOKEN_EXPIRY_MINUTES = 15;

function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      code: string;
    };

    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email and code are required' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Find matching, unexpired, unverified OTP
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        email,
        channel: 'EMAIL_OTP',
        code,
        isVerified: false,
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      console.log(`[AUTH FORGOT-PW] verify FAILED email=${email}`);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      );
    }

    // Consume the OTP
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Issue a short-lived reset token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    console.log(`[AUTH FORGOT-PW] verify ok userId=${user.id} email=${email} resetToken issued`);

    return NextResponse.json({
      success: true,
      data: { resetToken: token },
    });
  } catch (error) {
    console.error('[forgot-password/verify] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}
