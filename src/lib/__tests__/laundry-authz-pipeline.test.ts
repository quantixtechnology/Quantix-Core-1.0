import { describe, it, expect } from "vitest"
import { Level, isValidScreenKey, isScreenAccessible } from "@/lib/laundry-rbac-registry"
import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import { laundryRoleLabel, hasLaundryWorkspaceAccess } from "@/lib/runtime-auth"
import { resolveLaundryLandingPage, accessibleLaundryPages } from "@/lib/laundry-nav-config"
import { isOwnerRole, resolveUnassignedPermissions } from "@/lib/laundry-rbac"

// ============================================================================
// Single-authorization-pipeline regression (FIX 1/3/5) + permission-driven
// workspace entry & RBAC-driven landing (permission registry + nav registry).
// ============================================================================

const roleLevels = (code: string): Record<string, number> => {
  const role = SYSTEM_ROLES.find((r) => r.code === code)
  if (!role) return {}
  return Object.fromEntries(role.screens().map((s) => [s.screenKey, s.level]))
}

describe("laundryRoleLabel — header/user-menu show the assigned RBAC role", () => {
  it("resolves RBAC role codes to their catalog display names", () => {
    expect(laundryRoleLabel("CRM_MANAGER")).toBe("CRM Manager")
    expect(laundryRoleLabel("CRM_EXECUTIVE")).toBe("CRM Executive")
    expect(laundryRoleLabel("STORE_SUPERVISOR")).toBe("Store Supervisor")
    expect(laundryRoleLabel("COUNTER_EXECUTIVE")).toBe("Counter Executive")
    expect(laundryRoleLabel("PROCESSING_STAFF")).toBe("Processing Staff")
    expect(laundryRoleLabel("ACCOUNTANT")).toBe("Accountant")
    expect(laundryRoleLabel("VIEWER")).toBe("Viewer")
    expect(laundryRoleLabel("DELIVERY_EXECUTIVE")).toBe("Delivery Executive")
    expect(laundryRoleLabel("BUSINESS_OWNER")).toBe("Business Owner")
  })

  it("never labels a tenant user with the legacy BusinessUser.role — only the assigned RBAC code is surfaced", () => {
    // The header shows the assigned RBAC role, not "STORE_EXECUTIVE".
    expect(laundryRoleLabel("CRM_MANAGER")).not.toBe("Store Executive")
  })

  it("falls back to the raw code for unknown roles and empty for no role", () => {
    expect(laundryRoleLabel("UNASSIGNED")).toBe("Unassigned")
    expect(laundryRoleLabel("")).toBe("")
  })
})

describe("hasLaundryWorkspaceAccess — permission-driven entry, no module/role assumptions", () => {
  it("grants entry to every catalog role (regression: no role is locked out)", () => {
    for (const role of SYSTEM_ROLES) {
      if (role.isOwner) continue
      expect(hasLaundryWorkspaceAccess(roleLevels(role.code), false), `${role.code} must enter the workspace`).toBe(true)
    }
  })

  it("grants entry to owners unconditionally", () => {
    expect(hasLaundryWorkspaceAccess({}, true)).toBe(true)
  })

  it("grants entry from a SINGLE screen in ANY registered module — the engine has no module list", () => {
    const singleScreens = [
      "laundry.orders",
      "crm.leads",
      "processing.washing",
      "store_ops.dispatch_center",
      "marketing.coupons",
      "customer_app.orders",
    ]
    for (const key of singleScreens) {
      expect(hasLaundryWorkspaceAccess({ [key]: Level.VIEW }, false), `${key} alone must grant entry`).toBe(true)
    }
  })

  it("grants entry for any combination of screens (custom roles: 1, 5, 50 screens)", () => {
    expect(hasLaundryWorkspaceAccess({ "crm.dashboard": Level.VIEW, "laundry.reports": Level.VIEW }, false)).toBe(true)
    expect(hasLaundryWorkspaceAccess({ "store_ops.store_audit": Level.CREATE, "laundry.reports": Level.EDIT }, false)).toBe(true)
    expect(hasLaundryWorkspaceAccess({ "laundry.orders": Level.EDIT, "crm.leads": Level.CREATE, "marketing.dashboard": Level.VIEW }, false)).toBe(true)
  })

  it("denies entry with zero accessible screens (UNASSIGNED)", () => {
    expect(hasLaundryWorkspaceAccess({}, false)).toBe(false)
    expect(hasLaundryWorkspaceAccess({ "laundry.dashboard": Level.HIDE }, false)).toBe(false)
  })

  it("does not grant entry for screens that are not registered in the permission registry", () => {
    expect(hasLaundryWorkspaceAccess({ "finance.reports": Level.EDIT }, false)).toBe(false)
    expect(hasLaundryWorkspaceAccess({ "processing.drying": Level.EDIT }, false)).toBe(false)
  })

  it("denies entry to a legacy STORE_EXECUTIVE with no RBAC assignment (no inherited permissions)", () => {
    // BusinessUser.role = STORE_EXECUTIVE with no LaundryAccessAssignment
    // resolves to an empty level map — the workspace is denied.
    expect(hasLaundryWorkspaceAccess({}, false)).toBe(false)
  })
})

describe("resolveLaundryLandingPage — RBAC-driven landing (no hardcoded role names)", () => {
  it("lands a CRM-only session on the CRM dashboard", () => {
    const levels = { "crm.dashboard": Level.EDIT, "crm.leads": Level.CREATE, "crm.activities": Level.CREATE }
    expect(resolveLaundryLandingPage(levels, false)).toBe("crm-dashboard")
  })

  it("lands a dispatch-only session on the Dispatch Center", () => {
    expect(resolveLaundryLandingPage({ "store_ops.dispatch_center": Level.CREATE }, false)).toBe("dispatch-center")
  })

  it("lands a processing-only session on the first accessible processing screen", () => {
    expect(resolveLaundryLandingPage({ "processing.console_receive": Level.CREATE }, false)).toBe("processing-centers")
    expect(resolveLaundryLandingPage({ "processing.washing": Level.CREATE }, false)).toBe("ws-wash")
  })

  it("lands an owner on the laundry dashboard", () => {
    expect(resolveLaundryLandingPage({}, true)).toBe("dashboard")
  })

  it("lands a viewer (read-only everywhere) on the first readable screen (dashboard)", () => {
    expect(resolveLaundryLandingPage({ "laundry.dashboard": Level.VIEW }, false)).toBe("dashboard")
  })

  it("lands system roles that hold laundry.dashboard on the dashboard", () => {
    expect(resolveLaundryLandingPage(roleLevels("PROCESSING_STAFF"), false)).toBe("dashboard")
    expect(resolveLaundryLandingPage(roleLevels("CRM_MANAGER"), false)).toBe("dashboard")
  })

  it("falls back to the dashboard when nothing is navigable (entry denies anyway)", () => {
    expect(resolveLaundryLandingPage({}, false)).toBe("dashboard")
  })

  it("works for arbitrary role combinations without any role/module assumptions", () => {
    // "Laundry Auditor" — Store + Reports → Reports appears first in navigation order.
    expect(resolveLaundryLandingPage({ "store_ops.store_audit": Level.CREATE, "laundry.reports": Level.VIEW }, false)).toBe("reports")
    // "CRM + Orders" → first accessible in navigation order is Orders.
    expect(resolveLaundryLandingPage({ "laundry.orders": Level.CREATE, "crm.dashboard": Level.VIEW }, false)).toBe("orders")
    // One screen only → that screen's page.
    expect(resolveLaundryLandingPage({ "crm.leads": Level.CREATE }, false)).toBe("crm-leads")
    expect(resolveLaundryLandingPage({ "store_ops.ready_for_delivery": Level.VIEW }, false)).toBe("ready-delivery-queue")
  })
})

describe("isScreenAccessible / accessibleLaundryPages — nav visibility matches RBAC", () => {
  it("exposes only the pages a CRM-only session may open", () => {
    const levels = { "crm.dashboard": Level.EDIT, "crm.leads": Level.CREATE }
    const pages = accessibleLaundryPages(levels, false)
    expect(pages.has("crm-dashboard")).toBe(true)
    expect(pages.has("crm-leads")).toBe(true)
    expect(pages.has("dashboard")).toBe(false)
    expect(pages.has("orders")).toBe(false)
    expect(pages.has("processing-centers")).toBe(false)
  })

  it("treats owners as having every page", () => {
    const pages = accessibleLaundryPages({}, true)
    expect(pages.has("dashboard")).toBe(true)
    expect(pages.has("roles")).toBe(true)
    expect(pages.has("crm-dashboard")).toBe(true)
  })

  it("grants access only for the exact registered screen key (no legacy fallback)", () => {
    // The single resolver decides purely on the screenKey → level map. Holding
    // "laundry.orders" must NEVER open "laundry.new_order" — no legacy grants.
    expect(isScreenAccessible({ "laundry.orders": Level.CREATE }, false, "laundry.new_order")).toBe(false)
    expect(isScreenAccessible({ "laundry.new_order": Level.CREATE }, false, "laundry.new_order")).toBe(true)
    expect(isScreenAccessible({ "laundry.orders": Level.CREATE }, false, "store_ops.dispatch_center")).toBe(false)
    expect(isScreenAccessible({ "store_ops.dispatch_center": Level.CREATE }, false, "store_ops.dispatch_center")).toBe(true)
  })

  it("never grants access for alias / unregistered keys (no alias key space)", () => {
    expect(isScreenAccessible({ "laundry.orders": Level.CREATE }, false, "dispatch-center")).toBe(false)
    expect(isScreenAccessible({ "laundry.orders": Level.CREATE }, false, "new-order")).toBe(false)
    expect(isScreenAccessible({}, false, "new-order")).toBe(false)
  })
})

describe("resolveUnassignedPermissions — BusinessUser.role never grants access (FIX 5)", () => {
  it("returns zero screens for an unassigned tenant", () => {
    const r = resolveUnassignedPermissions()
    expect(r.isOwner).toBe(false)
    expect(r.roleCode).toBe("UNASSIGNED")
    expect(r.roleName).toBe("No Access")
    expect(r.levels.size).toBe(0)
    expect(r.permissions.size).toBe(0)
  })

  it("STORE_EXECUTIVE is not an owner identity and resolves to no screens", () => {
    expect(isOwnerRole("STORE_EXECUTIVE")).toBe(false)
    const r = resolveUnassignedPermissions()
    expect(r.levels.has("laundry.dashboard")).toBe(false)
    expect(r.levels.has("store_ops.dispatch_center")).toBe(false)
    expect(r.levels.has("processing.washing")).toBe(false)
  })

  it("every screen key in the catalog is a valid registry key", () => {
    for (const role of SYSTEM_ROLES) {
      for (const s of role.screens()) {
        expect(isValidScreenKey(s.screenKey), `${role.code}: ${s.screenKey}`).toBe(true)
      }
    }
  })
})
