// ============================================================================
// Route: POST /api/core/auth/login
// Email + Password authentication with rate limiting
// Returns user, access token, refresh token, businesses, and permissions
// ============================================================================

import { db } from '@/lib/db';
import { verifyPassword, createAccessToken } from '@/lib/password-utils';
import { getPermissionsForRole } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/middleware';
import { logAuthActivity } from '@/lib/core/audit';
import { NextResponse } from 'next/server';
import type { Role, BusinessType, Permission } from '@/lib/types';

// Rate limit: 20 attempts per 15 minutes per email
const RATE_LIMIT_CONFIG = { windowMs: 15 * 60 * 1000, maxRequests: 20 };

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
    const { email, password } = body as { email: string; password: string };

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Rate limiting by email
    const rateLimitError = checkRateLimit(`login:${email.toLowerCase()}`, RATE_LIMIT_CONFIG);
    if (rateLimitError) {
      return NextResponse.json(
        { success: false, error: rateLimitError },
        { status: 429 }
      );
    }

    // Find user with business associations — explicit select avoids schema-mismatch errors
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true, name: true, email: true, avatar: true,
        passwordHash: true, isActive: true, platformRole: true,
        businessUsers: {
          where: { isActive: true },
          select: {
            role: true, storeId: true,
            business: {
              select: {
                id: true, name: true, slug: true,
                businessType: true, status: true,
                primaryColor: true, logo: true,
              },
            },
            store: { select: { id: true, name: true } },
          },
        },
        salesProfile: {
          select: { id: true, name: true, region: true, isActive: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      // Log failed login attempt
      try {
        await logAuthActivity(null, 'auth.login_failed', { email: email.toLowerCase(), reason: 'invalid_password' }, request as unknown as { headers?: { get(name: string): string | null } });
      } catch { /* audit logging is non-blocking */ }
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Determine role and business context
    let role: Role = 'CUSTOMER';
    let businessId: string | undefined;
    let businessName: string | undefined;
    let businessType: BusinessType | undefined;
    let businessSlug: string | undefined;
    let storeId: string | undefined;
    let isPlatformAdmin = false;

    const PLATFORM_ROLES = [
      'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM',
      'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM',
    ];

    if (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) {
      // Platform staff — role stored directly on User.platformRole
      role = user.platformRole as Role;
      isPlatformAdmin = true;
    } else if (user.businessUsers.length > 0) {
      // Business staff — role stored in BusinessUser
      const primaryBU = user.businessUsers[0];
      role = primaryBU.role as Role;
      businessId = primaryBU.business.id;
      businessName = primaryBU.business.name;
      businessType = primaryBU.business.businessType as BusinessType;
      businessSlug = primaryBU.business.slug;
      storeId = primaryBU.storeId || undefined;

      // Business must be in valid status
      const validStatuses = ['ONBOARDING', 'ACTIVE'];
      if (!validStatuses.includes(primaryBU.business.status)) {
        return NextResponse.json(
          { success: false, error: 'Your business account is not active. Please contact Quantix support.' },
          { status: 403 }
        );
      }
    } else if (user.email.toLowerCase().endsWith('@quantixtechnology.in')) {
      // Fallback for seeded super admin that may not have platformRole set yet
      role = 'QUANTIX_SUPER_ADMIN';
      isPlatformAdmin = true;
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
    const businesses = user.businessUsers.map((bu) => ({
      businessId: bu.business.id,
      businessName: bu.business.name,
      businessType: bu.business.businessType as BusinessType,
      businessSlug: bu.business.slug,
      role: bu.role as Role,
      storeId: bu.storeId || null,
      storeName: bu.store?.name || null,
      permissions: getPermissionsForRole(bu.role as Role),
    }));

    // Create access token and store in database (so middleware can find it)
    const accessToken = createAccessToken();
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 24); // Access token: 24 hours

    await db.refreshToken.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt: accessExpiresAt,
      },
    });

    // Create refresh token in database (longer-lived)
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

    // Log successful login
    try {
      await logAuthActivity(user.id, 'auth.login', {
        email: user.email,
        role,
        businessId: businessId || null,
        isPlatformAdmin,
      }, request as unknown as { headers?: { get(name: string): string | null } });
    } catch { /* audit logging is non-blocking */ }

    return NextResponse.json({
      success: true,
      data: {
        user: sessionUser,
        accessToken,
        refreshToken: refreshTokenValue,
        businesses,
        permissions,
        salesProfile: user.salesProfile
          ? {
              id: user.salesProfile.id,
              name: user.salesProfile.name,
              region: user.salesProfile.region,
              isActive: user.salesProfile.isActive,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
