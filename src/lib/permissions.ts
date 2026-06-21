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
  | "proposals:view"
  | "proposals:create"
  | "proposals:delete"
  | "proposals:export"
  | "payment_config:view"
  | "payment_config:edit"
  // ── Commission Calculator ─────────────────────────────────────────────────
  | "commission:view"
  | "commission:edit"
  // ── HRMS ─────────────────────────────────────────────────────────────────
  | "hrms:view"
  | "hrms:manage"
  // ── HRMS — granular ──────────────────────────────────────────────────────
  | "hrms.employees:view" | "hrms.employees:create" | "hrms.employees:edit" | "hrms.employees:delete" | "hrms.employees:export"
  | "hrms.offer_letters:view" | "hrms.offer_letters:create" | "hrms.offer_letters:edit" | "hrms.offer_letters:delete" | "hrms.offer_letters:print" | "hrms.offer_letters:approve"
  | "hrms.commission_slips:view" | "hrms.commission_slips:create" | "hrms.commission_slips:approve" | "hrms.commission_slips:export" | "hrms.commission_slips:print"
  | "hrms.payslips:view" | "hrms.payslips:create" | "hrms.payslips:approve" | "hrms.payslips:export" | "hrms.payslips:print"
  | "hrms.templates:view" | "hrms.templates:create" | "hrms.templates:edit" | "hrms.templates:delete"
  | "hrms.settings:view" | "hrms.settings:edit" | "hrms.settings:configure"
  // ── Revenue Operations ───────────────────────────────────────────────────
  | "revenue_ops:view"
  | "revenue_ops:manage"
  // ── Revenue Operations — granular ────────────────────────────────────────
  | "revenue_ops.signup_ownership:view" | "revenue_ops.signup_ownership:edit" | "revenue_ops.signup_ownership:assign"
  | "revenue_ops.renewal_ownership:view" | "revenue_ops.renewal_ownership:edit" | "revenue_ops.renewal_ownership:assign"
  | "revenue_ops.addon_ownership:view" | "revenue_ops.addon_ownership:edit" | "revenue_ops.addon_ownership:assign"
  | "revenue_ops.commission_processing:view" | "revenue_ops.commission_processing:approve" | "revenue_ops.commission_processing:export" | "revenue_ops.commission_processing:process" | "revenue_ops.commission_processing:release"
  // ── Laundry OS ──────────────────────────────────────────────────────────
  | "laundry_os:view"
  | "laundry_os:configure"
  // ── Brand Studio ─────────────────────────────────────────────────────────
  | "brand_studio:view" | "brand_studio:edit" | "brand_studio:configure"
  // ── Roles & Permissions ───────────────────────────────────────────────────
  | "roles_permissions:edit" | "roles_permissions:configure"
  // ── Website Management ────────────────────────────────────────────────────
  | "website:view" | "website:create" | "website:edit" | "website:delete" | "website:configure"

// All roles supported by the platform
export type PlatformRole =
  | "QUANTIX_SUPER_ADMIN"
  | "PLATFORM_ADMIN"
  | "SALES_MANAGER"
  | "BD_EXECUTIVE"
  | "HR_ADMIN"
  | "FINANCE_MANAGER"
  | "OPERATIONS_MANAGER"
  | "SUPPORT_MANAGER"
  | "READ_ONLY_AUDITOR"
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
  // ── Laundry OS Roles ───────────────────────────────────────────────
  | "LAUNDRY_OWNER"
  | "LAUNDRY_STORE_MANAGER"
  | "LAUNDRY_STORE_EXECUTIVE"
  | "LAUNDRY_AUDIT_EXECUTIVE"
  | "LAUNDRY_PROCESSING_MANAGER"
  | "LAUNDRY_PROCESSING_STAFF"
  | "LAUNDRY_DELIVERY_EXECUTIVE"
  | "CUSTOMER"

// Human-readable labels for all roles
export const ROLE_LABELS: Record<string, string> = {
  QUANTIX_SUPER_ADMIN:  "Quantix Super Admin",
  PLATFORM_ADMIN:       "Platform Administrator",
  SALES_MANAGER:        "Sales Manager",
  BD_EXECUTIVE:         "Business Development Executive",
  HR_ADMIN:             "HR Administrator",
  FINANCE_MANAGER:      "Finance Manager",
  OPERATIONS_MANAGER:   "Operations Manager",
  SUPPORT_MANAGER:      "Support Manager",
  READ_ONLY_AUDITOR:    "Read Only Auditor",
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
  // Laundry OS roles
  LAUNDRY_OWNER:              "Laundry Owner",
  LAUNDRY_STORE_MANAGER:      "Laundry Store Manager",
  LAUNDRY_STORE_EXECUTIVE:    "Laundry Store Executive",
  LAUNDRY_AUDIT_EXECUTIVE:    "Laundry Audit Executive",
  LAUNDRY_PROCESSING_MANAGER: "Laundry Processing Manager",
  LAUNDRY_PROCESSING_STAFF:   "Laundry Processing Staff",
  LAUNDRY_DELIVERY_EXECUTIVE: "Laundry Delivery Executive",
  CUSTOMER:             "Customer",
}

// Which roles are platform-level (Quantix internal team — stored on User.platformRole)
export const PLATFORM_ROLES: PlatformRole[] = [
  "QUANTIX_SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "SALES_MANAGER",
  "BD_EXECUTIVE",
  "HR_ADMIN",
  "FINANCE_MANAGER",
  "OPERATIONS_MANAGER",
  "SUPPORT_MANAGER",
  "READ_ONLY_AUDITOR",
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

// Which roles are Laundry OS-specific (standalone product — stored on BusinessUser.role)
export const LAUNDRY_ROLES: PlatformRole[] = [
  "LAUNDRY_OWNER",
  "LAUNDRY_STORE_MANAGER",
  "LAUNDRY_STORE_EXECUTIVE",
  "LAUNDRY_AUDIT_EXECUTIVE",
  "LAUNDRY_PROCESSING_MANAGER",
  "LAUNDRY_PROCESSING_STAFF",
  "LAUNDRY_DELIVERY_EXECUTIVE",
]

export function isLaundryRole(role: string): boolean {
  return LAUNDRY_ROLES.includes(role as PlatformRole)
}

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
    "proposals:view", "proposals:create", "proposals:delete", "proposals:export",
    "payment_config:view", "payment_config:edit",
    "commission:view", "commission:edit",
    "hrms:view", "hrms:manage",
    "hrms.employees:view", "hrms.employees:create", "hrms.employees:edit", "hrms.employees:delete", "hrms.employees:export",
    "hrms.offer_letters:view", "hrms.offer_letters:create", "hrms.offer_letters:edit", "hrms.offer_letters:delete", "hrms.offer_letters:print", "hrms.offer_letters:approve",
    "hrms.commission_slips:view", "hrms.commission_slips:create", "hrms.commission_slips:approve", "hrms.commission_slips:export", "hrms.commission_slips:print",
    "hrms.payslips:view", "hrms.payslips:create", "hrms.payslips:approve", "hrms.payslips:export", "hrms.payslips:print",
    "hrms.templates:view", "hrms.templates:create", "hrms.templates:edit", "hrms.templates:delete",
    "hrms.settings:view", "hrms.settings:edit", "hrms.settings:configure",
    "revenue_ops:view", "revenue_ops:manage",
    "revenue_ops.signup_ownership:view", "revenue_ops.signup_ownership:edit", "revenue_ops.signup_ownership:assign",
    "revenue_ops.renewal_ownership:view", "revenue_ops.renewal_ownership:edit", "revenue_ops.renewal_ownership:assign",
    "revenue_ops.addon_ownership:view", "revenue_ops.addon_ownership:edit", "revenue_ops.addon_ownership:assign",
    "revenue_ops.commission_processing:view", "revenue_ops.commission_processing:approve", "revenue_ops.commission_processing:export", "revenue_ops.commission_processing:process", "revenue_ops.commission_processing:release",
    "laundry_os:view", "laundry_os:configure",
    "brand_studio:view", "brand_studio:edit", "brand_studio:configure",
    "roles_permissions:edit", "roles_permissions:configure",
    "website:view", "website:create", "website:edit", "website:delete", "website:configure",
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
    "proposals:view", "proposals:create", "proposals:export",
    "commission:view", "commission:edit",
    "website:view", "website:create", "website:edit", "website:configure",
  ],
  QUANTIX_SALES_TEAM: [
    // Navigation — Sales Team sees only Sales & Leads + Commission Calculator
    "leads:view", "leads:create", "leads:edit", "leads:export",
    "businesses:view",
    "sales:view", "sales:create", "sales:edit", "sales:export",
    "sales_team:view",
    "notifications:view",
    "import:leads", "export:leads",
    "proposals:view", "proposals:create", "proposals:export",
    "commission:view", "commission:edit",
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
  SALES_MANAGER: [
    "dashboard:view", "workflow:view",
    "leads:view", "leads:create", "leads:edit", "leads:delete", "leads:export",
    "businesses:view", "businesses:create", "businesses:edit",
    "sales:view", "sales:create", "sales:edit", "sales:delete", "sales:export",
    "sales_team:view", "sales_team:create", "sales_team:edit", "sales_team:delete",
    "subscriptions:view",
    "platform:view_analytics",
    "notifications:view", "notifications:send",
    "import:leads", "export:leads",
    "proposals:view", "proposals:create", "proposals:delete", "proposals:export",
    "payment_config:view",
    "commission:view", "commission:edit",
    "revenue_ops:view",
    "revenue_ops.signup_ownership:view", "revenue_ops.signup_ownership:assign",
    "revenue_ops.renewal_ownership:view", "revenue_ops.renewal_ownership:assign",
  ],
  BD_EXECUTIVE: [
    "leads:view", "leads:create", "leads:edit", "leads:export",
    "businesses:view",
    "sales:view", "sales:create", "sales:edit", "sales:export",
    "sales_team:view",
    "notifications:view",
    "import:leads", "export:leads",
    "proposals:view", "proposals:create", "proposals:export",
    "commission:view",
  ],
  HR_ADMIN: [
    "dashboard:view",
    "hrms:view", "hrms:manage",
    "hrms.employees:view", "hrms.employees:create", "hrms.employees:edit", "hrms.employees:delete", "hrms.employees:export",
    "hrms.offer_letters:view", "hrms.offer_letters:create", "hrms.offer_letters:edit", "hrms.offer_letters:delete", "hrms.offer_letters:print", "hrms.offer_letters:approve",
    "hrms.commission_slips:view", "hrms.commission_slips:create", "hrms.commission_slips:approve", "hrms.commission_slips:export", "hrms.commission_slips:print",
    "hrms.payslips:view", "hrms.payslips:create", "hrms.payslips:approve", "hrms.payslips:export", "hrms.payslips:print",
    "hrms.templates:view", "hrms.templates:create", "hrms.templates:edit", "hrms.templates:delete",
    "hrms.settings:view", "hrms.settings:edit", "hrms.settings:configure",
    "revenue_ops:view",
    "revenue_ops.signup_ownership:view",
    "revenue_ops.renewal_ownership:view",
    "revenue_ops.commission_processing:view", "revenue_ops.commission_processing:export",
    "users:view",
    "notifications:view", "notifications:send",
  ],
  FINANCE_MANAGER: [
    "dashboard:view", "revenue:view", "payment_plugins:view",
    "subscriptions:view", "subscriptions:create", "subscriptions:edit", "subscriptions:delete", "subscriptions:override_price", "subscriptions:export",
    "billing:view", "billing:create", "billing:edit", "billing:delete",
    "reports:view", "reports:export",
    "platform:view_analytics",
    "notifications:view",
    "refunds:process",
    "payment_config:view", "payment_config:edit",
    "revenue_ops:view", "revenue_ops:manage",
    "revenue_ops.signup_ownership:view", "revenue_ops.signup_ownership:edit", "revenue_ops.signup_ownership:assign",
    "revenue_ops.renewal_ownership:view", "revenue_ops.renewal_ownership:edit", "revenue_ops.renewal_ownership:assign",
    "revenue_ops.addon_ownership:view", "revenue_ops.addon_ownership:edit", "revenue_ops.addon_ownership:assign",
    "revenue_ops.commission_processing:view", "revenue_ops.commission_processing:approve", "revenue_ops.commission_processing:export", "revenue_ops.commission_processing:process", "revenue_ops.commission_processing:release",
    "commission:view", "commission:edit",
    "platform:audit_logs",
  ],
  OPERATIONS_MANAGER: [
    "dashboard:view", "workflow:view", "backup:view",
    "businesses:view", "businesses:create", "businesses:edit",
    "subscriptions:view",
    "platform:manage_deployments", "platform:view_analytics", "platform:audit_logs",
    "domains:view", "domains:create", "domains:edit",
    "notifications:view", "notifications:create", "notifications:send",
    "users:view",
    "import:business",
  ],
  SUPPORT_MANAGER: [
    "dashboard:view", "support:view",
    "leads:view",
    "businesses:view",
    "customers:view", "customers:edit",
    "orders:view",
    "notifications:view", "notifications:create", "notifications:send", "notifications:delete",
    "platform:audit_logs",
    "users:view",
  ],
  READ_ONLY_AUDITOR: [
    "dashboard:view",
    "leads:view", "leads:export",
    "businesses:view",
    "subscriptions:view", "subscriptions:export",
    "sales:view", "sales:export",
    "sales_team:view",
    "platform:view_analytics", "platform:audit_logs",
    "notifications:view",
    "users:view",
    "billing:view",
    "proposals:view", "proposals:export",
    "commission:view",
    "hrms:view",
    "hrms.employees:view", "hrms.employees:export",
    "hrms.offer_letters:view",
    "hrms.commission_slips:view", "hrms.commission_slips:export",
    "hrms.payslips:view", "hrms.payslips:export",
    "hrms.templates:view",
    "revenue_ops:view",
    "revenue_ops.signup_ownership:view",
    "revenue_ops.renewal_ownership:view",
    "revenue_ops.addon_ownership:view",
    "revenue_ops.commission_processing:view", "revenue_ops.commission_processing:export",
    "revenue:view",
    "support:view",
    "backup:view",
    "brand_studio:view",
    "roles_permissions:view",
    "settings:view",
  ],
  LAUNDRY_OWNER: [
    "laundry_os:view", "laundry_os:configure",
    "dashboard:view",
    "orders:view", "orders:edit", "orders:cancel",
    "customers:view", "customers:create", "customers:edit", "customers:delete",
    "reports:view", "reports:export",
    "settings:view", "settings:edit",
    "staff:view", "staff:manage",
    "notifications:view",
    "billing:view", "billing:create", "billing:edit",
    "users:view", "users:create", "users:edit", "users:reset_password", "users:suspend",
    "refunds:process",
  ],
  LAUNDRY_STORE_MANAGER: [
    "laundry_os:view",
    "dashboard:view",
    "orders:view", "orders:edit",
    "customers:view", "customers:create", "customers:edit",
    "reports:view",
    "settings:view",
    "staff:view",
    "notifications:view",
  ],
  LAUNDRY_STORE_EXECUTIVE: [
    "laundry_os:view",
    "dashboard:view",
    "orders:view", "orders:edit",
    "customers:view", "customers:create",
    "notifications:view",
  ],
  LAUNDRY_AUDIT_EXECUTIVE: [
    "laundry_os:view",
    "dashboard:view",
    "orders:view",
    "customers:view",
    "reports:view", "reports:export",
    "notifications:view",
  ],
  LAUNDRY_PROCESSING_MANAGER: [
    "laundry_os:view",
    "dashboard:view",
    "orders:view", "orders:edit",
    "notifications:view",
    "reports:view",
  ],
  LAUNDRY_PROCESSING_STAFF: [
    "laundry_os:view",
    "orders:view",
    "notifications:view",
  ],
  LAUNDRY_DELIVERY_EXECUTIVE: [
    "laundry_os:view",
    "orders:view",
    "notifications:view",
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
  "proposals:view":               "View Quote & Proposals",
  "proposals:create":             "Create & Download Proposals",
  "proposals:delete":             "Delete Proposal Documents",
  "proposals:export":             "Export Proposal Documents (PDF)",
  "payment_config:view":          "View Payment Configuration",
  "payment_config:edit":          "Edit Payment Configuration",
  "commission:view":              "View Commission Calculator",
  "commission:edit":              "Save & Manage Commission Calculations",
  "hrms:view":                    "View HRMS Module",
  "hrms:manage":                  "Manage HRMS Settings & Approvals",
  // HRMS — granular
  "hrms.employees:view":                   "View Employee Master",
  "hrms.employees:create":                 "Create Employee Records",
  "hrms.employees:edit":                   "Edit Employee Records",
  "hrms.employees:delete":                 "Delete Employee Records",
  "hrms.employees:export":                 "Export Employee Data",
  "hrms.offer_letters:view":               "View Offer Letters",
  "hrms.offer_letters:create":             "Create Offer Letters",
  "hrms.offer_letters:edit":               "Edit Offer Letters",
  "hrms.offer_letters:delete":             "Delete Offer Letters",
  "hrms.offer_letters:print":              "Print / PDF Offer Letters",
  "hrms.offer_letters:approve":            "Approve Offer Letters",
  "hrms.commission_slips:view":            "View Commission Slips",
  "hrms.commission_slips:create":          "Create Commission Slips",
  "hrms.commission_slips:approve":         "Approve Commission Slips",
  "hrms.commission_slips:export":          "Export Commission Slips",
  "hrms.commission_slips:print":           "Print Commission Slips",
  "hrms.payslips:view":                    "View Payslips",
  "hrms.payslips:create":                  "Create Payslips",
  "hrms.payslips:approve":                 "Approve Payslips",
  "hrms.payslips:export":                  "Export Payslips",
  "hrms.payslips:print":                   "Print Payslips",
  "hrms.templates:view":                   "View Document Templates",
  "hrms.templates:create":                 "Create Document Templates",
  "hrms.templates:edit":                   "Edit Document Templates",
  "hrms.templates:delete":                 "Delete Document Templates",
  "hrms.settings:view":                    "View HRMS Settings",
  "hrms.settings:edit":                    "Edit HRMS Settings",
  "hrms.settings:configure":               "Configure HRMS Module",
  // Revenue Operations — aggregate
  "revenue_ops:view":                      "View Revenue Operations",
  "revenue_ops:manage":                    "Manage Revenue Operations & Commission Approvals",
  // Revenue Operations — granular
  "revenue_ops.signup_ownership:view":     "View Signup Ownership",
  "revenue_ops.signup_ownership:edit":     "Edit Signup Ownership",
  "revenue_ops.signup_ownership:assign":   "Assign Signup Ownership",
  "revenue_ops.renewal_ownership:view":    "View Renewal Ownership",
  "revenue_ops.renewal_ownership:edit":    "Edit Renewal Ownership",
  "revenue_ops.renewal_ownership:assign":  "Assign Renewal Ownership",
  "revenue_ops.addon_ownership:view":      "View Add-On Ownership",
  "revenue_ops.addon_ownership:edit":      "Edit Add-On Ownership",
  "revenue_ops.addon_ownership:assign":    "Assign Add-On Ownership",
  "revenue_ops.commission_processing:view":    "View Commission Processing",
  "revenue_ops.commission_processing:approve": "Approve Commission Runs",
  "revenue_ops.commission_processing:export":  "Export Commission Reports",
  "revenue_ops.commission_processing:process": "Process Commission Payroll",
  "revenue_ops.commission_processing:release": "Release Commission Payouts",
  // Laundry OS
  "laundry_os:view":                       "View Laundry OS",
  "laundry_os:configure":                  "Configure Laundry Workflow",
  // Brand Studio
  "brand_studio:view":                     "View Brand Studio",
  "brand_studio:edit":                     "Edit Brand Studio Settings",
  "brand_studio:configure":                "Configure Brand Studio",
  // Roles & Permissions
  "roles_permissions:edit":                "Edit Roles & Permissions",
  "roles_permissions:configure":           "Configure Role Definitions",
  // Website Management
  "website:view":                          "View Website Management",
  "website:create":                        "Create Website Content",
  "website:edit":                          "Edit Website Content",
  "website:delete":                        "Delete Website Content",
  "website:configure":                     "Configure Website Settings",
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
  "platform-invoices":      "subscriptions:view",
  "addons":                 "subscriptions:view",
  "account-billing":        "subscriptions:view",
  "plan-management":        "plan_management:view",
  "payment-plugins":        "payment_plugins:view",
  "domains":                "platform:manage_domains",
  "sales":                  "sales_team:view",
  "platform-users":         "users:view",
  "laundry-os":             "laundry_os:view",
  "laundry-businesses":     "laundry_os:view",
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
  // Quote & Proposals
  "proposals":              "proposals:view",
  // Proposal Documents
  "proposal-documents":     "proposals:view",
  // Payment Configuration
  "payment-config":         "payment_config:view",
  // System
  "roles-permissions":      "roles_permissions:view",
  "backup-monitoring":      "backup:view",
  "security-access":        "platform:security",
  "audit-logs":             "platform:audit_logs",
  "platform-settings":      "settings:view",
  "brand-studio":           "brand_studio:view",
  "settings":               "settings:view",
  "commission-calculator":  "commission:view",
  // HRMS
  "hrms-employees":         "hrms:view",
  "hrms-offer-letter":      "hrms:view",
  "hrms-annexure":          "hrms:view",
  "hrms-commission-slip":   "hrms:view",
  "hrms-payslip":           "hrms:view",
  "hrms-templates":         "hrms:view",
  "hrms-settings":          "hrms:manage",
  // Revenue Operations
  "rev-signup-ownership":      "revenue_ops:view",
  "rev-renewal-ownership":     "revenue_ops:view",
  "rev-addon-ownership":       "revenue_ops:view",
  "rev-commission-processing": "revenue_ops:manage",
  // Corporate Website
  "quantix-website":           "website:view",
}
