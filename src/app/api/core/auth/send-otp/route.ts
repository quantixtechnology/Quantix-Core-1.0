// ============================================================================
// Route: POST /api/core/auth/send-otp
// Send OTP for authentication (Email OTP or WhatsApp OTP)
// Rate limited: max 5 OTPs per email/phone per hour
// ============================================================================

import { db } from '@/lib/db';
import { sendEmailOtp, isSmtpConfigured } from '@/lib/email-service';
import { NextResponse } from 'next/server';

const MAX_OTP_PER_HOUR = 5;
const OTP_EXPIRY_MINUTES = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getStoreSettings(raw: string): Record<string, string> {
  try { return JSON.parse(raw) } catch { return {} }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, channel, businessId, storeId, name } = body as {
      email?: string;
      phone?: string;
      channel: 'EMAIL_OTP' | 'WHATSAPP_OTP';
      businessId?: string;
      storeId?: string;
      name?: string;
    };

    if (!channel || !['EMAIL_OTP', 'WHATSAPP_OTP'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel. Must be EMAIL_OTP or WHATSAPP_OTP' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    if (channel === 'EMAIL_OTP' && !email) {
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
        ...(email ? { email } : { phone }),
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

    // Resolve user if exists
    let userId: string | undefined;
    if (email) {
      const user = await db.user.findUnique({ where: { email } });
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

    // Store OTP in database
    await db.oTPCode.create({
      data: {
        userId: userId || null,
        email: email || null,
        phone: phone || null,
        code,
        channel,
        expiresAt,
      },
    });

    // ── Delivery ────────────────────────────────────────────────────────────
    let delivered = false;
    let deliveryError: string | undefined;
    let emailFallbackSent = false;

    if (channel === 'EMAIL_OTP' && email) {
      const result = await sendEmailOtp(email, code, storeName, otpSenderEmail);
      delivered = result.sent;
      deliveryError = result.error;
    } else if (channel === 'WHATSAPP_OTP') {
      // WhatsApp Business API not yet integrated — log and attempt email fallback
      console.log(`[OTP/WhatsApp] To: ${phone}, Code: ${code}, Store: ${storeName}`);
      // If customer also provided email (new registration flow), send email OTP too as fallback
      if (email && isSmtpConfigured()) {
        // Create a parallel EMAIL_OTP record so verify-otp can match on email channel too
        const emailCode = code; // same code for both channels
        await db.oTPCode.create({
          data: {
            userId: userId || null,
            email,
            phone: null,
            code: emailCode,
            channel: 'EMAIL_OTP',
            expiresAt,
          },
        });
        const result = await sendEmailOtp(email, emailCode, storeName, otpSenderEmail);
        emailFallbackSent = result.sent;
      }
      delivered = true; // WhatsApp is "attempted"
    }

    console.log(`[OTP] Channel: ${channel}, To: ${email || phone}, Code: ${code}, Delivered: ${delivered}`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent',
      delivered,
      emailFallbackSent,
      smtpConfigured: isSmtpConfigured(),
      ...(deliveryError ? { deliveryWarning: deliveryError } : {}),
      // Return code in dev or when delivery failed (safety net)
      ...((process.env.NODE_ENV === 'development' || !delivered) ? { code } : {}),
    });
  } catch (error) {
    console.error('[send-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
