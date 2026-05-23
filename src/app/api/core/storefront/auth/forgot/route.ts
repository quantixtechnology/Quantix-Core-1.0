// ============================================================================
// POST /api/core/storefront/auth/forgot
// Forgot account — lookup by phone, return masked email, send OTP
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmailOtp } from '@/lib/email-service';
import { maskEmail, normalizePhone } from '@/lib/storefront-auth';

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_PER_HOUR = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getStoreSettings(raw: string | null): Record<string, string> {
  try { return JSON.parse(raw || '{}') } catch { return {} }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      phone: string;
      businessId: string;
      storeId?: string;
    };

    const phone = normalizePhone(body.phone || '');
    const { businessId, storeId } = body;

    if (!phone || !businessId) {
      return NextResponse.json(
        { success: false, error: 'phone and businessId are required' },
        { status: 400 }
      );
    }

    // Look up customer by phone
    const customer = await db.customer.findFirst({
      where: { businessId, phone },
      select: { email: true, name: true },
    });

    if (!customer?.email) {
      // Don't reveal whether account exists — generic message
      return NextResponse.json({
        success: true,
        status: 'NOT_FOUND',
        message: 'If an account with this number exists, a recovery code has been sent.',
      });
    }

    const email = customer.email;
    const maskedEmail = maskEmail(email);

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await db.oTPCode.count({
      where: { email, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },
    });
    if (recent >= MAX_OTP_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait before trying again.' },
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
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
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

    await sendEmailOtp(email, code, storeName, otpSenderEmail);

    return NextResponse.json({
      success: true,
      status: 'SENT',
      email,
      maskedEmail,
      message: `Recovery code sent to ${maskedEmail}`,
      ...((process.env.NODE_ENV === 'development') ? { code } : {}),
    });
  } catch (error) {
    console.error('[storefront/auth/forgot]', error);
    return NextResponse.json({ success: false, error: 'Recovery failed' }, { status: 500 });
  }
}
