// ============================================================================
// POST /api/core/storefront/auth/send-otp
// Storefront-specific: sends EMAIL OTP only. Rate-limited to 5/hr.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email-service';
import { normalizeEmail } from '@/lib/storefront-auth';

const MAX_OTP_PER_HOUR = 5;
const OTP_EXPIRY_MINUTES = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getStoreSettings(raw: string | null): Record<string, string> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      email: string;
      businessId?: string;
      storeId?: string;
    };

    const email = normalizeEmail(body.email || '');
    const { businessId, storeId } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 });
    }

    // Rate limit: 5 OTPs per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await db.oTPCode.count({
      where: { email, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= MAX_OTP_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait before requesting another code.' },
        { status: 429 }
      );
    }

    // Resolve store branding
    let storeName = 'Quantix';
    let otpSenderEmail: string | undefined;
    if (storeId) {
      const store = await db.store.findUnique({
        where: { id: storeId },
        select: { name: true, settings: true, email: true },
      });
      if (store) {
        storeName = store.name;
        const s = getStoreSettings(store.settings);
        otpSenderEmail = s.otpSenderEmail || store.email || undefined;
      }
    } else if (businessId) {
      const biz = await db.business.findUnique({ where: { id: businessId }, select: { name: true } });
      if (biz) storeName = biz.name;
    }

    // Look up existing user
    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.oTPCode.create({
      data: {
        userId: existingUser?.id ?? null,
        email,
        phone: null,
        code,
        channel: 'EMAIL_OTP',
        expiresAt,
      },
    });

    const { sent, error: sendError } = await sendOTPEmail({
      to: email,
      otp: code,
      businessName: storeName,
      storeId: storeId ?? undefined,
      tenantId: businessId ?? undefined,
    });

    if (!sent) {
      // Say so. The response used to be success:true with "Verification code
      // sent" whatever happened, and the sign-in screen only reads `success` —
      // so a customer whose mail was rejected was moved to the code box and
      // left waiting for something that had never been sent, with nothing on
      // screen and nothing for the counter staff to see. Under a mail provider
      // throttling a busy day that is every customer at once, silently.
      console.error(`[storefront/auth/send-otp] delivery FAILED email=${email}: ${sendError}`);
      return NextResponse.json(
        {
          success: false,
          sent: false,
          error: "We couldn't send your code just now. Please try again in a moment.",
          detail: sendError,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      sent,
    });
  } catch (error) {
    console.error('[storefront/auth/send-otp]', error);
    return NextResponse.json({ success: false, error: 'Failed to send code' }, { status: 500 });
  }
}
