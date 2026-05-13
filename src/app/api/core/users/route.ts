// ============================================================================
// QUANTIX CORE — Platform Users API
// GET  /api/core/users  — List all users (Super Admin / Platform Admin)
// POST /api/core/users  — Create a platform-level user (Super Admin only)
//
// Business staff are managed via /api/core/businesses/[businessId]/staff
// Self-signup is NOT supported. All credentials assigned by admin.
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { getPermissionsForRole } from '@/lib/permissions';
import { Role } from '@prisma/client';

const PLATFORM_ROLES = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM'];

// ============================================================================
// GET — List users with filtering
// ============================================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope') || 'ALL'; // ALL | PLATFORM | BUSINESS
    const roleFilter = searchParams.get('role');       // specific role
    const businessId = searchParams.get('businessId'); // filter by business
    const statusFilter = searchParams.get('status');   // ACTIVE | INACTIVE
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    // Build BusinessUser filter
    const buWhere: Record<string, unknown> = {};
    if (roleFilter) {
      buWhere.role = roleFilter;
    } else if (scope === 'PLATFORM') {
      buWhere.role = { in: PLATFORM_ROLES };
    } else if (scope === 'BUSINESS') {
      buWhere.role = { notIn: PLATFORM_ROLES };
    }
    if (businessId) {
      buWhere.businessId = businessId;
    }

    // Build User filter
    const userWhere: Record<string, unknown> = {};
    if (statusFilter === 'ACTIVE') userWhere.isActive = true;
    if (statusFilter === 'INACTIVE') userWhere.isActive = false;
    if (search) {
      userWhere.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    // If filtering by businessId or scope/role, go through businessUsers
    const hasBusinessFilter = businessId || roleFilter || scope !== 'ALL';

    let users: Record<string, unknown>[];
    let total: number;

    if (hasBusinessFilter) {
      const businessUsers = await db.businessUser.findMany({
        where: { ...buWhere, isActive: true, user: userWhere },
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
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      total = await db.businessUser.count({
        where: { ...buWhere, isActive: true, user: userWhere },
      });

      // De-duplicate by userId (user may belong to multiple businesses)
      const seen = new Set<string>();
      users = businessUsers.reduce<Record<string, unknown>[]>((acc, bu) => {
        if (!seen.has(bu.userId)) {
          seen.add(bu.userId);
          acc.push({
            ...bu.user,
            role: bu.role,
            businessId: bu.businessId,
            businessName: bu.business?.name,
            businessType: bu.business?.businessType,
            joinedAt: bu.invitedAt,
            acceptedAt: bu.acceptedAt,
          });
        }
        return acc;
      }, []);
    } else {
      // No scoping — return all users with their primary business association
      const rawUsers = await db.user.findMany({
        where: userWhere,
        select: {
          id: true, name: true, email: true, phone: true,
          isActive: true, authProvider: true, createdAt: true,
          lastLoginAt: true, avatar: true,
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
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      total = await db.user.count({ where: userWhere });

      users = rawUsers.map((u) => {
        const primary = u.businessUsers[0];
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          isActive: u.isActive,
          authProvider: u.authProvider,
          createdAt: u.createdAt,
          lastLoginAt: u.lastLoginAt,
          avatar: u.avatar,
          role: primary?.role ?? null,
          businessId: primary?.businessId ?? null,
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

    // Password is always admin-assigned
    const rawPassword = body.password || `${body.name.replace(/[^a-zA-Z0-9]/g, '')}@123`;
    const passwordHash = await hashPassword(rawPassword);
    const defaultPermissions = getPermissionsForRole(body.role);

    const user = await db.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        passwordHash,
        authProvider: 'PASSWORD',
        emailVerified: false,
        isActive: true,
      },
    });

    // Create BusinessUser for the assigned role
    // For platform roles (SUPER_ADMIN, SALES_TEAM, PLATFORM_ADMIN) businessId is optional
    if (body.businessId) {
      await db.businessUser.create({
        data: {
          userId: user.id,
          businessId: body.businessId,
          role: body.role as Role,
          permissions: JSON.stringify(defaultPermissions),
          isActive: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
    }

    // Log activity
    await db.activityLog.create({
      data: {
        businessId: body.businessId || 'platform',
        action: 'user.created',
        entity: 'User',
        entityId: user.id,
        details: JSON.stringify({ name: body.name, email: body.email, role: body.role }),
      },
    }).catch(() => null); // Non-critical

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: body.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      credentials: {
        email: user.email,
        password: rawPassword,
      },
      message: 'User created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
