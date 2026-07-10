// ============================================================================
// DB-aware permission lookup — reads RolePermission table first, falls back
// to the static ROLE_PERMISSIONS map when no custom record exists.
// Use this everywhere a role's permissions need to be resolved (login,
// middleware, /me) so that RBAC admin changes take effect immediately.
// ============================================================================

import { db } from './db';
import { ROLE_PERMISSIONS } from './permissions';

// QUANTIX_SUPER_ADMIN always gets the full static permission set — never
// restricted by a DB row, because the Permission Matrix can save a stale row
// that predates newly-added permissions.
const SUPER_ADMIN_BYPASS_ROLES = new Set(['QUANTIX_SUPER_ADMIN']);

export async function getDbPermissionsForRole(role: string): Promise<string[]> {
  if (SUPER_ADMIN_BYPASS_ROLES.has(role)) {
    return (ROLE_PERMISSIONS[role] ?? []) as string[];
  }
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

/**
 * Resolve the effective permissions for a specific user.
 * = role permissions (from RBAC DB or static defaults)
 * + user-level added overrides
 * - user-level removed overrides
 *
 * If platformPermissions is null → pure role inheritance.
 * If platformPermissions is a JSON array (legacy) → treat as full explicit override.
 * If platformPermissions is {added, removed} → apply as delta to role permissions.
 */
export async function resolveUserPermissions(
  role: string,
  platformPermissions: string | null
): Promise<string[]> {
  const rolePerms = await getDbPermissionsForRole(role);
  // ABSOLUTE super-admin bypass: QUANTIX_SUPER_ADMIN always gets the full static
  // permission set and can never be reduced by a user-level override. A stale
  // legacy override array (predating newly-added permissions, e.g. products:view)
  // must not hide platform navigation such as System → Website Templates.
  if (SUPER_ADMIN_BYPASS_ROLES.has(role)) return rolePerms;
  if (!platformPermissions) return rolePerms;
  try {
    const stored: unknown = JSON.parse(platformPermissions);
    if (Array.isArray(stored)) {
      // Legacy full-array override — use as-is
      return stored as string[];
    }
    if (stored && typeof stored === 'object') {
      const obj = stored as Record<string, unknown>;
      const added: string[] = Array.isArray(obj.added) ? (obj.added as string[]) : [];
      const removed: string[] = Array.isArray(obj.removed) ? (obj.removed as string[]) : [];
      if (added.length === 0 && removed.length === 0) return rolePerms;
      return [...new Set([...rolePerms, ...added].filter(p => !removed.includes(p)))];
    }
  } catch { /* ignore — fall through to role defaults */ }
  return rolePerms;
}
