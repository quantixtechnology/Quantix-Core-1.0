import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, channel } = body;

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    const otpChannel = channel || (email ? 'EMAIL_OTP' : 'WHATSAPP_OTP');

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Find user by email or phone
    let userId: string | undefined;
    if (email) {
      const user = await db.user.findUnique({ where: { email } });
      if (user) userId = user.id;
    }

    await db.oTPCode.create({
      data: {
        userId,
        email,
        phone,
        code,
        channel: otpChannel as 'EMAIL_OTP' | 'WHATSAPP_OTP' | 'PUSH_NOTIFICATION',
        expiresAt,
      },
    });

    // In production, send OTP via email/WhatsApp service
    console.log(`OTP for ${email || phone}: ${code}`);

    return NextResponse.json({
      success: true,
      data: {
        message: `OTP sent via ${otpChannel.toLowerCase().replace('_', ' ')}`,
        // In development, return the OTP for testing
        ...(process.env.NODE_ENV === 'development' && { otp: code }),
      },
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP' },
      { status: 500 }
    );
  }
}
