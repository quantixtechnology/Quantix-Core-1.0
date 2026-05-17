// ============================================================================
// QUANTIX CORE — User Detail API
// GET /api/core/users/[userId]  — Get user with all associations (platform admin)
// PUT /api/core/users/[userId]  — Update user profile / role / permissions (platform admin)
// ============================================================================

import { NextResponse } from 'next/server';
import { withPlatformAccess, createErrorResponse } from '@/lib/middleware';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';
import type { NextRequest } from 'next/server';

const PLATFORM_ROLES = [
  'QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM',
  'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withPlatformAccess(async (_req) => {
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
        return createErrorResponse('User not found', 404);
      }

      return NextResponse.json({ success: true, data: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get user';
      return createErrorResponse(message, 500);
    }
  })(request);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  return withPlatformAccess(async (req) => {
    try {
      const { userId } = await params;
      const body = await req.json() as {
        name?: string; phone?: string; avatar?: string; role?: string;
        businessId?: string; permissions?: string[];
        // Legacy: full permissions array override
        platformPermissions?: string[];
        // Preferred: explicit delta from role — {added, removed}
        // Pass {added:[], removed:[]} to clear all overrides (null stored)
        permissionOverrides?: { added: string[]; removed: string[] };
      };

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) {
        return createErrorResponse('User not found', 404);
      }

      const updateData: Record<string, unknown> = {};
      if (body.name   !== undefined) updateData.name   = body.name;
      if (body.phone  !== undefined) updateData.phone  = body.phone || null;
      if (body.avatar !== undefined) updateData.avatar = body.avatar || null;

      if (body.role && PLATFORM_ROLES.includes(body.role)) {
        updateData.platformRole = body.role as Role;
      }

      if (body.permissionOverrides !== undefined) {
        const { added = [], removed = [] } = body.permissionOverrides;
        if (added.length === 0 && removed.length === 0) {
          // Clear all overrides — user inherits purely from role
          updateData.platformPermissions = null;
        } else {
          updateData.platformPermissions = JSON.stringify({ added, removed });
        }
      } else if (body.platformPermissions !== undefined) {
        // Legacy path: full permissions array
        updateData.platformPermissions = JSON.stringify(body.platformPermissions);
      }

      const updated = await db.user.update({ where: { id: userId }, data: updateData });

      if (body.role && body.businessId && !PLATFORM_ROLES.includes(body.role)) {
        await db.businessUser.upsert({
          where: { userId_businessId: { userId, businessId: body.businessId } },
          update: {
            role: body.role as Role,
            permissions: body.permissions ? JSON.stringify(body.permissions) : undefined,
          },
          create: {
            userId, businessId: body.businessId, role: body.role as Role,
            permissions: body.permissions ? JSON.stringify(body.permissions) : '[]',
            isActive: true, invitedAt: new Date(), acceptedAt: new Date(),
          },
        });
      } else if (body.permissions && body.businessId) {
        await db.businessUser.updateMany({
          where: { userId, businessId: body.businessId },
          data: { permissions: JSON.stringify(body.permissions) },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id, name: updated.name, email: updated.email,
          phone: updated.phone, isActive: updated.isActive, platformRole: updated.platformRole,
        },
        message: 'User updated successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      return createErrorResponse(message, 500);
    }
  })(request);
}
