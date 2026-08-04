import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import { isScreenAccessible } from "@/lib/laundry-rbac-registry"
import { ROLES } from "@/lib/constants"

export interface RuntimeAuth {
  businessRole: string
  assignedRbacRole: string
  screenLevels: Record<string, number>
  isOwner: boolean
  isLoaded: boolean
  platformRole: string
}

export const UNAUTHORIZED: RuntimeAuth = {
  businessRole: "",
  assignedRbacRole: "",
  screenLevels: {},
  isOwner: false,
  isLoaded: false,
  platformRole: "",
}

/**
 * Workspace entry authorization — fully permission-driven.
 *
 * Entry is allowed iff the effective RBAC role grants at least ONE registered
 * screen at VIEW or above (or the session is an owner / platform identity). No
 * module names, role names or screen names are consulted — only the resolved
 * permission object. Any combination of screens grants entry; zero screens
 * denies. A tenant with no accessible screen (e.g. UNASSIGNED) is denied —
 * nothing is defaulted to a legacy role.
 */
export function hasLaundryWorkspaceAccess(screenLevels: Record<string, number>, isOwner: boolean): boolean {
  if (isOwner) return true
  return Object.keys(screenLevels).some((screenKey) => isScreenAccessible(screenLevels, false, screenKey))
}

const RBAC_ROLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(SYSTEM_ROLES.map((r) => [r.code, r.name])),
  UNASSIGNED: "Unassigned",
}

/**
 * Display label for an effective role. Resolves Laundry RBAC role codes
 * (assignedRbacRole) to their catalog name first, then falls back to the
 * legacy role label map, then the raw code. Never shows the legacy
 * BusinessUser.role for a tenant user — the assigned RBAC role wins.
 */
export function laundryRoleLabel(roleCode: string): string {
  if (!roleCode) return ""
  const rbac = RBAC_ROLE_LABELS[roleCode]
  if (rbac) return rbac
  const legacy = ROLES[roleCode as keyof typeof ROLES]
  if (legacy) return legacy.label
  return roleCode
}
