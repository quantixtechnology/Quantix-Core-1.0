// ============================================================================
// Quantix Technology — Role-Based Permission System
// MANAGED PLATFORM: Customers CANNOT self-signup. Only Quantix creates businesses.
// NO free trial — business created ONLY after payment verified.
// ============================================================================

import type { Role, Permission } from './types';

// ============================================================================
// PERMISSION MODULES — 17 modules for the managed platform
// ============================================================================

// Platform Module — Quantix internal only
export const PLATFORM_PERMISSIONS = {
  READ: 'platform:read',
  WRITE: 'platform:write',
  MANAGE_PLANS: 'platform:manage_plans',
  MANAGE_SALES: 'platform:manage_sales',
  VIEW_ANALYTICS: 'platform:view_analytics',
  MAINTENANCE: 'platform:maintenance',
  PRICING_OVERRIDE: 'platform:pricing_override',
} as const;

// Business Module — Super Admin creates/manages, Client Owner manages their own
// CLIENT_OWNER CANNOT create businesses
export const BUSINESS_PERMISSIONS = {
  READ: 'business:read',
  WRITE: 'business:write',
  DELETE: 'business:delete',
  SETTINGS: 'business:settings',
  BILLING: 'business:billing',
  TEAM_MANAGE: 'business:team_manage',
  CREATE: 'business:create',       // Super Admin only — NOT CLIENT_OWNER
  CONFIGURE: 'business:configure', // Super Admin: branding, features
  SUSPEND: 'business:suspend',     // Super Admin only
  ACTIVATE: 'business:activate',   // Super Admin only
} as const;

// Sales Module — Quantix Sales Team
export const SALES_PERMISSIONS = {
  READ: 'sales:read',
  WRITE: 'sales:write',
  MANAGE_LEADS: 'sales:manage_leads',
  FOLLOW_UP: 'sales:follow_up',
  TRACK_PIPELINE: 'sales:track_pipeline',
  VIEW_REPORTS: 'sales:view_reports',
  CONVERT_LEAD: 'sales:convert_lead',
  RENEWAL_TRACKING: 'sales:renewal_tracking',
  SHARE_DEMO: 'sales:share_demo',
} as const;

// Lead Module — Quantix team only
export const LEAD_PERMISSIONS = {
  READ: 'lead:read',
  WRITE: 'lead:write',
  DELETE: 'lead:delete',
  UPDATE_STAGE: 'lead:update_stage',
  ASSIGN: 'lead:assign',
  CONVERT: 'lead:convert',
  VIEW_PIPELINE: 'lead:view_pipeline',
} as const;

// Demo Tenant Module — Quantix team only
export const DEMO_TENANT_PERMISSIONS = {
  READ: 'demo_tenant:read',
  WRITE: 'demo_tenant:write',
  ASSIGN: 'demo_tenant:assign',
  RESET: 'demo_tenant:reset',
  MANAGE: 'demo_tenant:manage',
} as const;

// Onboarding Module — Quantix team + Client Owner (own business)
export const ONBOARDING_PERMISSIONS = {
  READ: 'onboarding:read',
  WRITE: 'onboarding:write',
  UPDATE_STEP: 'onboarding:update_step',
  COMPLETE: 'onboarding:complete',
  MANAGE_STEPS: 'onboarding:manage_steps',
} as const;

// Store Module
export const STORE_PERMISSIONS = {
  READ: 'store:read',
  WRITE: 'store:write',
  DELETE: 'store:delete',
  SETTINGS: 'store:settings',
  TIMINGS: 'store:timings',
  PRINTER_CONFIG: 'store:printer_config',
} as const;

// Product Module
export const PRODUCT_PERMISSIONS = {
  READ: 'product:read',
  WRITE: 'product:write',
  DELETE: 'product:delete',
  PRICING: 'product:pricing',
  INVENTORY: 'product:inventory',
  IMPORT: 'product:import',
} as const;

// Order Module
export const ORDER_PERMISSIONS = {
  READ: 'order:read',
  WRITE: 'order:write',
  CANCEL: 'order:cancel',
  REFUND: 'order:refund',
  ASSIGN: 'order:assign',
  EXPORT: 'order:export',
  UPDATE_STATUS: 'order:update_status',
} as const;

// Customer Module
export const CUSTOMER_PERMISSIONS = {
  READ: 'customer:read',
  WRITE: 'customer:write',
  DELETE: 'customer:delete',
  LOYALTY: 'customer:loyalty',
  COMMUNICATION: 'customer:communication',
} as const;

// Delivery Module
export const DELIVERY_PERMISSIONS = {
  READ: 'delivery:read',
  WRITE: 'delivery:write',
  ASSIGN: 'delivery:assign',
  TRACK: 'delivery:track',
  ZONES: 'delivery:zones',
  PARTNERS: 'delivery:partners',
  OTP_VERIFY: 'delivery:otp_verify',
  NAVIGATE: 'delivery:navigate',
} as const;

// Subscription Module (business's own subscription plans — car wash, home services)
export const SUBSCRIPTION_PERMISSIONS = {
  READ: 'subscription:read',
  WRITE: 'subscription:write',
  DELETE: 'subscription:delete',
  MANAGE: 'subscription:manage',
  BILLING: 'subscription:billing',
} as const;

// POS Module
export const POS_PERMISSIONS = {
  READ: 'pos:read',
  WRITE: 'pos:write',
  SESSION_MANAGE: 'pos:session_manage',
  CASH_DRAWER: 'pos:cash_drawer',
  REFUND: 'pos:refund',
  REPORTS: 'pos:reports',
} as const;

// Invoice Module
export const INVOICE_PERMISSIONS = {
  READ: 'invoice:read',
  WRITE: 'invoice:write',
  DELETE: 'invoice:delete',
  GENERATE: 'invoice:generate',
  EXPORT: 'invoice:export',
} as const;

// Settings Module
export const SETTINGS_PERMISSIONS = {
  READ: 'settings:read',
  WRITE: 'settings:write',
  TAX: 'settings:tax',
  PAYMENT: 'settings:payment',
  PROMO: 'settings:promo',
  NOTIFICATION: 'settings:notification',
} as const;

// Deployment Module — Quantix internal only
export const DEPLOYMENT_PERMISSIONS = {
  READ: 'deployment:read',
  WRITE: 'deployment:write',
  DEPLOY: 'deployment:deploy',
  ROLLBACK: 'deployment:rollback',
  VIEW_LOGS: 'deployment:view_logs',
  MANAGE_CONFIG: 'deployment:manage_config',
} as const;

// Domain Module — Quantix internal only
export const DOMAIN_PERMISSIONS = {
  READ: 'domain:read',
  WRITE: 'domain:write',
  CONFIGURE_DNS: 'domain:configure_dns',
  MANAGE_SSL: 'domain:manage_ssl',
  MAP_DOMAIN: 'domain:map_domain',
} as const;

// ============================================================================
// ALL PERMISSIONS FLAT LIST
// ============================================================================

export const ALL_PERMISSIONS: Permission[] = [
  // Platform
  ...Object.values(PLATFORM_PERMISSIONS),
  // Business
  ...Object.values(BUSINESS_PERMISSIONS),
  // Sales
  ...Object.values(SALES_PERMISSIONS),
  // Lead
  ...Object.values(LEAD_PERMISSIONS),
  // Demo Tenant
  ...Object.values(DEMO_TENANT_PERMISSIONS),
  // Onboarding
  ...Object.values(ONBOARDING_PERMISSIONS),
  // Store
  ...Object.values(STORE_PERMISSIONS),
  // Product
  ...Object.values(PRODUCT_PERMISSIONS),
  // Order
  ...Object.values(ORDER_PERMISSIONS),
  // Customer
  ...Object.values(CUSTOMER_PERMISSIONS),
  // Delivery
  ...Object.values(DELIVERY_PERMISSIONS),
  // Subscription
  ...Object.values(SUBSCRIPTION_PERMISSIONS),
  // POS
  ...Object.values(POS_PERMISSIONS),
  // Invoice
  ...Object.values(INVOICE_PERMISSIONS),
  // Settings
  ...Object.values(SETTINGS_PERMISSIONS),
  // Deployment
  ...Object.values(DEPLOYMENT_PERMISSIONS),
  // Domain
  ...Object.values(DOMAIN_PERMISSIONS),
];

// ============================================================================
// ROLE-PERMISSION MAPPING — MANAGED PLATFORM MODEL
// ============================================================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ─────────────────────────────────────────────────────────────────
  // QUANTIX_SUPER_ADMIN — Full platform access
  // Creates businesses, deploys, domain mapping, pricing overrides
  // Manages leads, demo tenants, onboarding, and all operations
  // ─────────────────────────────────────────────────────────────────
  QUANTIX_SUPER_ADMIN: [...ALL_PERMISSIONS],

  // ─────────────────────────────────────────────────────────────────
  // QUANTIX_SALES_TEAM — Lead management, onboarding, follow-ups
  // Can create businesses from verified leads, share demos
  // ─────────────────────────────────────────────────────────────────
  QUANTIX_SALES_TEAM: [
    // Platform
    PLATFORM_PERMISSIONS.READ,
    PLATFORM_PERMISSIONS.MANAGE_SALES,
    PLATFORM_PERMISSIONS.VIEW_ANALYTICS,
    // Business (limited — can view, create from leads, track onboarding)
    BUSINESS_PERMISSIONS.READ,
    BUSINESS_PERMISSIONS.WRITE,
    BUSINESS_PERMISSIONS.CREATE,
    BUSINESS_PERMISSIONS.CONFIGURE,
    // Sales
    ...Object.values(SALES_PERMISSIONS),
    // Lead
    ...Object.values(LEAD_PERMISSIONS),
    // Demo Tenant
    ...Object.values(DEMO_TENANT_PERMISSIONS),
    // Onboarding
    ONBOARDING_PERMISSIONS.READ,
    ONBOARDING_PERMISSIONS.WRITE,
    ONBOARDING_PERMISSIONS.UPDATE_STEP,
    // Store (read during onboarding)
    STORE_PERMISSIONS.READ,
    // Deployment (read only)
    DEPLOYMENT_PERMISSIONS.READ,
    // Domain (read only)
    DOMAIN_PERMISSIONS.READ,
  ],

  // ─────────────────────────────────────────────────────────────────
  // CLIENT_OWNER — Business owner (client)
  // Manages products, orders, delivery, POS, staff, reports
  // CANNOT: create businesses, deploy, change infra, domain mapping,
  //         override pricing, manage leads, manage demo tenants
  // ─────────────────────────────────────────────────────────────────
  CLIENT_OWNER: [
    // Business (own business only — enforced by middleware)
    BUSINESS_PERMISSIONS.READ,
    BUSINESS_PERMISSIONS.WRITE,
    BUSINESS_PERMISSIONS.SETTINGS,
    BUSINESS_PERMISSIONS.BILLING,
    BUSINESS_PERMISSIONS.TEAM_MANAGE,
    // NO business:create — only Quantix creates businesses
    // NO business:suspend, business:activate — only Quantix manages status
    // Onboarding (own business)
    ONBOARDING_PERMISSIONS.READ,
    ONBOARDING_PERMISSIONS.WRITE,
    ONBOARDING_PERMISSIONS.UPDATE_STEP,
    // Store
    ...Object.values(STORE_PERMISSIONS),
    // Product
    ...Object.values(PRODUCT_PERMISSIONS),
    // Order
    ...Object.values(ORDER_PERMISSIONS),
    // Customer
    ...Object.values(CUSTOMER_PERMISSIONS),
    // Delivery
    ...Object.values(DELIVERY_PERMISSIONS),
    // Subscription
    ...Object.values(SUBSCRIPTION_PERMISSIONS),
    // POS
    ...Object.values(POS_PERMISSIONS),
    // Invoice
    ...Object.values(INVOICE_PERMISSIONS),
    // Settings
    ...Object.values(SETTINGS_PERMISSIONS),
  ],

  // ─────────────────────────────────────────────────────────────────
  // STORE_MANAGER — Store operations, order handling, inventory
  // ─────────────────────────────────────────────────────────────────
  STORE_MANAGER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    STORE_PERMISSIONS.WRITE,
    STORE_PERMISSIONS.TIMINGS,
    STORE_PERMISSIONS.PRINTER_CONFIG,
    PRODUCT_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.WRITE,
    PRODUCT_PERMISSIONS.PRICING,
    PRODUCT_PERMISSIONS.INVENTORY,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    ORDER_PERMISSIONS.CANCEL,
    ORDER_PERMISSIONS.ASSIGN,
    ORDER_PERMISSIONS.UPDATE_STATUS,
    CUSTOMER_PERMISSIONS.READ,
    CUSTOMER_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.ASSIGN,
    DELIVERY_PERMISSIONS.TRACK,
    SUBSCRIPTION_PERMISSIONS.READ,
    POS_PERMISSIONS.READ,
    POS_PERMISSIONS.WRITE,
    POS_PERMISSIONS.SESSION_MANAGE,
    INVOICE_PERMISSIONS.READ,
    INVOICE_PERMISSIONS.GENERATE,
    SETTINGS_PERMISSIONS.READ,
  ],

  // ─────────────────────────────────────────────────────────────────
  // DELIVERY_STAFF — Assigned deliveries, pickup/delivery, OTP, route
  // ─────────────────────────────────────────────────────────────────
  DELIVERY_STAFF: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.UPDATE_STATUS,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.TRACK,
    DELIVERY_PERMISSIONS.OTP_VERIFY,
    DELIVERY_PERMISSIONS.NAVIGATE,
    CUSTOMER_PERMISSIONS.READ,
  ],

  // ─────────────────────────────────────────────────────────────────
  // CUSTOMER — Place orders, subscriptions, tracking, payments
  // Self-registration is only for CUSTOMER role
  // ─────────────────────────────────────────────────────────────────
  CUSTOMER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.READ,
    CUSTOMER_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.TRACK,
    SUBSCRIPTION_PERMISSIONS.READ,
    INVOICE_PERMISSIONS.READ,
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the given permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return permissions.some((p) => rolePermissions.includes(p));
}

/**
 * Check if a role has all of the given permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) return false;
  return permissions.every((p) => rolePermissions.includes(p));
}

/**
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a role is a Quantix platform role
 */
export function isPlatformRole(role: Role): boolean {
  return role === 'QUANTIX_SUPER_ADMIN' || role === 'QUANTIX_SALES_TEAM';
}

/**
 * Check if a role can create businesses
 * ONLY Quantix roles can create businesses — CLIENT_OWNER cannot
 */
export function canCreateBusiness(role: Role): boolean {
  return hasPermission(role, BUSINESS_PERMISSIONS.CREATE);
}

/**
 * Check if a role can override pricing
 * ONLY QUANTIX_SUPER_ADMIN can override pricing
 */
export function canOverridePricing(role: Role): boolean {
  return hasPermission(role, PLATFORM_PERMISSIONS.PRICING_OVERRIDE);
}

/**
 * Get permissions grouped by module for a given role
 */
export function getPermissionsByModule(role: Role): Record<string, Permission[]> {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  const grouped: Record<string, Permission[]> = {};

  const moduleMap: Record<string, Permission[]> = {
    platform: Object.values(PLATFORM_PERMISSIONS),
    business: Object.values(BUSINESS_PERMISSIONS),
    sales: Object.values(SALES_PERMISSIONS),
    lead: Object.values(LEAD_PERMISSIONS),
    demo_tenant: Object.values(DEMO_TENANT_PERMISSIONS),
    onboarding: Object.values(ONBOARDING_PERMISSIONS),
    store: Object.values(STORE_PERMISSIONS),
    product: Object.values(PRODUCT_PERMISSIONS),
    order: Object.values(ORDER_PERMISSIONS),
    customer: Object.values(CUSTOMER_PERMISSIONS),
    delivery: Object.values(DELIVERY_PERMISSIONS),
    subscription: Object.values(SUBSCRIPTION_PERMISSIONS),
    pos: Object.values(POS_PERMISSIONS),
    invoice: Object.values(INVOICE_PERMISSIONS),
    settings: Object.values(SETTINGS_PERMISSIONS),
    deployment: Object.values(DEPLOYMENT_PERMISSIONS),
    domain: Object.values(DOMAIN_PERMISSIONS),
  };

  for (const [module, modulePermissions] of Object.entries(moduleMap)) {
    const roleModulePermissions = modulePermissions.filter((p) => rolePermissions.includes(p));
    if (roleModulePermissions.length > 0) {
      grouped[module] = roleModulePermissions;
    }
  }

  return grouped;
}
