// GET  /api/admin/rbac/[role] — get effective permissions (template + DB override)
// PUT  /api/admin/rbac/[role] — save custom permissions to DB
// POST /api/admin/rbac/[role] — clone permissions from another role

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTemplatePermissions, ROLE_META } from '@/lib/rbac/role-templates';
import { allPermissionKeys } from '@/lib/rbac/permission-definitions';

type Ctx = { params: Promise<{ role: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { role } = await params;

  if (!ROLE_META.find(r => r.id === role)) {
    return NextResponse.json({ success: false, error: 'Unknown role' }, { status: 404 });
  }

  const record = await db.rolePermission.findUnique({ where: { role } });
  const permissions: string[] = record
    ? (record.permissions as string[])
    : getTemplatePermissions(role);

  return NextResponse.json({
    success: true,
    data: { role, permissions, isCustomized: !!record, updatedAt: record?.updatedAt ?? null },
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { role } = await params;
    const body = await req.json() as { permissions: string[]; userId?: string; userEmail?: string; note?: string };

    if (!ROLE_META.find(r => r.id === role)) {
      return NextResponse.json({ success: false, error: 'Unknown role' }, { status: 404 });
    }

    const validKeys = new Set(allPermissionKeys());
    const permissions = body.permissions.filter(k => validKeys.has(k));

    // Capture previous state for audit log
    const existing = await db.rolePermission.findUnique({ where: { role } });
    const oldPerms: string[] = existing ? (existing.permissions as string[]) : getTemplatePermissions(role);

    const added   = permissions.filter(k => !oldPerms.includes(k));
    const removed = oldPerms.filter(k => !permissions.includes(k));

    // Upsert permission record
    await db.rolePermission.upsert({
      where: { role },
      update: { permissions, updatedBy: body.userId ?? null },
      create: { role, permissions, updatedBy: body.userId ?? null },
    });

    // Invalidate active tokens for all users with this role so they must
    // re-authenticate and receive fresh permissions. Exclude the admin
    // making the change so their own session is not interrupted.
    if (added.length > 0 || removed.length > 0) {
      const platformRoles = ['QUANTIX_SUPER_ADMIN', 'PLATFORM_ADMIN', 'QUANTIX_SALES_TEAM', 'SUPPORT_TEAM', 'DEPLOYMENT_TEAM', 'FINANCE_TEAM'];
      let affectedUserIds: string[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (platformRoles.includes(role)) {
        const users = await db.user.findMany({ where: { platformRole: role as any }, select: { id: true } });
        affectedUserIds = users.map(u => u.id);
      } else {
        const bus = await db.businessUser.findMany({ where: { role: role as any, isActive: true }, select: { userId: true } });
        affectedUserIds = [...new Set(bus.map(bu => bu.userId))];
      }

      // Keep the admin's own session alive
      const idsToInvalidate = affectedUserIds.filter(id => id !== body.userId);
      if (idsToInvalidate.length > 0) {
        await db.refreshToken.deleteMany({ where: { userId: { in: idsToInvalidate } } }).catch(() => null);
      }
    }

    // Write audit entry
    if (added.length > 0 || removed.length > 0) {
      await db.permissionChangeLog.create({
        data: {
          role,
          changedBy: body.userId ?? 'unknown',
          changedByEmail: body.userEmail ?? null,
          oldPerms,
          newPerms: permissions,
          added,
          removed,
          note: body.note ?? null,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      data: { role, permissions, added: added.length, removed: removed.length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save permissions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { role } = await params;
    const body = await req.json() as { cloneFrom: string; userId?: string };

    if (!ROLE_META.find(r => r.id === role) || !ROLE_META.find(r => r.id === body.cloneFrom)) {
      return NextResponse.json({ success: false, error: 'Unknown role' }, { status: 404 });
    }

    const source = await db.rolePermission.findUnique({ where: { role: body.cloneFrom } });
    const permissions: string[] = source
      ? (source.permissions as string[])
      : getTemplatePermissions(body.cloneFrom);

    await db.rolePermission.upsert({
      where: { role },
      update: { permissions, updatedBy: body.userId ?? null },
      create: { role, permissions, updatedBy: body.userId ?? null },
    });

    return NextResponse.json({ success: true, data: { role, clonedFrom: body.cloneFrom, count: permissions.length } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to clone permissions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
