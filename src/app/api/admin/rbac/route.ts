// GET /api/admin/rbac — list all roles with permission counts and last-update info

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ROLE_META } from '@/lib/rbac/role-templates';
import { getTemplatePermissions } from '@/lib/rbac/role-templates';
import { platformOnly } from "@/lib/platform-guard"

export async function GET(request: Request) {
  // Platform staff only — diagnostics/administration, never tenant-reachable.
  const _denied = await platformOnly(request)
  if (_denied) return _denied
  try {
    const dbRecords = await db.rolePermission.findMany({
      select: { role: true, updatedAt: true, updatedBy: true, permissions: true },
    });
    const dbMap = new Map(dbRecords.map(r => [r.role, r]));

    const roles = ROLE_META.map(meta => {
      const db = dbMap.get(meta.id);
      const permissions = db
        ? (db.permissions as string[])
        : getTemplatePermissions(meta.id);
      return {
        ...meta,
        permissionCount: permissions.length,
        isCustomized: !!db,
        lastUpdated: db?.updatedAt ?? null,
        lastUpdatedBy: db?.updatedBy ?? null,
      };
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load roles';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
