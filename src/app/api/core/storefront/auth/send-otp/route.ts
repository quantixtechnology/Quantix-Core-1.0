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
      console.warn(`[storefront/auth/send-otp] delivery failed email=${email}: ${sendError}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent',
      sent,
      ...(sendError ? { warning: sendError } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/send-otp]', error);
    return NextResponse.json({ success: false, error: 'Failed to send code' }, { status: 500 });
  }
}
