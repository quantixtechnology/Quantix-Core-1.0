// ============================================================================
// QUANTIX CORE — User Detail API
// GET /api/core/users/[userId]  — Get user with all associations
// PUT /api/core/users/[userId]  — Update user profile / role / permissions
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';

type Params = { params: Promise<{ userId: string }> };

const PLATFORM_ROLES = [
  'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM',
  'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM',
];

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true,
        isActive: true, authProvider: true, emailVerified: true,
        createdAt: true, lastLoginAt: true, platformRole: true, platformPermissions: true,
        salesProfile: {
          select: {
            id: true, region: true, target: true, achieved: true,
            commissionPercent: true, designation: true, reportingManager: true, isActive: true,
          },
        },
        businessUsers: {
          include: {
            business: {
              select: { id: true, name: true, slug: true, businessType: true, status: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const { userId } = await params;
    const body = await request.json() as {
      name?: string;
      phone?: string;
      avatar?: string;
      role?: string;
      businessId?: string;
      permissions?: string[];
      platformPermissions?: string[];
    };

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name  !== undefined) updateData.name  = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.avatar!== undefined) updateData.avatar= body.avatar || null;

    // If updating to a platform role, store it on the user itself
    if (body.role && PLATFORM_ROLES.includes(body.role)) {
      updateData.platformRole = body.role as Role;
    }

    // Save custom platform-level permissions for platform team members
    if (body.platformPermissions !== undefined) {
      updateData.platformPermissions = JSON.stringify(body.platformPermissions);
    }

    const updated = await db.user.update({ where: { id: userId }, data: updateData });

    // If updating role/permissions for a specific business, upsert BusinessUser
    if (body.role && body.businessId && !PLATFORM_ROLES.includes(body.role)) {
      await db.businessUser.upsert({
        where: { userId_businessId: { userId, businessId: body.businessId } },
        update: {
          role: body.role as Role,
          permissions: body.permissions ? JSON.stringify(body.permissions) : undefined,
        },
        create: {
          userId,
          businessId: body.businessId,
          role: body.role as Role,
          permissions: body.permissions ? JSON.stringify(body.permissions) : '[]',
          isActive:   true,
          invitedAt:  new Date(),
          acceptedAt: new Date(),
        },
      });
    } else if (body.permissions && body.businessId) {
      await db.businessUser.updateMany({
        where: { userId, businessId: body.businessId },
        data:  { permissions: JSON.stringify(body.permissions) },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id:           updated.id,
        name:         updated.name,
        email:        updated.email,
        phone:        updated.phone,
        isActive:     updated.isActive,
        platformRole: updated.platformRole,
      },
      message: 'User updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
