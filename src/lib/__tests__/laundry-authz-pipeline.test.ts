import { describe, it, expect } from "vitest"
import { Level, isValidScreenKey } from "@/lib/laundry-rbac-registry"
import { SYSTEM_ROLES } from "@/lib/laundry-rbac-catalog"
import { laundryRoleLabel, hasLaundryWorkspaceAccess, LAUNDRY_WORKSPACE_ENTRY_KEY } from "@/lib/runtime-auth"
import { isOwnerRole, resolveUnassignedPermissions } from "@/lib/laundry-rbac"

// ============================================================================
// Single-authorization-pipeline regression (FIX 1/3/5)
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

describe("hasLaundryWorkspaceAccess — entry gate uses the same permission object", () => {
  it("grants entry to every catalog role (regression: no role is locked out)", () => {
    for (const role of SYSTEM_ROLES) {
      if (role.isOwner) continue
      const dash = role.screens().find((s) => s.screenKey === LAUNDRY_WORKSPACE_ENTRY_KEY)
      expect(dash, `${role.code} must grant ${LAUNDRY_WORKSPACE_ENTRY_KEY}`).toBeDefined()
      expect(dash!.level, `${role.code} must grant ${LAUNDRY_WORKSPACE_ENTRY_KEY} >= VIEW`).toBeGreaterThanOrEqual(Level.VIEW)
      expect(hasLaundryWorkspaceAccess(roleLevels(role.code), false)).toBe(true)
    }
  })

  it("grants entry to owners unconditionally", () => {
    expect(hasLaundryWorkspaceAccess({}, true)).toBe(true)
  })

  it("denies entry when laundry.dashboard is missing or below VIEW", () => {
    expect(hasLaundryWorkspaceAccess({}, false)).toBe(false)
    expect(hasLaundryWorkspaceAccess({ "laundry.dashboard": Level.HIDE }, false)).toBe(false)
    expect(hasLaundryWorkspaceAccess({ "laundry.orders": Level.EDIT, "crm.leads": Level.CREATE }, false)).toBe(false)
  })

  it("denies entry to a legacy STORE_EXECUTIVE with no RBAC assignment (no inherited permissions)", () => {
    // BusinessUser.role = STORE_EXECUTIVE with no LaundryAccessAssignment
    // resolves to an empty level map — the workspace is denied.
    expect(hasLaundryWorkspaceAccess({}, false)).toBe(false)
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
