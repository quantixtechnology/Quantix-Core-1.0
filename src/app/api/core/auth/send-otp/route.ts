// ============================================================================
// Route: POST /api/core/auth/send-otp
// Send OTP for authentication (Email OTP or WhatsApp OTP)
// Rate limited: max 5 OTPs per email/phone per hour
// ============================================================================

import { db } from '@/lib/db';
import { sendEmailOtp, isSmtpConfigured } from '@/lib/email-service';
import { NextResponse } from 'next/server';

const MAX_OTP_PER_HOUR = 5;
const OTP_EXPIRY_MINUTES = 10;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getStoreSettings(raw: string): Record<string, string> {
  try { return JSON.parse(raw) } catch { return {} }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, channel, businessId, storeId } = body as {
      email?: string;
      phone?: string;
      channel: 'EMAIL_OTP' | 'WHATSAPP_OTP';
      businessId?: string;
      storeId?: string;
    };

    // Normalize — SQLite text comparison is binary (case-sensitive)
    const normalizedEmail = email?.trim().toLowerCase() || undefined;

    if (!channel || !['EMAIL_OTP', 'WHATSAPP_OTP'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel. Must be EMAIL_OTP or WHATSAPP_OTP' },
        { status: 400 }
      );
    }

    if (!normalizedEmail && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    if (channel === 'EMAIL_OTP' && !normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required for EMAIL_OTP channel' },
        { status: 400 }
      );
    }
    if (channel === 'WHATSAPP_OTP' && !phone) {
      return NextResponse.json(
        { success: false, error: 'Phone is required for WHATSAPP_OTP channel' },
        { status: 400 }
      );
    }

    // Rate limit check
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtps = await db.oTPCode.count({
      where: {
        ...(normalizedEmail ? { email: normalizedEmail } : { phone }),
        channel,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentOtps >= MAX_OTP_PER_HOUR) {
      return NextResponse.json(
        { success: false, error: 'Too many OTP requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Generate OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Resolve user if exists (use normalized email for lookup)
    let userId: string | undefined;
    if (normalizedEmail) {
      const user = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (user) userId = user.id;
    } else if (phone) {
      const user = await db.user.findFirst({ where: { phone } });
      if (user) userId = user.id;
    }

    // Resolve store config for branded sender
    let storeName = 'Quantix';
    let otpSenderEmail: string | undefined;
    if (storeId) {
      const store = await db.store.findUnique({
        where: { id: storeId },
        select: { name: true, settings: true, email: true },
      });
      if (store) {
        storeName = store.name;
        const settings = getStoreSettings(store.settings || '{}');
        otpSenderEmail = settings.otpSenderEmail || store.email || undefined;
      }
    } else if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { name: true },
      });
      if (business) storeName = business.name;
    }

    // Store OTP — always use normalized email so verify lookup always matches
    await db.oTPCode.create({
      data: {
        userId: userId || null,
        email: normalizedEmail || null,
        phone: phone || null,
        code,
        channel,
        expiresAt,
      },
    });

    console.log(`[OTP SEND] channel=${channel} to=${normalizedEmail ?? phone} businessId=${businessId ?? 'none'} expiresAt=${expiresAt.toISOString()}`);

    // ── Delivery ────────────────────────────────────────────────────────────
    let delivered = false;
    let deliveryError: string | undefined;
    let emailFallbackSent = false;

    if (channel === 'EMAIL_OTP' && normalizedEmail) {
      const result = await sendEmailOtp(normalizedEmail, code, storeName, otpSenderEmail);
      delivered = result.sent;
      deliveryError = result.error;
      console.log(`[OTP SEND] email delivered=${delivered} error=${deliveryError ?? 'none'}`);
    } else if (channel === 'WHATSAPP_OTP') {
      console.log(`[OTP/WhatsApp] To: ${phone}, Code: ${code}, Store: ${storeName}`);
      if (normalizedEmail && isSmtpConfigured()) {
        await db.oTPCode.create({
          data: {
            userId: userId || null,
            email: normalizedEmail,
            phone: null,
            code,
            channel: 'EMAIL_OTP',
            expiresAt,
          },
        });
        const result = await sendEmailOtp(normalizedEmail, code, storeName, otpSenderEmail);
        emailFallbackSent = result.sent;
      }
      delivered = true;
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent',
      delivered,
      emailFallbackSent,
      smtpConfigured: isSmtpConfigured(),
      ...(deliveryError ? { deliveryWarning: deliveryError } : {}),
      ...((process.env.NODE_ENV === 'development' || !delivered) ? { devOtp: code } : {}),
    });
  } catch (error) {
    console.error('[send-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
