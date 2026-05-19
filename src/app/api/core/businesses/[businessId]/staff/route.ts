// ============================================================================
// QUANTIX CORE — Business Staff API
// GET  /api/core/businesses/[businessId]/staff  — List staff (CLIENT_OWNER+)
// POST /api/core/businesses/[businessId]/staff  — Create staff member (CLIENT_OWNER+)
//
// Business Owners can manage STORE_MANAGER, BILLING_STAFF, INVENTORY_STAFF,
// SUPPORT_STAFF, DELIVERY_STAFF under their own businessId.
// All credentials are admin-assigned. No self-signup.
// ============================================================================

import { NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/middleware';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password-utils';
import { getPermissionsForRole } from '@/lib/permissions';
import { Role } from '@prisma/client';

const BUSINESS_STAFF_ROLES = [
  'CLIENT_OWNER', 'STORE_MANAGER', 'BILLING_STAFF',
  'INVENTORY_STAFF', 'SUPPORT_STAFF', 'DELIVERY_STAFF',
];

export const GET = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get('role');
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search');

    const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true } });
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });

    const where: Record<string, unknown> = { businessId };
    if (roleFilter) where.role = roleFilter;
    if (statusFilter === 'ACTIVE') where.isActive = true;
    if (statusFilter === 'INACTIVE') where.isActive = false;

    const userWhere: Record<string, unknown> = {};
    if (search) {
      userWhere.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const staff = await db.businessUser.findMany({
      where: { ...where, user: Object.keys(userWhere).length ? userWhere : undefined },
      include: {
        user: {
          select: {
            id: true, name: true, email: true, loginId: true, phone: true, avatar: true,
            isActive: true, createdAt: true, lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = staff.map((bu) => ({
      businessUserId: bu.id,
      userId: bu.userId,
      name: bu.user.name,
      email: bu.user.email,
      loginId: bu.user.loginId,
      phone: bu.user.phone,
      avatar: bu.user.avatar,
      role: bu.role,
      isActive: bu.isActive && bu.user.isActive,
      permissions: bu.permissions ? JSON.parse(bu.permissions) as string[] : [],
      joinedAt: bu.invitedAt,
      acceptedAt: bu.acceptedAt,
      lastLoginAt: bu.user.lastLoginAt,
      createdAt: bu.createdAt,
    }));

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list staff';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

export const POST = withMiddleware({ requireAuth: true, requiredRoles: ['CLIENT_OWNER', 'QUANTIX_SUPER_ADMIN', 'QUANTIX_SALES_TEAM'] })(async (req, context) => {
  try {
    const params = await context?.params;
    const businessId = params?.businessId as string;
    if (!businessId) return NextResponse.json({ success: false, error: 'businessId is required' }, { status: 400 });

    const user = req.user!;
    if (!user.isPlatformAdmin && user.businessId !== businessId) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }

    const body = await req.json() as {
      name: string; email: string; phone?: string; role: string;
      password?: string; permissions?: string[];
    };

    if (!body.name || !body.email || !body.role) {
      return NextResponse.json({ success: false, error: 'name, email, and role are required' }, { status: 400 });
    }

    if (!BUSINESS_STAFF_ROLES.includes(body.role)) {
      return NextResponse.json({ success: false, error: `Invalid staff role: ${body.role}` }, { status: 400 });
    }

    const business = await db.business.findUnique({ where: { id: businessId }, select: { id: true, name: true } });
    if (!business) return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });

    let dbUser = await db.user.findUnique({ where: { email: body.email } });
    const rawPassword = body.password || `${body.name.replace(/[^a-zA-Z0-9]/g, '')}@123`;

    if (dbUser) {
      const existing = await db.businessUser.findUnique({
        where: { userId_businessId: { userId: dbUser.id, businessId } },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'This user is already a staff member of this business' },
          { status: 409 }
        );
      }
      const passwordHash = await hashPassword(rawPassword);
      await db.user.update({ where: { id: dbUser.id }, data: { passwordHash, isActive: true } });
    } else {
      const passwordHash = await hashPassword(rawPassword);
      dbUser = await db.user.create({
        data: {
          name: body.name, email: body.email, loginId: body.email, phone: body.phone || null,
          passwordHash, authProvider: 'PASSWORD', emailVerified: false, isActive: true,
        },
      });
    }

    const defaultPermissions = body.permissions ?? getPermissionsForRole(body.role);

    const businessUser = await db.businessUser.create({
      data: {
        userId: dbUser.id, businessId, role: body.role as Role,
        permissions: JSON.stringify(defaultPermissions),
        isActive: true, invitedAt: new Date(), acceptedAt: new Date(),
      },
    });

    await db.activityLog.create({
      data: {
        businessId, action: 'staff.created', entity: 'BusinessUser', entityId: businessUser.id,
        details: JSON.stringify({ email: body.email, role: body.role }),
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        businessUserId: businessUser.id, userId: dbUser.id,
        name: dbUser.name, email: dbUser.email, phone: dbUser.phone,
        role: body.role, businessId, isActive: true, permissions: defaultPermissions,
      },
      credentials: { email: dbUser.email, password: rawPassword },
      message: 'Staff member created successfully',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create staff member';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
