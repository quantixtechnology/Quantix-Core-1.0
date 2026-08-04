"use client"

import type { ReactNode } from "react"
import { Shield } from "lucide-react"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import { PageLoader } from "@/components/ui/page-loader"
import { hasLaundryWorkspaceAccess, laundryRoleLabel } from "@/lib/runtime-auth"

/**
 * Single authorization gate for the entire Laundry OS workspace.
 *
 * Entry is allowed iff the session's effective role grants `laundry.dashboard`
 * at VIEW or above (or the user is an owner/platform identity). This is the
 * SAME permission object used by the sidebar, the dashboard widgets and every
 * `requireLaundryLevel` API guard. BusinessUser.role / legacy BUSINESS_ROLES
 * are never consulted here — a tenant user with no Laundry RBAC assignment
 * is denied, not defaulted to a legacy role.
 */
export function LaundryWorkspaceGate({ children }: { children: ReactNode }) {
  const { isLoaded, isOwner, screenLevels, assignedRbacRole } = useRuntimeAuth()

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader />
      </div>
    )
  }

  const canEnter = hasLaundryWorkspaceAccess(screenLevels, isOwner)

  if (!canEnter) {
    const roleName = assignedRbacRole ? laundryRoleLabel(assignedRbacRole) : "unassigned"
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Shield className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Access Denied</h2>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Your role ({roleName}) does not include access to the Laundry workspace.
          Contact your Business Owner to be assigned the correct role in Roles &amp; Permissions.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
