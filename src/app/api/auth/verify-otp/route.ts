import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'quantix-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'OTP code is required' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    // Find valid OTP
    const where: Record<string, unknown> = {
      code,
      isVerified: false,
      expiresAt: { gt: new Date() },
    };

    if (email) where.email = email;
    if (phone) where.phone = phone;

    const otpRecord = await db.oTPCode.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Mark OTP as verified
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // Find or create user
    let user = await db.user.findUnique({
      where: email ? { email } : { phone: phone! },
      include: { businessUsers: { include: { business: true } } },
    });

    if (!user) {
      // Auto-create user on OTP verification
      user = await db.user.create({
        data: {
          email: email || undefined,
          phone: phone || undefined,
          name: email?.split('@')[0] || phone || 'User',
          authProvider: email ? 'EMAIL_OTP' : 'WHATSAPP_OTP',
          emailVerified: !!email,
          phoneVerified: !!phone,
        },
        include: { businessUsers: { include: { business: true } } },
      });
    } else {
      // Update verification status
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: email ? true : user.emailVerified,
          phoneVerified: phone ? true : user.phoneVerified,
          lastLoginAt: new Date(),
        },
      });
    }

    // Create access token
    const accessToken = sign(
      {
        userId: user.id,
        email: user.email,
        role: user.businessUsers[0]?.role || 'CUSTOMER',
        businessId: user.businessUsers[0]?.businessId,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { passwordHash: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        accessToken,
        businesses: user.businessUsers.map((bu) => ({
          businessId: bu.businessId,
          businessName: bu.business.name,
          businessType: bu.business.businessType,
          role: bu.role,
          slug: bu.business.slug,
        })),
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
