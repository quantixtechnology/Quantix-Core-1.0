// ============================================================================
// Route: POST /api/core/auth/verify-otp
// Verify OTP and return user session data
// ============================================================================

import { db } from '@/lib/db';
import { getPermissionsForRole } from '@/lib/core';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, code, channel } = body as {
      email?: string;
      phone?: string;
      code: string;
      channel: 'EMAIL_OTP' | 'WHATSAPP_OTP';
    };

    // Validate
    if (!code || !channel) {
      return NextResponse.json(
        { success: false, error: 'Code and channel are required' },
        { status: 400 }
      );
    }

    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email or phone is required' },
        { status: 400 }
      );
    }

    if (!['EMAIL_OTP', 'WHATSAPP_OTP'].includes(channel)) {
      return NextResponse.json(
        { success: false, error: 'Invalid channel' },
        { status: 400 }
      );
    }

    // Find the OTP record
    const otpRecord = await db.oTPCode.findFirst({
      where: {
        ...(email ? { email } : { phone }),
        channel,
        code,
        isVerified: false,
        expiresAt: { gte: new Date() }, // Not expired
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 401 }
      );
    }

    // Mark OTP as verified
    await db.oTPCode.update({
      where: { id: otpRecord.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Find or create user
    let user = null;
    if (email) {
      user = await db.user.findUnique({ where: { email } });
    } else if (phone) {
      user = await db.user.findFirst({ where: { phone } });
    }

    if (!user) {
      // Auto-create user if they don't exist (for OTP-based signup flow)
      // The user will need to complete registration via /api/core/auth/register
      // For now, create a basic user record
      const userEmail = email || `${phone}@otp.placeholder`;
      user = await db.user.create({
        data: {
          email: userEmail,
          phone: phone || null,
          name: email?.split('@')[0] || phone || 'User',
          authProvider: channel,
          emailVerified: channel === 'EMAIL_OTP' && !!email,
          phoneVerified: channel === 'WHATSAPP_OTP' && !!phone,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Update verification status and last login
      await db.user.update({
        where: { id: user.id },
        data: {
          ...(channel === 'EMAIL_OTP' && email ? { emailVerified: true } : {}),
          ...(channel === 'WHATSAPP_OTP' && phone ? { phoneVerified: true } : {}),
          lastLoginAt: new Date(),
        },
      });
    }

    // Get user's business associations
    const businessUsers = await db.businessUser.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            businessType: true,
            status: true,
            primaryColor: true,
          },
        },
        store: {
          select: { id: true, name: true },
        },
      },
    });

    // Get sales profile if exists
    const salesProfile = await db.salesTeamMember.findUnique({
      where: { userId: user.id },
    });

    // Build permissions per business
    const userWithRoles = businessUsers.map((bu) => ({
      businessId: bu.businessId,
      role: bu.role,
      permissions: getPermissionsForRole(bu.role),
      business: bu.business,
      storeId: bu.storeId,
      store: bu.store,
    }));

    // Create a simple token (JWT-like, just user data for now)
    const token = Buffer.from(
      JSON.stringify({
        userId: user.id,
        email: user.email,
        phone: user.phone,
        exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
    ).toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          avatar: user.avatar,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        businesses: userWithRoles,
        salesProfile: salesProfile
          ? {
              id: salesProfile.id,
              name: salesProfile.name,
              region: salesProfile.region,
              isActive: salesProfile.isActive,
            }
          : null,
        token,
      },
    });
  } catch (error) {
    console.error('[verify-otp] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify OTP' },
      { status: 500 }
    );
  }
}
