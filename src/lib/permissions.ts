// ============================================================================
// Permission utilities for Quantix RBAC
// ============================================================================

export type Permission =
  // ── Navigation access (VIEW = sidebar visibility + route access) ──────────
  | "dashboard:view"
  | "workflow:view"
  | "plan_management:view"
  | "payment_plugins:view"
  | "roles_permissions:view"
  | "backup:view"
  | "revenue:view"
  | "support:view"
  // ── Leads / CRM ───────────────────────────────────────────────────────────
  | "leads:view" | "leads:create" | "leads:edit" | "leads:delete" | "leads:export"
  // ── Businesses ────────────────────────────────────────────────────────────
  | "businesses:view" | "businesses:create" | "businesses:edit" | "businesses:delete" | "businesses:impersonate"
  // ── Subscriptions & Billing ───────────────────────────────────────────────
  | "subscriptions:view" | "subscriptions:create" | "subscriptions:edit" | "subscriptions:delete" | "subscriptions:override_price" | "subscriptions:export"
  | "stores:view" | "stores:create" | "stores:edit" | "stores:delete"
  // ── Sales ─────────────────────────────────────────────────────────────────
  | "sales:view" | "sales:create" | "sales:edit" | "sales:delete" | "sales:export"
  | "sales_team:view" | "sales_team:create" | "sales_team:edit" | "sales_team:delete"
  // ── Platform ──────────────────────────────────────────────────────────────
  | "platform:view_analytics" | "platform:manage_deployments" | "platform:manage_domains" | "platform:audit_logs" | "platform:security"
  // ── Business modules ──────────────────────────────────────────────────────
  | "orders:view" | "orders:edit" | "orders:cancel"
  | "products:view" | "products:create" | "products:edit" | "products:delete" | "products:export"
  | "customers:view" | "customers:create" | "customers:edit" | "customers:delete"
  | "reports:view" | "reports:export"
  | "settings:view" | "settings:edit"
  | "staff:view" | "staff:manage"
  | "pos:access"
  | "notifications:view" | "notifications:create" | "notifications:send" | "notifications:delete"
  | "users:view" | "users:create" | "users:edit" | "users:delete" | "users:reset_password" | "users:suspend" | "users:impersonate"
  | "inventory:view" | "inventory:edit"
  | "billing:view" | "billing:create" | "billing:edit" | "billing:delete"
  | "refunds:process"
  | "domains:view" | "domains:create" | "domains:edit" | "domains:delete"
  | "import:leads"
  | "import:business"
  | "export:leads"

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
    // Navigation access — Super Admin sees all modules
    "dashboard:view", "workflow:view", "plan_management:view", "payment_plugins:view",
    "roles_permissions:view", "backup:view", "revenue:view", "support:view",
    // Leads / CRM
    "leads:view", "leads:create", "leads:edit", "leads:delete", "leads:export",
    // Businesses
    "businesses:view", "businesses:create", "businesses:edit", "businesses:delete", "businesses:impersonate",
    // Subscriptions
    "subscriptions:view", "subscriptions:create", "subscriptions:edit", "subscriptions:delete", "subscriptions:override_price", "subscriptions:export",
    "stores:view", "stores:create", "stores:edit", "stores:delete",
    // Sales
    "sales:view", "sales:create", "sales:edit", "sales:delete", "sales:export",
    "sales_team:view", "sales_team:create", "sales_team:edit", "sales_team:delete",
    // Platform
    "platform:view_analytics", "platform:manage_deployments", "platform:manage_domains", "platform:audit_logs", "platform:security",
    // Notifications & Users
    "notifications:view", "notifications:create", "notifications:send", "notifications:delete",
    "users:view", "users:create", "users:edit", "users:delete", "users:reset_password", "users:suspend", "users:impersonate",
    // Billing & Finance
    "billing:view", "billing:create", "billing:edit", "billing:delete",
    "domains:view", "domains:create", "domains:edit", "domains:delete",
    // Business modules
    "products:view", "products:create", "products:edit", "products:delete", "products:export",
    "customers:view", "customers:create", "customers:edit", "customers:delete",
    "reports:view", "reports:export",
    "inventory:view", "inventory:edit",
    "settings:view", "settings:edit",
    "staff:view", "staff:manage",
    "pos:access", "refunds:process",
    "import:leads", "import:business", "export:leads",
  ],
  PLATFORM_ADMIN: [
    // Navigation — near-full admin, no destructive system access
    "dashboard:view", "workflow:view", "payment_plugins:view", "revenue:view", "support:view",
    // Leads
    "leads:view", "leads:create", "leads:edit", "leads:export",
    // Businesses
    "businesses:view", "businesses:create", "businesses:edit",
    // Subscriptions
    "subscriptions:view", "subscriptions:create", "subscriptions:edit", "subscriptions:override_price", "subscriptions:export",
    "stores:view", "stores:create", "stores:edit",
    // Sales
    "sales:view", "sales:edit", "sales:export",
    "sales_team:view", "sales_team:create", "sales_team:edit",
    // Platform
    "platform:view_analytics", "platform:audit_logs", "platform:manage_domains",
    // Notifications & Users
    "notifications:view", "notifications:create", "notifications:send",
    "users:view", "users:create", "users:edit", "users:reset_password", "users:suspend",
    // Billing & Domains
    "billing:view", "billing:create", "billing:edit",
    "domains:view", "domains:create", "domains:edit",
    "settings:view", "settings:edit",
    "import:leads", "import:business", "export:leads",
  ],
  QUANTIX_SALES_TEAM: [
    // Navigation — Sales Team sees only Sales & Leads
    "leads:view", "leads:create", "leads:edit", "leads:export",
    "businesses:view",
    "sales:view", "sales:create", "sales:edit", "sales:export",
    "sales_team:view",
    "notifications:view",
    "import:leads", "export:leads",
  ],
  SUPPORT_TEAM: [
    // Navigation — Support Team sees only Support & Tickets
    "support:view",
    "leads:view",
    "businesses:view",
    "orders:view",
    "customers:view", "customers:edit",
    "notifications:view", "notifications:send",
    "platform:audit_logs",
  ],
  DEPLOYMENT_TEAM: [
    // Navigation — Deployment Team sees deployment ops + backup
    "dashboard:view", "workflow:view", "backup:view",
    "platform:manage_deployments",
    "platform:audit_logs",
    "domains:view",
    "notifications:view",
  ],
  FINANCE_TEAM: [
    // Navigation — Finance Team sees subscriptions + revenue + billing
    "dashboard:view", "revenue:view", "payment_plugins:view",
    "subscriptions:view", "subscriptions:edit", "subscriptions:export",
    "billing:view", "billing:create", "billing:edit",
    "reports:view", "reports:export",
    "platform:view_analytics",
    "notifications:view",
    "refunds:process",
  ],
  CLIENT_OWNER: [
    "orders:view", "orders:edit", "orders:cancel",
    "products:view", "products:create", "products:edit", "products:delete", "products:export",
    "customers:view", "customers:create", "customers:edit",
    "reports:view", "reports:export",
    "settings:view", "settings:edit",
    "staff:view", "staff:manage",
    "pos:access",
    "notifications:view",
    "inventory:view", "inventory:edit",
    "billing:view", "billing:create", "billing:edit",
    "users:view", "users:create", "users:edit", "users:reset_password", "users:suspend",
    "import:business",
    "refunds:process",
  ],
  STORE_MANAGER: [
    "orders:view", "orders:edit",
    "products:view", "products:create", "products:edit", "products:export",
    "customers:view",
    "reports:view",
    "settings:view",
    "pos:access",
    "notifications:view",
    "inventory:view", "inventory:edit",
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
    "products:view", "products:edit", "products:export",
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
    label: "Leads",
    permissions: ["leads:view", "leads:create", "leads:edit", "leads:delete", "leads:export"],
  },
  {
    label: "Businesses",
    permissions: ["businesses:view", "businesses:create", "businesses:edit", "businesses:delete", "businesses:impersonate"],
  },
  {
    label: "Subscriptions",
    permissions: ["subscriptions:view", "subscriptions:create", "subscriptions:edit", "subscriptions:delete", "subscriptions:override_price", "subscriptions:export"],
  },
  {
    label: "Stores",
    permissions: ["stores:view", "stores:create", "stores:edit", "stores:delete"],
  },
  {
    label: "Sales",
    permissions: ["sales:view", "sales:create", "sales:edit", "sales:delete", "sales:export"],
  },
  {
    label: "Sales Team",
    permissions: ["sales_team:view", "sales_team:create", "sales_team:edit", "sales_team:delete"],
  },
  {
    label: "Products",
    permissions: ["products:view", "products:create", "products:edit", "products:delete", "products:export"],
  },
  {
    label: "Orders",
    permissions: ["orders:view", "orders:edit", "orders:cancel", "refunds:process"],
  },
  {
    label: "Customers",
    permissions: ["customers:view", "customers:create", "customers:edit", "customers:delete"],
  },
  {
    label: "Inventory",
    permissions: ["inventory:view", "inventory:edit"],
  },
  {
    label: "Billing",
    permissions: ["billing:view", "billing:create", "billing:edit", "billing:delete"],
  },
  {
    label: "Domains",
    permissions: ["domains:view", "domains:create", "domains:edit", "domains:delete"],
  },
  {
    label: "Notifications",
    permissions: ["notifications:view", "notifications:create", "notifications:send", "notifications:delete"],
  },
  {
    label: "Users",
    permissions: ["users:view", "users:create", "users:edit", "users:delete", "users:reset_password", "users:suspend", "users:impersonate"],
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
    label: "Reports",
    permissions: ["reports:view", "reports:export"],
  },
  {
    label: "Settings",
    permissions: ["settings:view", "settings:edit"],
  },
  {
    label: "Platform",
    permissions: [
      "platform:view_analytics", "platform:manage_deployments",
      "platform:manage_domains", "platform:audit_logs", "platform:security",
    ],
  },
  {
    label: "Data Import / Export",
    permissions: ["import:leads", "import:business", "export:leads"],
  },
]

// Human-readable labels for individual permissions
export const PERMISSION_LABELS: Record<Permission, string> = {
  // Navigation access
  "dashboard:view":               "View Dashboard",
  "workflow:view":                "View Workflow Engine",
  "plan_management:view":         "View Plan Management",
  "payment_plugins:view":         "View Payment Plugins",
  "roles_permissions:view":       "View Roles & Permissions",
  "backup:view":                  "View Backup & Monitoring",
  "revenue:view":                 "View Revenue & Payouts",
  "support:view":                 "View Support & Tickets",
  // Leads
  "leads:view":                   "View Leads",
  "leads:create":                 "Create Leads",
  "leads:edit":                   "Edit Leads",
  "leads:delete":                 "Delete Leads",
  "leads:export":                 "Export Leads",
  "businesses:view":              "View Businesses",
  "businesses:create":            "Create Businesses",
  "businesses:edit":              "Edit Businesses",
  "businesses:delete":            "Delete Businesses",
  "businesses:impersonate":       "Impersonate Business",
  "subscriptions:view":           "View Subscriptions",
  "subscriptions:create":         "Create Subscriptions",
  "subscriptions:edit":           "Edit Subscriptions",
  "subscriptions:delete":         "Delete Subscriptions",
  "subscriptions:override_price": "Override Subscription Price",
  "subscriptions:export":         "Export Subscriptions",
  "stores:view":                  "View Stores",
  "stores:create":                "Create Stores",
  "stores:edit":                  "Edit Stores",
  "stores:delete":                "Delete Stores",
  "sales:view":                   "View Sales",
  "sales:create":                 "Create Sales",
  "sales:edit":                   "Edit Sales",
  "sales:delete":                 "Delete Sales Records",
  "sales:export":                 "Export Sales",
  "sales_team:view":              "View Sales Team",
  "sales_team:create":            "Add Sales Team Members",
  "sales_team:edit":              "Edit Sales Team Members",
  "sales_team:delete":            "Delete Sales Team Members",
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
  "products:export":              "Export Products",
  "customers:view":               "View Customers",
  "customers:create":             "Create Customers",
  "customers:edit":               "Edit Customers",
  "customers:delete":             "Delete Customers",
  "reports:view":                 "View Reports",
  "reports:export":               "Export Reports",
  "settings:view":                "View Settings",
  "settings:edit":                "Edit Settings",
  "staff:view":                   "View Staff",
  "staff:manage":                 "Manage Staff",
  "pos:access":                   "Access POS",
  "notifications:view":           "View Notifications",
  "notifications:create":         "Create Notifications",
  "notifications:send":           "Send Notifications",
  "notifications:delete":         "Delete Notifications",
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
  "billing:create":               "Create Billing Records",
  "billing:edit":                 "Edit Billing Records",
  "billing:delete":               "Delete Billing Records",
  "domains:view":                 "View Domains",
  "domains:create":               "Add Domains",
  "domains:edit":                 "Edit Domains",
  "domains:delete":               "Delete Domains",
  "refunds:process":              "Process Refunds",
  "import:leads":                 "Import Leads & Sales Data",
  "import:business":              "Import Business Data",
  "export:leads":                 "Export Lead Data (CRM)",
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

// Every sidebar nav key → the VIEW permission that gates it.
// Sidebar and PAGE_PERMISSIONS both derive from this single source of truth.
export const ADMIN_NAV_PERMISSIONS: Record<string, Permission> = {
  // Platform Control
  "dashboard":              "dashboard:view",
  "workflow-engine":        "workflow:view",
  "businesses":             "businesses:view",
  "leads":                  "leads:view",
  "subscriptions":          "subscriptions:view",
  "plan-management":        "plan_management:view",
  "payment-plugins":        "payment_plugins:view",
  "domains":                "platform:manage_domains",
  "sales":                  "sales_team:view",
  "platform-users":         "users:view",
  // Mobile & Apps
  "mobile-apps":            "platform:manage_deployments",
  // Deployment & Ops
  "ops-dashboard":          "platform:manage_deployments",
  "deployment-pipeline":    "platform:manage_deployments",
  "build-automation":       "platform:manage_deployments",
  "release-management":     "platform:manage_deployments",
  "play-store":             "platform:manage_deployments",
  "mobile-versions":        "platform:manage_deployments",
  // Client Operations
  "client-assets":          "businesses:edit",
  "tenant-provisioning":    "businesses:create",
  "product-import":         "businesses:edit",
  "onboarding-checklist":   "businesses:edit",
  // Data Imports
  "leads-import":           "import:leads",
  "business-data-import":   "import:business",
  // Platform Ops
  "platform-analytics":     "platform:view_analytics",
  "revenue":                "revenue:view",
  "support":                "support:view",
  "notifications":          "notifications:view",
  // System
  "roles-permissions":      "roles_permissions:view",
  "backup-monitoring":      "backup:view",
  "security-access":        "platform:security",
  "audit-logs":             "platform:audit_logs",
  "settings":               "settings:view",
}
