// ============================================================================
// DB-aware permission lookup — reads RolePermission table first, falls back
// to the static ROLE_PERMISSIONS map when no custom record exists.
// Use this everywhere a role's permissions need to be resolved (login,
// middleware, /me) so that RBAC admin changes take effect immediately.
// ============================================================================

import { db } from './db';
import { ROLE_PERMISSIONS } from './permissions';

export async function getDbPermissionsForRole(role: string): Promise<string[]> {
  try {
    const record = await db.rolePermission.findUnique({ where: { role } });
    if (record && Array.isArray(record.permissions)) {
      return record.permissions as string[];
    }
  } catch {
    // DB unavailable — fall through to static defaults
  }
  return (ROLE_PERMISSIONS[role] ?? []) as string[];
}
