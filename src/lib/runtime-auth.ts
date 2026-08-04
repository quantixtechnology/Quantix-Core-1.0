import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import { Level } from "@/lib/laundry-rbac-registry"
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

/** The single screen key that gates entry to the Laundry OS workspace. */
export const LAUNDRY_WORKSPACE_ENTRY_KEY = "laundry.dashboard"

/**
 * Workspace entry authorization. Allows entry iff the effective RBAC role
 * grants `laundry.dashboard` at VIEW or above, or the session is an owner /
 * platform identity. This is the SAME permission object the sidebar, dashboard
 * widgets and every `requireLaundryLevel` API guard consume. BusinessUser.role
 * and legacy role enums are never consulted.
 */
export function hasLaundryWorkspaceAccess(screenLevels: Record<string, number>, isOwner: boolean): boolean {
  return isOwner || (screenLevels[LAUNDRY_WORKSPACE_ENTRY_KEY] ?? 0) >= Level.VIEW
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
