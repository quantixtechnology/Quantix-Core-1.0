// ============================================================================
// POST /api/core/delivery/auth/login
// Delivery partner login: email + password
// Returns access token + partner profile for the Delivery App
// ============================================================================

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyPassword, createAccessToken } from '@/lib/password-utils';

const REFRESH_TOKEN_EXPIRY_DAYS = 60;

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; phone?: string; password: string };
    const { email, phone, password } = body;

    if ((!email && !phone) || !password) {
      return NextResponse.json(
        { success: false, error: 'email (or phone) and password are required' },
        { status: 400 }
      );
    }

    const userSelect = {
      id: true, name: true, email: true, phone: true, avatar: true,
      passwordHash: true, isActive: true,
      businessUsers: {
        where: { isActive: true },
        select: {
          role: true,
          business: {
            select: { id: true, name: true, slug: true, businessType: true },
          },
        },
      },
      deliveryProfiles: {
        where: { isActive: true },
        select: {
          id: true, businessId: true, partnerCode: true, name: true,
          phone: true, vehicleType: true, isOnline: true, availability: true,
          rating: true, totalDeliveries: true, totalEarnings: true,
        },
      },
    } as const;

    // Lookup by email / loginId / phone
    let user: Prisma.UserGetPayload<{ select: typeof userSelect }> | null = null;

    if (email) {
      const identifier = email.toLowerCase().trim();
      user = await db.user.findFirst({
        where: { OR: [{ email: identifier }, { loginId: identifier }] },
        select: userSelect,
      });
    }

    if (!user && phone) {
      user = await db.user.findFirst({ where: { phone }, select: userSelect });
    }

    if (!user || !user.passwordHash) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ success: false, error: 'Account is deactivated' }, { status: 403 });
    }

    // Must have DELIVERY_STAFF role in at least one business
    const deliveryBU = user.businessUsers.find((bu) => bu.role === 'DELIVERY_STAFF');
    if (!deliveryBU) {
      return NextResponse.json(
        { success: false, error: 'Not a delivery partner account' },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Issue access token (24 h)
    const accessToken = createAccessToken();
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 24);
    await db.refreshToken.create({
      data: { userId: user.id, token: accessToken, expiresAt: accessExpiresAt },
    });

    // Issue refresh token (60 days)
    const refreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    await db.refreshToken.create({
      data: { userId: user.id, token: refreshTokenValue, expiresAt: refreshExpiresAt },
    });

    const partner = user.deliveryProfiles[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'DELIVERY_STAFF',
          businessId: deliveryBU.business.id,
          businessName: deliveryBU.business.name,
          businessType: deliveryBU.business.businessType,
        },
        partner,
        accessToken,
        refreshToken: refreshTokenValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
