// ============================================================================
// QUANTIX CORE — User Detail API
// GET /api/core/users/[userId]  — Get user with all business associations
// PUT /api/core/users/[userId]  — Update user profile / role / permissions
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Role } from '@prisma/client';

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true,
        isActive: true, authProvider: true, emailVerified: true,
        createdAt: true, lastLoginAt: true,
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
    };

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Update base profile fields
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null;

    const updated = await db.user.update({ where: { id: userId }, data: updateData });

    // If role/permissions update is requested and businessId is provided
    if (body.role && body.businessId) {
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
          isActive: true,
          invitedAt: new Date(),
          acceptedAt: new Date(),
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
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        isActive: updated.isActive,
      },
      message: 'User updated successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
