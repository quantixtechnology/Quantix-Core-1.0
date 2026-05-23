// ============================================================================
// Route: POST /api/core/auth/verify-otp
// Verify OTP and return user session data with proper access + refresh tokens
// ============================================================================

import { db } from '@/lib/db';
import { getPermissionsForRole } from '@/lib/core';
import { createAccessToken } from '@/lib/password-utils';
import { NextResponse } from 'next/server';
import type { Role, BusinessType, Permission } from '@/lib/types';

// Refresh token expiry: 7 days
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, phone, code, channel, businessId: reqBusinessId, name: reqName, storeId: reqStoreId } = body as {
      email?: string;
      phone?: string;
      code: string;
      channel: 'EMAIL_OTP' | 'WHATSAPP_OTP';
      businessId?: string;
      name?: string;
      storeId?: string;
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
    let user: Awaited<ReturnType<typeof db.user.findUnique>> = null;
    if (email) {
      user = await db.user.findUnique({ where: { email } });
    } else if (phone) {
      user = await db.user.findFirst({ where: { phone } });
    }

    if (!user) {
      // Auto-create user if they don't exist (for OTP-based signup flow)
      const userEmail = email || `${phone}@otp.placeholder`;
      const derivedName = reqName?.trim() || email?.split('@')[0] || phone || 'User';
      user = await db.user.create({
        data: {
          email: userEmail,
          phone: phone || null,
          name: derivedName,
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

    // If a storefront businessId is provided, ensure Customer + BusinessUser exist for that business
    if (reqBusinessId) {
      const business = await db.business.findUnique({
        where: { id: reqBusinessId },
        select: { id: true, status: true },
      });
      if (business && (business.status === 'ACTIVE' || business.status === 'ONBOARDING')) {
        const existingBU = await db.businessUser.findFirst({
          where: { userId: user.id, businessId: reqBusinessId, isActive: true },
        });
        if (!existingBU) {
          await db.businessUser.create({
            data: { userId: user.id, businessId: reqBusinessId, role: 'CUSTOMER', isActive: true },
          });
        }
        const existingCustomer = await db.customer.findFirst({
          where: { userId: user.id, businessId: reqBusinessId },
        });
        if (!existingCustomer) {
          // Claim shadow customer by phone to avoid duplicate records.
          // Guest orders create { userId: null, phone } — merge instead of creating a new row.
          const shadow = phone
            ? await db.customer.findFirst({
                where: { businessId: reqBusinessId, phone, userId: null },
              })
            : null;
          if (shadow) {
            await db.customer.update({
              where: { id: shadow.id },
              data: {
                userId: user.id,
                isGuest: false,
                verified: true,
                name: user.name || shadow.name,
                source: 'STORE_FRONT',
                preferredStoreId: reqStoreId || shadow.preferredStoreId || null,
              },
            }).catch(() => {});
          } else {
            const isPlaceholderEmail = user.email.endsWith('@otp.placeholder');
            await db.customer.create({
              data: {
                businessId: reqBusinessId,
                userId: user.id,
                name: user.name,
                phone: phone || null,
                email: isPlaceholderEmail ? null : user.email,
                source: 'STORE_FRONT',
                isGuest: false,
                verified: true,
                createdStoreId: reqStoreId || null,
                preferredStoreId: reqStoreId || null,
              },
            }).catch(() => {/* ignore unique constraint races */});
          }
        } else if (!existingCustomer.verified) {
          // Upgrade guest to verified if they logged in
          await db.customer.update({
            where: { id: existingCustomer.id },
            data: { verified: true, isGuest: false, source: 'STORE_FRONT' },
          }).catch(() => {});
        }
      }
    }

    // Get user's business associations (after potential Customer creation above)
    let businessUsers = await db.businessUser.findMany({
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

    // Determine role and business context
    let role: Role = 'CUSTOMER';
    let businessId: string | undefined;
    let businessName: string | undefined;
    let businessType: BusinessType | undefined;
    let businessSlug: string | undefined;
    let storeId: string | undefined;
    let isPlatformAdmin = false;

    if (salesProfile) {
      role = 'QUANTIX_SALES_TEAM';
      isPlatformAdmin = true;
    } else if (user.email.endsWith('@quantixtechnology.in') && businessUsers.length === 0) {
      role = 'QUANTIX_SUPER_ADMIN';
      isPlatformAdmin = true;
    } else if (businessUsers.length > 0) {
      // Prefer the storefront's businessId when provided (customer login context)
      const primaryBU = reqBusinessId
        ? (businessUsers.find((bu) => bu.businessId === reqBusinessId) ?? businessUsers[0])
        : businessUsers[0];
      role = primaryBU.role as Role;
      businessId = primaryBU.business.id;
      businessName = primaryBU.business.name;
      businessType = primaryBU.business.businessType as BusinessType;
      businessSlug = primaryBU.business.slug;
      storeId = primaryBU.storeId || undefined;
    }

    const permissions: Permission[] = getPermissionsForRole(role);

    // Build user session object
    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role,
      businessId,
      businessName,
      businessType,
      businessSlug,
      storeId,
      permissions,
      isPlatformAdmin,
    };

    // Build businesses array
    const userWithRoles = businessUsers.map((bu) => ({
      businessId: bu.businessId,
      businessName: bu.business.name,
      businessType: bu.business.businessType as BusinessType,
      businessSlug: bu.business.slug,
      role: bu.role as Role,
      storeId: bu.storeId || null,
      storeName: bu.store?.name || null,
      permissions: getPermissionsForRole(bu.role as Role),
      business: bu.business,
    }));

    // ─── Create proper access token ──────────────────────────────────
    const accessToken = createAccessToken();

    // ─── Create refresh token in database ─────────────────────────────
    const refreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenValue,
        expiresAt: refreshExpiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        user: sessionUser,
        accessToken,
        refreshToken: refreshTokenValue,
        businesses: userWithRoles,
        permissions,
        salesProfile: salesProfile
          ? {
              id: salesProfile.id,
              name: salesProfile.name,
              region: salesProfile.region,
              isActive: salesProfile.isActive,
            }
          : null,
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
