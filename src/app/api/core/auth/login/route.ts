// ============================================================================
// Route: POST /api/core/auth/login
// Email + Password authentication
// ============================================================================

import { db } from '@/lib/db';
import { verifyPassword, createAccessToken } from '@/lib/password-utils';
import { resolveUserPermissions } from '@/lib/db-permissions';
import { checkRateLimit } from '@/lib/middleware';
import { logAuthActivity } from '@/lib/core/audit';
import { logPlatformEvent } from '@/lib/platform-audit';
import { NextResponse } from 'next/server';
import type { Role, BusinessType, Permission } from '@/lib/types';

const RATE_LIMIT_CONFIG = { windowMs: 15 * 60 * 1000, maxRequests: 20 };
const REFRESH_TOKEN_EXPIRY_DAYS = 60;

const PLATFORM_ROLES = [
  'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM',
  'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM',
];

function generateRefreshToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

export async function POST(request: Request) {
  let normalizedEmail = '';
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    // Normalize: trim whitespace + lowercase
    const identifier = email.toLowerCase().trim();
    normalizedEmail = identifier;

    console.log(`[login] Attempt for: ${identifier}`);

    const rateLimitError = checkRateLimit(`login:${identifier}`, RATE_LIMIT_CONFIG);
    if (rateLimitError) {
      return NextResponse.json({ success: false, error: rateLimitError }, { status: 429 });
    }

    const userSelect = {
      id: true, name: true, email: true, loginId: true, avatar: true,
      passwordHash: true, isActive: true, mustChangePassword: true, platformRole: true, platformPermissions: true,
      businessUsers: {
        where: { isActive: true },
        select: {
          role: true, storeId: true,
          business: {
            select: { id: true, name: true, slug: true, businessType: true, status: true, primaryColor: true, logo: true },
          },
          store: { select: { id: true, name: true } },
        },
      },
      salesProfile: { select: { id: true, name: true, region: true, isActive: true } },
    } as const;

    // Lookup order: loginId first → email exact → email case-insensitive fallback
    let user = await db.user.findUnique({ where: { loginId: identifier }, select: userSelect });

    if (!user) {
      user = await db.user.findUnique({ where: { email: identifier }, select: userSelect });
    }

    // SQLite fallback: case-insensitive search via raw SQL
    if (!user) {
      console.log(`[login] Exact match failed. Trying LOWER() fallback for: ${identifier}`);
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM User WHERE LOWER(loginId) = ${identifier} OR LOWER(email) = ${identifier} LIMIT 1
      `;
      if (rows.length > 0) {
        user = await db.user.findUnique({ where: { id: rows[0].id }, select: userSelect });
        if (user) {
          console.log(`[login] LOWER() fallback found user: ${user.email}`);
        }
      }
    }

    if (!user || !user.passwordHash) {
      console.log(`[login] FAIL — user not found or no password hash for: ${normalizedEmail}`);
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    console.log(`[login] User found: ${user.email} (id=${user.id}), isActive=${user.isActive}, platformRole=${user.platformRole ?? 'none'}`);

    if (!user.isActive) {
      console.log(`[login] FAIL — account deactivated: ${user.email}`);
      return NextResponse.json({ success: false, error: 'Account is deactivated. Please contact support.' }, { status: 403 });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);
    console.log(`[login] Password comparison result: ${isValid ? 'VALID' : 'INVALID'} for ${user.email}`);

    if (!isValid) {
      try {
        await logAuthActivity(null, 'auth.login_failed', { email: normalizedEmail, reason: 'invalid_password' }, request as unknown as { headers?: { get(name: string): string | null } });
      } catch { /* audit logging is non-blocking */ }
      logPlatformEvent({
        email:       normalizedEmail,
        module:      'AUTHENTICATION',
        action:      'FAILED_LOGIN',
        description: `Failed login attempt for ${normalizedEmail}`,
        severity:    'CRITICAL',
        req:         request as unknown as import('next/server').NextRequest,
      })
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // Update last login
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Determine role
    let role: Role = 'CUSTOMER';
    let businessId: string | undefined;
    let businessName: string | undefined;
    let businessType: BusinessType | undefined;
    let businessSlug: string | undefined;
    let storeId: string | undefined;
    let isPlatformAdmin = false;

    if (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) {
      role = user.platformRole as Role;
      isPlatformAdmin = true;
    } else if (user.businessUsers.length > 0) {
      const primaryBU = user.businessUsers[0];
      role = primaryBU.role as Role;
      businessId = primaryBU.business.id;
      businessName = primaryBU.business.name;
      businessType = primaryBU.business.businessType as BusinessType;
      businessSlug = primaryBU.business.slug;
      storeId = primaryBU.storeId || undefined;

      const validStatuses = ['ONBOARDING', 'ACTIVE'];
      if (!validStatuses.includes(primaryBU.business.status)) {
        return NextResponse.json({ success: false, error: 'Your business account is not active. Please contact Quantix support.' }, { status: 403 });
      }
    } else if (user.email.toLowerCase().endsWith('@quantixtechnology.in')) {
      // Fallback for super admin without platformRole set
      role = 'QUANTIX_SUPER_ADMIN';
      isPlatformAdmin = true;
    }

    console.log(`[login] SUCCESS — user=${user.id}, email=${user.email}, role=${role}, isPlatformAdmin=${isPlatformAdmin}`);

    // Resolve permissions: role defaults → RBAC DB overrides → user-level overrides
    const permissions: Permission[] = await resolveUserPermissions(
      role,
      isPlatformAdmin ? (user.platformPermissions ?? null) : null
    ) as Permission[];

    const sessionUser = {
      id: user.id, name: user.name, email: user.email, avatar: user.avatar,
      role, businessId, businessName, businessType, businessSlug, storeId, permissions, isPlatformAdmin,
      hasPassword: !!user.passwordHash,
      mustChangePassword: !!user.mustChangePassword,
    };

    const businesses = await Promise.all(user.businessUsers.map(async (bu) => ({
      businessId: bu.business.id,
      businessName: bu.business.name,
      businessType: bu.business.businessType as BusinessType,
      businessSlug: bu.business.slug,
      role: bu.role as Role,
      storeId: bu.storeId || null,
      storeName: bu.store?.name || null,
      permissions: await resolveUserPermissions(bu.role, null) as Permission[],
    })));

    // Create access token (stored in DB for middleware validation)
    const accessToken = createAccessToken();
    const accessExpiresAt = new Date();
    accessExpiresAt.setHours(accessExpiresAt.getHours() + 24);
    await db.refreshToken.create({ data: { userId: user.id, token: accessToken, expiresAt: accessExpiresAt } });

    // Create refresh token
    const refreshTokenValue = generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
    await db.refreshToken.create({ data: { userId: user.id, token: refreshTokenValue, expiresAt: refreshExpiresAt } });

    try {
      await logAuthActivity(user.id, 'auth.login', { email: user.email, role, businessId: businessId || null, isPlatformAdmin }, request as unknown as { headers?: { get(name: string): string | null } });
    } catch { /* audit logging is non-blocking */ }
    logPlatformEvent({
      userId:      user.id,
      userName:    user.name,
      email:       user.email,
      role,
      module:      'AUTHENTICATION',
      action:      'LOGIN',
      description: `${user.name} logged in`,
      severity:    'INFO',
      req:         request as unknown as import('next/server').NextRequest,
    })

    return NextResponse.json({
      success: true,
      data: {
        user: sessionUser,
        accessToken,
        refreshToken: refreshTokenValue,
        businesses,
        permissions,
        salesProfile: user.salesProfile
          ? { id: user.salesProfile.id, name: user.salesProfile.name, region: user.salesProfile.region, isActive: user.salesProfile.isActive }
          : null,
      },
    });
  } catch (error) {
    console.error(`[login] Unexpected error for ${normalizedEmail}:`, error);
    return NextResponse.json({ success: false, error: 'Login failed. Please try again.' }, { status: 500 });
  }
}
