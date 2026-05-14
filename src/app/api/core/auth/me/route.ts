// ============================================================================
// Route: GET /api/core/auth/me
// Get current user info with business associations and permissions
// ============================================================================

import { db } from '@/lib/db';
import { getDbPermissionsForRole } from '@/lib/db-permissions';
import { NextResponse } from 'next/server';

const PLATFORM_ROLES = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.user.findUnique({
      where: { id: userId },
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
            store: {
              select: { id: true, name: true },
            },
          },
        },
        salesProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'User account is deactivated' },
        { status: 403 }
      );
    }

    // Determine primary role and fetch DB-aware permissions
    let primaryRole = 'CUSTOMER';
    if (user.platformRole && PLATFORM_ROLES.includes(user.platformRole)) {
      primaryRole = user.platformRole;
    } else if (user.businessUsers.length > 0) {
      primaryRole = user.businessUsers[0].role;
    }
    const primaryPermissions = await getDbPermissionsForRole(primaryRole);

    // Build enriched business list with DB-aware permissions
    const businesses = await Promise.all(user.businessUsers.map(async (bu) => ({
      businessId: bu.businessId,
      role: bu.role,
      permissions: await getDbPermissionsForRole(bu.role),
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
