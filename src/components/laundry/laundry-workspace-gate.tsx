"use client"

import { useEffect, type ReactNode } from "react"
import { Shield } from "lucide-react"
import { useRuntimeAuth } from "@/hooks/use-runtime-auth"
import { useAdminStore, type LaundryBusinessPage } from "@/stores/admin-store"
import { PageLoader } from "@/components/ui/page-loader"
import { hasLaundryWorkspaceAccess, laundryRoleLabel } from "@/lib/runtime-auth"
import { accessibleLaundryPages, resolveLaundryLandingPage } from "@/lib/laundry-nav-config"

/**
 * Single authorization gate for the entire Laundry OS workspace — fully
 * permission-driven.
 *
 * Entry is allowed iff the resolved permission object contains at least ONE
 * registered screen at VIEW or above (owner/platform identities always enter).
 * No module names, role names or screen names are consulted. A tenant user with
 * zero accessible screens (UNASSIGNED) is denied — never defaulted to a legacy
 * role.
 *
 * Landing: once entry is granted, a session still sitting on the default
 * "dashboard" page that has no accessible page mapped to it is redirected to
 * its FIRST accessible page — walking the navigation registry in configured
 * order through the same permission resolver. No role-based or module-based
 * logic. Programmatic pages (order-detail, audit-barcode) and explicit user
 * navigation are never overridden.
 */
export function LaundryWorkspaceGate({ children }: { children: ReactNode }) {
  const { isLoaded, isOwner, screenLevels, assignedRbacRole } = useRuntimeAuth()
  const { laundryPage, setLaundryPage } = useAdminStore()

  const landing = resolveLaundryLandingPage(screenLevels, isOwner) as LaundryBusinessPage
  const accessible = accessibleLaundryPages(screenLevels, isOwner)
  // Redirect ONLY when the session is still on the default "dashboard" page and
  // that page is not reachable through any accessible nav item (and there is a
  // navigable alternative). Nothing else is overridden.
  const needsLanding = laundryPage === "dashboard" && !accessible.has("dashboard") && landing !== "dashboard"

  useEffect(() => {
    if (needsLanding) setLaundryPage(landing)
  }, [needsLanding, landing, setLaundryPage])

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

  if (needsLanding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <PageLoader />
      </div>
    )
  }

  return <>{children}</>
}
