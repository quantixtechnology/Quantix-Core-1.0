// ============================================================================
// Route: GET /api/core/auth/me
// Authenticated session bootstrap — validates the Bearer access token
// server-side and returns the current user with business associations and
// permissions. Used by the AuthGuard to restore a session on refresh WITHOUT
// ever trusting localStorage alone.
//
// AUTH: The `Authorization: Bearer <token>` header is REQUIRED. The token is
// checked against the refreshToken table (same store as the login-issued
// access token), including expiry and account-active checks. On success the
// response is the canonical session: user + role + permissions + businesses.
// On an invalid / expired token the route returns 401 so the client can clear
// its local session and redirect to Login.
//
// The optional `?userId=` query param is ONLY accepted when the bearer token
// resolves to that same user (it allows legacy callers to keep working without
// weakening auth). No identity data is ever returned for an unauthenticated
// request.
// ============================================================================

import { db } from '@/lib/db';
import { resolveUserPermissions } from '@/lib/db-permissions';
import { isPlatformOwnerEmail } from '@/lib/permissions';
import { NextResponse } from 'next/server';

const PLATFORM_ROLES = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'];

const SESSION_EXPIRED = { success: false, error: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.' };

function authRequired() {
  return NextResponse.json({ success: false, error: 'Authentication required. Please sign in.' }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    // ── Token validation (server-side, authoritative) ───────────────────
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return authRequired();
    }
    const token = authHeader.slice(7).trim();
    if (!token) return authRequired();

    const session = await db.refreshToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            businessUsers: {
              where: { isActive: true },
              include: {
                business: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    businessType: true,
                    status: true,
                    primaryColor: true,
                    logo: true,
                  },
                },
                store: { select: { id: true, name: true } },
              },
            },
            salesProfile: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(SESSION_EXPIRED, { status: 401 });
    }
    if (!session.user.isActive) {
      return NextResponse.json({ success: false, error: 'Account is deactivated. Please contact support.' }, { status: 403 });
    }

    const user = session.user;

    // Legacy callers may pass ?userId= — only honoured if it matches the
    // token holder. A mismatched userId is treated as an auth failure, never
    // as an identity switch.
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== user.id) {
      return authRequired();
    }

    // ── Resolve role + permissions ──────────────────────────────────────
    let primaryRole = 'CUSTOMER';
    const isOwnerEmail = isPlatformOwnerEmail(user.email);
    const isPlatformUser = (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) || isOwnerEmail;
    if (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) {
      primaryRole = user.platformRole;
    } else if (isOwnerEmail) {
      primaryRole = 'QUANTIX_SUPER_ADMIN';
    } else if (user.businessUsers.length > 0) {
      primaryRole = user.businessUsers[0].role;
    }
    const primaryPermissions = await resolveUserPermissions(
      primaryRole,
      isPlatformUser ? (user.platformPermissions ?? null) : null
    );

    const businesses = await Promise.all(user.businessUsers.map(async (bu) => ({
      businessId: bu.businessId,
      role: bu.role,
      permissions: await resolveUserPermissions(bu.role, null),
      business: bu.business,
      storeId: bu.storeId,
      store: bu.store,
      isActive: bu.isActive,
      acceptedAt: bu.acceptedAt,
    })));

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
          platformRole: user.platformRole ?? null,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        role: primaryRole,
        permissions: primaryPermissions,
        businesses,
        salesProfile: user.salesProfile
          ? {
              id: user.salesProfile.id,
              name: user.salesProfile.name,
              email: user.salesProfile.email,
              phone: user.salesProfile.phone,
              region: user.salesProfile.region,
              target: user.salesProfile.target,
              achieved: user.salesProfile.achieved,
              isActive: user.salesProfile.isActive,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[me] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}
