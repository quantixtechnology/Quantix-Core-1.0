// ============================================================================
// QUANTIX CORE — Platform Users API
// GET  /api/core/users  — List users (filtered by scope / role / business)
// POST /api/core/users  — Create a platform-level user (Super Admin only)
//
// Architecture rule:
//   Platform staff  → role stored on User.platformRole (no businessId needed)
//   Business staff  → role stored on BusinessUser.role (scoped to a business)
//   Self-signup is NOT supported. All credentials assigned by admin.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { getPermissionsForRole } from '@/lib/permissions';
import { Role } from '@prisma/client';

// Roles that live on User.platformRole (no business association required)
const PLATFORM_ROLES = [
  'QUANTIX_SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'QUANTIX_SALES_TEAM',
  'SUPPORT_TEAM',
  'DEPLOYMENT_TEAM',
  'FINANCE_TEAM',
];

// ============================================================================
// GET — List users with filtering
// ============================================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const scope       = searchParams.get('scope') || 'ALL'; // ALL | PLATFORM | BUSINESS
    const roleFilter  = searchParams.get('role');            // specific role value
    const businessId  = searchParams.get('businessId');
    const statusFilter= searchParams.get('status');          // ACTIVE | INACTIVE
    const search      = searchParams.get('search');
    const page        = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit       = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip        = (page - 1) * limit;

    // Build common user-level filter
    const userWhere: Record<string, unknown> = {};
    if (statusFilter === 'ACTIVE')   userWhere.isActive = true;
    if (statusFilter === 'INACTIVE') userWhere.isActive = false;
    if (search) {
      userWhere.OR = [
        { email: { contains: search } },
        { name:  { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // ── PLATFORM scope: query via User.platformRole ─────────────────────────
    const isPlatformScope = scope === 'PLATFORM' || (!!roleFilter && PLATFORM_ROLES.includes(roleFilter));
    const isBusinessScope = scope === 'BUSINESS' || (!!businessId) || (!!roleFilter && !PLATFORM_ROLES.includes(roleFilter));

    let users: Record<string, unknown>[];
    let total: number;

    if (isPlatformScope && !isBusinessScope) {
      const where: Record<string, unknown> = {
        ...userWhere,
        platformRole: roleFilter ? roleFilter : { not: null },
      };

      const rawUsers = await db.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, authProvider: true, createdAt: true,
          lastLoginAt: true, avatar: true, platformRole: true,
          salesProfile: {
            select: { id: true, region: true, target: true, achieved: true, isActive: true },
          },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      });

      total = await db.user.count({ where });

      users = rawUsers.map(u => ({
        id:           u.id,
        name:         u.name,
        email:        u.email,
        phone:        u.phone,
        isActive:     u.isActive,
        authProvider: u.authProvider,
        createdAt:    u.createdAt,
        lastLoginAt:  u.lastLoginAt,
        avatar:       u.avatar,
        role:         u.platformRole as string ?? null,
        businessId:   null,
        businessName: null,
        businessType: null,
        salesProfile: u.salesProfile ?? null,
      }));

    } else if (isBusinessScope && !isPlatformScope) {
      // ── BUSINESS scope: query via BusinessUser ────────────────────────────
      const buWhere: Record<string, unknown> = { isActive: true, user: userWhere };
      if (roleFilter)   buWhere.role = roleFilter;
      if (businessId)   buWhere.businessId = businessId;
      if (scope === 'BUSINESS' && !roleFilter) {
        buWhere.role = { notIn: PLATFORM_ROLES };
      }

      const businessUsers = await db.businessUser.findMany({
        where: buWhere,
        include: {
          user: {
            select: {
              id: true, name: true, email: true, phone: true,
              isActive: true, authProvider: true, createdAt: true,
              lastLoginAt: true, avatar: true,
            },
          },
          business: { select: { id: true, name: true, slug: true, businessType: true } },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      });

      total = await db.businessUser.count({ where: buWhere });

      // De-duplicate by userId
      const seen = new Set<string>();
      users = businessUsers.reduce<Record<string, unknown>[]>((acc, bu) => {
        if (!seen.has(bu.userId)) {
          seen.add(bu.userId);
          acc.push({
            ...bu.user,
            role:         bu.role,
            businessId:   bu.businessId,
            businessName: bu.business?.name,
            businessType: bu.business?.businessType,
            joinedAt:     bu.invitedAt,
            acceptedAt:   bu.acceptedAt,
          });
        }
        return acc;
      }, []);

    } else {
      // ── ALL scope: return every user, showing platformRole or primary BusinessUser role ──
      const rawUsers = await db.user.findMany({
        where: userWhere,
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, authProvider: true, createdAt: true,
          lastLoginAt: true, avatar: true, platformRole: true,
          businessUsers: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: {
              role: true, businessId: true,
              business: { select: { name: true, businessType: true } },
            },
          },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      });

      total = await db.user.count({ where: userWhere });

      users = rawUsers.map(u => {
        const primary = u.businessUsers[0];
        return {
          id:           u.id,
          name:         u.name,
          email:        u.email,
          phone:        u.phone,
          isActive:     u.isActive,
          authProvider: u.authProvider,
          createdAt:    u.createdAt,
          lastLoginAt:  u.lastLoginAt,
          avatar:       u.avatar,
          role:         (u.platformRole as string | null) ?? primary?.role ?? null,
          businessId:   primary?.businessId ?? null,
          businessName: primary?.business?.name ?? null,
          businessType: primary?.business?.businessType ?? null,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list users';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================================
// POST — Create a platform-level user (Super Admin only)
// For business staff, use POST /api/core/businesses/[businessId]/staff
// ============================================================================
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name: string;
      email: string;
      phone?: string;
      role: string;
      password?: string;
      businessId?: string;
      // Sales profile fields (only used when role = QUANTIX_SALES_TEAM)
      region?: string;
      target?: number;
      commissionPercent?: number;
      designation?: string;
      reportingManager?: string;
    };

    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { success: false, error: 'name, email, and role are required' },
        { status: 400 }
      );
    }

    // Only platform roles are created here
    if (!PLATFORM_ROLES.includes(body.role)) {
      return NextResponse.json(
        { success: false, error: `Role "${body.role}" is a business role — use the business staff endpoint instead` },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    const rawPassword = body.password || `${body.name.replace(/[^a-zA-Z0-9]/g, '')}@123`;
    const passwordHash = await hashPassword(rawPassword);
    const defaultPermissions = getPermissionsForRole(body.role);

    const result = await db.$transaction(async (tx) => {
      // Create User with platformRole set
      const user = await tx.user.create({
        data: {
          name:         body.name,
          email:        body.email,
          phone:        body.phone || null,
          passwordHash,
          authProvider: 'PASSWORD',
          emailVerified: false,
          isActive:     true,
          platformRole: body.role as Role,
        },
      });

      // If role = QUANTIX_SALES_TEAM, auto-create the SalesTeamMember profile
      if (body.role === 'QUANTIX_SALES_TEAM') {
        await tx.salesTeamMember.create({
          data: {
            userId:            user.id,
            name:              body.name,
            email:             body.email,
            phone:             body.phone || '',
            region:            body.region || 'Pan India',
            designation:       body.designation || null,
            reportingManager:  body.reportingManager || null,
            commissionPercent: body.commissionPercent ?? 5,
            target:            body.target ?? 0,
            achieved:          0,
            isActive:          true,
          },
        });
      }

      // Also create BusinessUser if a specific business is provided
      if (body.businessId) {
        await tx.businessUser.create({
          data: {
            userId:      user.id,
            businessId:  body.businessId,
            role:        body.role as Role,
            permissions: JSON.stringify(defaultPermissions),
            isActive:    true,
            invitedAt:   new Date(),
            acceptedAt:  new Date(),
          },
        });
      }

      return user;
    });

    // Log activity (non-critical)
    await db.activityLog.create({
      data: {
        businessId: body.businessId || 'platform',
        action:     'user.created',
        entity:     'User',
        entityId:   result.id,
        details:    JSON.stringify({ name: body.name, email: body.email, role: body.role }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        id:          result.id,
        name:        result.name,
        email:       result.email,
        phone:       result.phone,
        role:        body.role,
        platformRole: body.role,
        isActive:    result.isActive,
        createdAt:   result.createdAt,
      },
      credentials: {
        email:    result.email,
        password: rawPassword,
      },
      message: 'User created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
