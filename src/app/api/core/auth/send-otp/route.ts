// ============================================================================
// Route: POST /api/core/auth/send-otp
// Send OTP for authentication (Email OTP or WhatsApp OTP)
// Rate limited: max 5 OTPs per email/phone per hour
// ============================================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const MAX_OTP_PER_HOUR = 5;
const OTP_EXPIRY_MINUTES = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, channel } = body as {
      email?: string;
      phone?: string;
      channel: 'EMAIL_OTP' | 'WHATSAPP_OTP';
    };

    // Validate channel
    if (!channel || !['EMAIL_OTP', 'WHATSAPP_OTP'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel. Must be EMAIL_OTP or WHATSAPP_OTP' },
        { status: 400 }
      );
    }

    // Must provide email or phone
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    // EMAIL_OTP requires email, WHATSAPP_OTP requires phone
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

    // Rate limit check: max 5 OTPs per email/phone per hour
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

    // Generate 6-digit OTP
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Find existing user by email or phone
    let userId: string | undefined;
    if (email) {
      const user = await db.user.findUnique({ where: { email } });
      if (user) userId = user.id;
    } else if (phone) {
      const user = await db.user.findFirst({ where: { phone } });
      if (user) userId = user.id;
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

    // In production: Send email via SendGrid / WhatsApp via WhatsApp Business API
    // For now, we log it (in dev mode, OTP is visible in DB)
    console.log(`[OTP] Channel: ${channel}, To: ${email || phone}, Code: ${code}`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV === 'development' ? { code } : {}),
    });
  } catch (error) {
    console.error('[send-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
