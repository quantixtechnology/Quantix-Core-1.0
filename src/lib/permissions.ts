// ============================================================================
// Permission utilities for Quantix RBAC
// ============================================================================

export type Permission =
  | "leads:view" | "leads:edit" | "leads:delete"
  | "businesses:view" | "businesses:create" | "businesses:edit" | "businesses:delete" | "businesses:impersonate"
  | "subscriptions:view" | "subscriptions:edit" | "subscriptions:override_price"
  | "sales:view" | "sales:edit"
  | "platform:view_analytics" | "platform:manage_deployments" | "platform:manage_domains" | "platform:audit_logs" | "platform:security"
  | "orders:view" | "orders:edit" | "orders:cancel"
  | "products:view" | "products:create" | "products:edit" | "products:delete"
  | "customers:view" | "customers:edit"
  | "reports:view" | "reports:export"
  | "settings:view" | "settings:edit"
  | "staff:view" | "staff:manage"
  | "pos:access"
  | "notifications:view" | "notifications:send"
  | "users:view" | "users:create" | "users:edit" | "users:delete" | "users:reset_password" | "users:suspend" | "users:impersonate"
  | "inventory:view" | "inventory:edit"
  | "billing:view" | "billing:edit"
  | "refunds:process"

// All roles supported by the platform
export type PlatformRole =
  | "QUANTIX_SUPER_ADMIN"
  | "PLATFORM_ADMIN"
  | "QUANTIX_SALES_TEAM"
  | "SUPPORT_TEAM"
  | "DEPLOYMENT_TEAM"
  | "FINANCE_TEAM"
  | "CLIENT_OWNER"
  | "STORE_MANAGER"
  | "BILLING_STAFF"
  | "INVENTORY_STAFF"
  | "SUPPORT_STAFF"
  | "DELIVERY_STAFF"
  | "CUSTOMER"

// Human-readable labels for all roles
export const ROLE_LABELS: Record<string, string> = {
  QUANTIX_SUPER_ADMIN:  "Super Admin",
  PLATFORM_ADMIN:       "Platform Admin",
  QUANTIX_SALES_TEAM:   "Sales Team",
  SUPPORT_TEAM:         "Support Team",
  DEPLOYMENT_TEAM:      "Deployment Team",
  FINANCE_TEAM:         "Finance Team",
  CLIENT_OWNER:         "Business Owner",
  STORE_MANAGER:        "Store Manager",
  BILLING_STAFF:        "Billing Staff",
  INVENTORY_STAFF:      "Inventory Staff",
  SUPPORT_STAFF:        "Support Staff",
  DELIVERY_STAFF:       "Delivery Staff",
  CUSTOMER:             "Customer",
}

// Which roles are platform-level (Quantix internal team — stored on User.platformRole)
export const PLATFORM_ROLES: PlatformRole[] = [
  "QUANTIX_SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "QUANTIX_SALES_TEAM",
  "SUPPORT_TEAM",
  "DEPLOYMENT_TEAM",
  "FINANCE_TEAM",
]

// Which roles are business-level (client staff — stored on BusinessUser.role)
export const BUSINESS_ROLES: PlatformRole[] = [
  "CLIENT_OWNER",
  "STORE_MANAGER",
  "BILLING_STAFF",
  "INVENTORY_STAFF",
  "SUPPORT_STAFF",
  "DELIVERY_STAFF",
]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  QUANTIX_SUPER_ADMIN: [
    "leads:view", "leads:edit", "leads:delete",
    "businesses:view", "businesses:create", "businesses:edit", "businesses:delete", "businesses:impersonate",
    "subscriptions:view", "subscriptions:edit", "subscriptions:override_price",
    "sales:view", "sales:edit",
    "platform:view_analytics", "platform:manage_deployments", "platform:manage_domains", "platform:audit_logs", "platform:security",
    "notifications:view", "notifications:send",
    "users:view", "users:create", "users:edit", "users:delete", "users:reset_password", "users:suspend", "users:impersonate",
  ],
  PLATFORM_ADMIN: [
    "leads:view", "leads:edit",
    "businesses:view", "businesses:edit",
    "subscriptions:view",
    "platform:view_analytics", "platform:audit_logs",
    "notifications:view",
    "users:view", "users:create", "users:edit", "users:reset_password", "users:suspend",
  ],
  QUANTIX_SALES_TEAM: [
    "leads:view", "leads:edit",
    "businesses:view",
    "sales:view", "sales:edit",
    "notifications:view",
  ],
  SUPPORT_TEAM: [
    "leads:view",
    "businesses:view",
    "orders:view",
    "customers:view", "customers:edit",
    "notifications:view", "notifications:send",
    "platform:audit_logs",
  ],
  DEPLOYMENT_TEAM: [
    "businesses:view",
    "platform:manage_deployments",
    "platform:audit_logs",
    "notifications:view",
  ],
  FINANCE_TEAM: [
    "subscriptions:view", "subscriptions:edit",
    "billing:view", "billing:edit",
    "reports:view", "reports:export",
    "platform:view_analytics",
    "notifications:view",
  ],
  CLIENT_OWNER: [
    "orders:view", "orders:edit", "orders:cancel",
    "products:view", "products:create", "products:edit", "products:delete",
    "customers:view", "customers:edit",
    "reports:view", "reports:export",
    "settings:view", "settings:edit",
    "staff:view", "staff:manage",
    "pos:access",
    "notifications:view",
    "inventory:view", "inventory:edit",
    "billing:view",
    "users:view", "users:create", "users:edit", "users:reset_password", "users:suspend",
  ],
  STORE_MANAGER: [
    "orders:view", "orders:edit",
    "products:view", "products:edit",
    "customers:view",
    "reports:view",
    "settings:view",
    "pos:access",
    "notifications:view",
    "inventory:view",
  ],
  BILLING_STAFF: [
    "orders:view",
    "billing:view", "billing:edit",
    "refunds:process",
    "reports:view",
    "customers:view",
    "pos:access",
  ],
  INVENTORY_STAFF: [
    "products:view", "products:edit",
    "inventory:view", "inventory:edit",
    "reports:view",
  ],
  SUPPORT_STAFF: [
    "orders:view",
    "customers:view", "customers:edit",
    "notifications:view",
  ],
  DELIVERY_STAFF: [],
  CUSTOMER: [],
}

// Granular permission groups for UI display
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Products",
    permissions: ["products:view", "products:create", "products:edit", "products:delete"],
  },
  {
    label: "Orders",
    permissions: ["orders:view", "orders:edit", "orders:cancel", "refunds:process"],
  },
  {
    label: "Customers",
    permissions: ["customers:view", "customers:edit"],
  },
  {
    label: "Inventory",
    permissions: ["inventory:view", "inventory:edit"],
  },
  {
    label: "Billing",
    permissions: ["billing:view", "billing:edit"],
  },
  {
    label: "POS",
    permissions: ["pos:access"],
  },
  {
    label: "Staff",
    permissions: ["staff:view", "staff:manage"],
  },
  {
    label: "Users",
    permissions: ["users:view", "users:create", "users:edit", "users:delete", "users:reset_password", "users:suspend", "users:impersonate"],
  },
  {
    label: "Reports",
    permissions: ["reports:view", "reports:export"],
  },
  {
    label: "Settings",
    permissions: ["settings:view", "settings:edit"],
  },
  {
    label: "Notifications",
    permissions: ["notifications:view", "notifications:send"],
  },
  {
    label: "Platform",
    permissions: [
      "platform:view_analytics", "platform:manage_deployments",
      "platform:manage_domains", "platform:audit_logs", "platform:security",
    ],
  },
]

// Human-readable labels for individual permissions
export const PERMISSION_LABELS: Record<Permission, string> = {
  "leads:view":                   "View Leads",
  "leads:edit":                   "Edit Leads",
  "leads:delete":                 "Delete Leads",
  "businesses:view":              "View Businesses",
  "businesses:create":            "Create Businesses",
  "businesses:edit":              "Edit Businesses",
  "businesses:delete":            "Delete Businesses",
  "businesses:impersonate":       "Impersonate Business",
  "subscriptions:view":           "View Subscriptions",
  "subscriptions:edit":           "Edit Subscriptions",
  "subscriptions:override_price": "Override Subscription Price",
  "sales:view":                   "View Sales",
  "sales:edit":                   "Edit Sales",
  "platform:view_analytics":      "View Platform Analytics",
  "platform:manage_deployments":  "Manage Deployments",
  "platform:manage_domains":      "Manage Domains",
  "platform:audit_logs":          "View Audit Logs",
  "platform:security":            "Security & Access",
  "orders:view":                  "View Orders",
  "orders:edit":                  "Edit Orders",
  "orders:cancel":                "Cancel Orders",
  "products:view":                "View Products",
  "products:create":              "Create Products",
  "products:edit":                "Edit Products",
  "products:delete":              "Delete Products",
  "customers:view":               "View Customers",
  "customers:edit":               "Edit Customers",
  "reports:view":                 "View Reports",
  "reports:export":               "Export Reports",
  "settings:view":                "View Settings",
  "settings:edit":                "Edit Settings",
  "staff:view":                   "View Staff",
  "staff:manage":                 "Manage Staff",
  "pos:access":                   "Access POS",
  "notifications:view":           "View Notifications",
  "notifications:send":           "Send Notifications",
  "users:view":                   "View Users",
  "users:create":                 "Create Users",
  "users:edit":                   "Edit Users",
  "users:delete":                 "Delete Users",
  "users:reset_password":         "Reset Passwords",
  "users:suspend":                "Suspend Users",
  "users:impersonate":            "Impersonate Users",
  "inventory:view":               "View Inventory",
  "inventory:edit":               "Edit Inventory",
  "billing:view":                 "View Billing",
  "billing:edit":                 "Edit Billing",
  "refunds:process":              "Process Refunds",
}

export function hasPermission(userPermissions: string[], required: Permission): boolean {
  return userPermissions.includes(required)
}

export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean {
  return required.some((p) => userPermissions.includes(p))
}

export function getDefaultPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function getPermissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function isPlatformRole(role: string): boolean {
  return PLATFORM_ROLES.includes(role as PlatformRole)
}

export function isBusinessRole(role: string): boolean {
  return BUSINESS_ROLES.includes(role as PlatformRole)
}

export type NavItem = {
  key: string
  label: string
  requiredPermission?: Permission
}

export function filterNavByPermissions<T extends NavItem>(
  items: T[],
  userPermissions: string[]
): T[] {
  return items.filter((item) => {
    if (!item.requiredPermission) return true
    return hasPermission(userPermissions, item.requiredPermission)
  })
}

export const ADMIN_NAV_PERMISSIONS: Record<string, Permission> = {
  leads:                "leads:view",
  businesses:           "businesses:view",
  subscriptions:        "subscriptions:view",
  sales:                "sales:view",
  "platform-users":     "users:view",
  "platform-analytics": "platform:view_analytics",
  "audit-logs":         "platform:audit_logs",
  "security-access":    "platform:security",
  "deployment-pipeline":"platform:manage_deployments",
  "build-automation":   "platform:manage_deployments",
  "release-management": "platform:manage_deployments",
  domains:              "platform:manage_domains",
  notifications:        "notifications:view",
}
