// ============================================================================
// Quantix Technology - Role-Based Permission System
// ============================================================================

import type { Role, Permission } from './types';

// ============================================================================
// PERMISSION DEFINITIONS - Grouped by Module
// ============================================================================

// Business Module
export const BUSINESS_PERMISSIONS = {
  READ: 'business:read',
  WRITE: 'business:write',
  DELETE: 'business:delete',
  SETTINGS: 'business:settings',
  BILLING: 'business:billing',
  TEAM_MANAGE: 'business:team_manage',
} as const;

// Store Module
export const STORE_PERMISSIONS = {
  READ: 'store:read',
  WRITE: 'store:write',
  DELETE: 'store:delete',
  SETTINGS: 'store:settings',
  TIMINGS: 'store:timings',
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
} as const;

// Subscription Module
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

// ============================================================================
// ALL PERMISSIONS FLAT LIST
// ============================================================================

export const ALL_PERMISSIONS: Permission[] = [
  // Business
  BUSINESS_PERMISSIONS.READ,
  BUSINESS_PERMISSIONS.WRITE,
  BUSINESS_PERMISSIONS.DELETE,
  BUSINESS_PERMISSIONS.SETTINGS,
  BUSINESS_PERMISSIONS.BILLING,
  BUSINESS_PERMISSIONS.TEAM_MANAGE,
  // Store
  STORE_PERMISSIONS.READ,
  STORE_PERMISSIONS.WRITE,
  STORE_PERMISSIONS.DELETE,
  STORE_PERMISSIONS.SETTINGS,
  STORE_PERMISSIONS.TIMINGS,
  // Product
  PRODUCT_PERMISSIONS.READ,
  PRODUCT_PERMISSIONS.WRITE,
  PRODUCT_PERMISSIONS.DELETE,
  PRODUCT_PERMISSIONS.PRICING,
  PRODUCT_PERMISSIONS.INVENTORY,
  PRODUCT_PERMISSIONS.IMPORT,
  // Order
  ORDER_PERMISSIONS.READ,
  ORDER_PERMISSIONS.WRITE,
  ORDER_PERMISSIONS.CANCEL,
  ORDER_PERMISSIONS.REFUND,
  ORDER_PERMISSIONS.ASSIGN,
  ORDER_PERMISSIONS.EXPORT,
  // Customer
  CUSTOMER_PERMISSIONS.READ,
  CUSTOMER_PERMISSIONS.WRITE,
  CUSTOMER_PERMISSIONS.DELETE,
  CUSTOMER_PERMISSIONS.LOYALTY,
  CUSTOMER_PERMISSIONS.COMMUNICATION,
  // Delivery
  DELIVERY_PERMISSIONS.READ,
  DELIVERY_PERMISSIONS.WRITE,
  DELIVERY_PERMISSIONS.ASSIGN,
  DELIVERY_PERMISSIONS.TRACK,
  DELIVERY_PERMISSIONS.ZONES,
  DELIVERY_PERMISSIONS.PARTNERS,
  // Subscription
  SUBSCRIPTION_PERMISSIONS.READ,
  SUBSCRIPTION_PERMISSIONS.WRITE,
  SUBSCRIPTION_PERMISSIONS.DELETE,
  SUBSCRIPTION_PERMISSIONS.MANAGE,
  SUBSCRIPTION_PERMISSIONS.BILLING,
  // POS
  POS_PERMISSIONS.READ,
  POS_PERMISSIONS.WRITE,
  POS_PERMISSIONS.SESSION_MANAGE,
  POS_PERMISSIONS.CASH_DRAWER,
  POS_PERMISSIONS.REFUND,
  POS_PERMISSIONS.REPORTS,
  // Invoice
  INVOICE_PERMISSIONS.READ,
  INVOICE_PERMISSIONS.WRITE,
  INVOICE_PERMISSIONS.DELETE,
  INVOICE_PERMISSIONS.GENERATE,
  INVOICE_PERMISSIONS.EXPORT,
  // Settings
  SETTINGS_PERMISSIONS.READ,
  SETTINGS_PERMISSIONS.WRITE,
  SETTINGS_PERMISSIONS.TAX,
  SETTINGS_PERMISSIONS.PAYMENT,
  SETTINGS_PERMISSIONS.PROMO,
  SETTINGS_PERMISSIONS.NOTIFICATION,
];

// ============================================================================
// ROLE-PERMISSION MAPPING
// ============================================================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  BUSINESS_OWNER: [
    BUSINESS_PERMISSIONS.READ,
    BUSINESS_PERMISSIONS.WRITE,
    BUSINESS_PERMISSIONS.SETTINGS,
    BUSINESS_PERMISSIONS.BILLING,
    BUSINESS_PERMISSIONS.TEAM_MANAGE,
    STORE_PERMISSIONS.READ,
    STORE_PERMISSIONS.WRITE,
    STORE_PERMISSIONS.SETTINGS,
    STORE_PERMISSIONS.TIMINGS,
    PRODUCT_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.WRITE,
    PRODUCT_PERMISSIONS.DELETE,
    PRODUCT_PERMISSIONS.PRICING,
    PRODUCT_PERMISSIONS.INVENTORY,
    PRODUCT_PERMISSIONS.IMPORT,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    ORDER_PERMISSIONS.CANCEL,
    ORDER_PERMISSIONS.REFUND,
    ORDER_PERMISSIONS.ASSIGN,
    ORDER_PERMISSIONS.EXPORT,
    CUSTOMER_PERMISSIONS.READ,
    CUSTOMER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.DELETE,
    CUSTOMER_PERMISSIONS.LOYALTY,
    CUSTOMER_PERMISSIONS.COMMUNICATION,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.ASSIGN,
    DELIVERY_PERMISSIONS.TRACK,
    DELIVERY_PERMISSIONS.ZONES,
    DELIVERY_PERMISSIONS.PARTNERS,
    SUBSCRIPTION_PERMISSIONS.READ,
    SUBSCRIPTION_PERMISSIONS.WRITE,
    SUBSCRIPTION_PERMISSIONS.DELETE,
    SUBSCRIPTION_PERMISSIONS.MANAGE,
    SUBSCRIPTION_PERMISSIONS.BILLING,
    POS_PERMISSIONS.READ,
    POS_PERMISSIONS.WRITE,
    POS_PERMISSIONS.SESSION_MANAGE,
    POS_PERMISSIONS.CASH_DRAWER,
    POS_PERMISSIONS.REFUND,
    POS_PERMISSIONS.REPORTS,
    INVOICE_PERMISSIONS.READ,
    INVOICE_PERMISSIONS.WRITE,
    INVOICE_PERMISSIONS.DELETE,
    INVOICE_PERMISSIONS.GENERATE,
    INVOICE_PERMISSIONS.EXPORT,
    SETTINGS_PERMISSIONS.READ,
    SETTINGS_PERMISSIONS.WRITE,
    SETTINGS_PERMISSIONS.TAX,
    SETTINGS_PERMISSIONS.PAYMENT,
    SETTINGS_PERMISSIONS.PROMO,
    SETTINGS_PERMISSIONS.NOTIFICATION,
  ],

  BUSINESS_ADMIN: [
    BUSINESS_PERMISSIONS.READ,
    BUSINESS_PERMISSIONS.SETTINGS,
    STORE_PERMISSIONS.READ,
    STORE_PERMISSIONS.WRITE,
    STORE_PERMISSIONS.SETTINGS,
    STORE_PERMISSIONS.TIMINGS,
    PRODUCT_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.WRITE,
    PRODUCT_PERMISSIONS.PRICING,
    PRODUCT_PERMISSIONS.INVENTORY,
    PRODUCT_PERMISSIONS.IMPORT,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    ORDER_PERMISSIONS.CANCEL,
    ORDER_PERMISSIONS.ASSIGN,
    ORDER_PERMISSIONS.EXPORT,
    CUSTOMER_PERMISSIONS.READ,
    CUSTOMER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.LOYALTY,
    CUSTOMER_PERMISSIONS.COMMUNICATION,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.ASSIGN,
    DELIVERY_PERMISSIONS.TRACK,
    DELIVERY_PERMISSIONS.ZONES,
    DELIVERY_PERMISSIONS.PARTNERS,
    SUBSCRIPTION_PERMISSIONS.READ,
    SUBSCRIPTION_PERMISSIONS.WRITE,
    SUBSCRIPTION_PERMISSIONS.MANAGE,
    POS_PERMISSIONS.READ,
    POS_PERMISSIONS.WRITE,
    POS_PERMISSIONS.SESSION_MANAGE,
    POS_PERMISSIONS.REPORTS,
    INVOICE_PERMISSIONS.READ,
    INVOICE_PERMISSIONS.WRITE,
    INVOICE_PERMISSIONS.GENERATE,
    INVOICE_PERMISSIONS.EXPORT,
    SETTINGS_PERMISSIONS.READ,
    SETTINGS_PERMISSIONS.WRITE,
    SETTINGS_PERMISSIONS.TAX,
    SETTINGS_PERMISSIONS.PAYMENT,
    SETTINGS_PERMISSIONS.PROMO,
    SETTINGS_PERMISSIONS.NOTIFICATION,
  ],

  STORE_MANAGER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    STORE_PERMISSIONS.WRITE,
    STORE_PERMISSIONS.TIMINGS,
    PRODUCT_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.WRITE,
    PRODUCT_PERMISSIONS.PRICING,
    PRODUCT_PERMISSIONS.INVENTORY,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    ORDER_PERMISSIONS.CANCEL,
    ORDER_PERMISSIONS.ASSIGN,
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

  STORE_STAFF: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.INVENTORY,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.TRACK,
    POS_PERMISSIONS.READ,
    POS_PERMISSIONS.WRITE,
    INVOICE_PERMISSIONS.READ,
  ],

  CASHIER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.READ,
    POS_PERMISSIONS.READ,
    POS_PERMISSIONS.WRITE,
    POS_PERMISSIONS.CASH_DRAWER,
    INVOICE_PERMISSIONS.READ,
    INVOICE_PERMISSIONS.GENERATE,
  ],

  DELIVERY_MANAGER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.ASSIGN,
    CUSTOMER_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.WRITE,
    DELIVERY_PERMISSIONS.ASSIGN,
    DELIVERY_PERMISSIONS.TRACK,
    DELIVERY_PERMISSIONS.ZONES,
    DELIVERY_PERMISSIONS.PARTNERS,
  ],

  DELIVERY_PARTNER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.READ,
    DELIVERY_PERMISSIONS.TRACK,
  ],

  CUSTOMER: [
    BUSINESS_PERMISSIONS.READ,
    STORE_PERMISSIONS.READ,
    PRODUCT_PERMISSIONS.READ,
    ORDER_PERMISSIONS.READ,
    ORDER_PERMISSIONS.WRITE,
    CUSTOMER_PERMISSIONS.READ,
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
 * Get all permissions for a given role
 */
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
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
 * Get permissions grouped by module for a given role
 */
export function getPermissionsByModule(role: Role): Record<string, Permission[]> {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  const grouped: Record<string, Permission[]> = {};

  const moduleMap: Record<string, Permission[]> = {
    business: Object.values(BUSINESS_PERMISSIONS),
    store: Object.values(STORE_PERMISSIONS),
    product: Object.values(PRODUCT_PERMISSIONS),
    order: Object.values(ORDER_PERMISSIONS),
    customer: Object.values(CUSTOMER_PERMISSIONS),
    delivery: Object.values(DELIVERY_PERMISSIONS),
    subscription: Object.values(SUBSCRIPTION_PERMISSIONS),
    pos: Object.values(POS_PERMISSIONS),
    invoice: Object.values(INVOICE_PERMISSIONS),
    settings: Object.values(SETTINGS_PERMISSIONS),
  };

  for (const [module, modulePermissions] of Object.entries(moduleMap)) {
    const roleModulePermissions = modulePermissions.filter((p) => rolePermissions.includes(p));
    if (roleModulePermissions.length > 0) {
      grouped[module] = roleModulePermissions;
    }
  }

  return grouped;
}
