// ============================================================================
// Product Permission Defaults
// Default permissions for each role within each product
// These are Product-level defaults only, not Business-level assignments
// ============================================================================

export interface RolePermissions {
  role: string
  permissions: string[]
}

// ============================================================================
// COMMERCE OS DEFAULT PERMISSIONS
// ============================================================================

export const COMMERCE_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'COMMERCE_OWNER',
    permissions: [
      'products:view',
      'products:create',
      'products:edit',
      'products:delete',
      'inventory:view',
      'inventory:edit',
      'orders:view',
      'orders:edit',
      'orders:cancel',
      'customers:view',
      'customers:create',
      'customers:edit',
      'customers:delete',
      'delivery:view',
      'delivery:manage',
      'payments:view',
      'payments:process',
      'reports:view',
      'reports:export',
      'settings:view',
      'settings:edit',
      'pos:access',
      'marketing:manage',
      'loyalty:manage',
      'users:create',
      'users:edit',
      'users:delete',
      'users:impersonate',
    ],
  },
  {
    role: 'STORE_MANAGER',
    permissions: [
      'products:view',
      'inventory:view',
      'inventory:edit',
      'orders:view',
      'orders:edit',
      'customers:view',
      'customers:create',
      'customers:edit',
      'delivery:view',
      'payments:view',
      'reports:view',
      'pos:access',
      'users:view',
    ],
  },
  {
    role: 'INVENTORY_STAFF',
    permissions: [
      'products:view',
      'inventory:view',
      'inventory:edit',
      'reports:view',
    ],
  },
  {
    role: 'DELIVERY_STAFF',
    permissions: [
      'orders:view',
      'delivery:view',
      'delivery:manage',
      'reports:view',
    ],
  },
  {
    role: 'CUSTOMER_SUPPORT',
    permissions: [
      'orders:view',
      'customers:view',
      'customers:edit',
      'refunds:process',
      'reports:view',
    ],
  },
]

// ============================================================================
// LAUNDRY OS DEFAULT PERMISSIONS
// ============================================================================

export const LAUNDRY_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'LAUNDRY_OWNER',
    permissions: [
      'orders:view',
      'orders:create',
      'orders:edit',
      'orders:cancel',
      'processing:view',
      'processing:manage',
      'customers:view',
      'customers:create',
      'customers:edit',
      'customers:delete',
      'delivery:view',
      'delivery:manage',
      'qc:view',
      'qc:manage',
      'reports:view',
      'reports:export',
      'settings:view',
      'settings:edit',
      'crm:manage',
      'marketing:manage',
      'subscriptions:manage',
      'users:create',
      'users:edit',
      'users:delete',
      'users:impersonate',
    ],
  },
  {
    role: 'STORE_MANAGER',
    permissions: [
      'orders:view',
      'orders:edit',
      'customers:view',
      'customers:create',
      'customers:edit',
      'audit:perform',
      'reports:view',
      'users:view',
    ],
  },
  {
    role: 'AUDIT_EXECUTIVE',
    permissions: [
      'orders:view',
      'orders:edit',
      'audit:perform',
      'reports:view',
    ],
  },
  {
    role: 'PROCESSING_MANAGER',
    permissions: [
      'orders:view',
      'processing:view',
      'processing:manage',
      'qc:view',
      'reports:view',
      'users:view',
    ],
  },
  {
    role: 'PROCESSING_STAFF',
    permissions: [
      'orders:view',
      'processing:view',
      'qc:view',
    ],
  },
  {
    role: 'QC_EXECUTIVE',
    permissions: [
      'orders:view',
      'qc:view',
      'qc:manage',
      'reports:view',
    ],
  },
  {
    role: 'DELIVERY_EXECUTIVE',
    permissions: [
      'orders:view',
      'delivery:view',
      'delivery:manage',
      'reports:view',
    ],
  },
]

// ============================================================================
// CAR WASH OS DEFAULT PERMISSIONS (Placeholder)
// ============================================================================

export const CARWASH_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'CARWASH_OWNER',
    permissions: [
      'services:view',
      'services:manage',
      'scheduling:view',
      'scheduling:manage',
      'queue:view',
      'queue:manage',
      'customers:view',
      'customers:edit',
      'reports:view',
      'settings:edit',
      'users:create',
      'users:edit',
    ],
  },
]

// ============================================================================
// Permission Registry
// ============================================================================

export const PRODUCT_PERMISSIONS: Record<string, RolePermissions[]> = {
  COMMERCE: COMMERCE_ROLE_PERMISSIONS,
  LAUNDRY: LAUNDRY_ROLE_PERMISSIONS,
  CARWASH: CARWASH_ROLE_PERMISSIONS,
}

/**
 * Get permissions for a role in a product
 */
export function getRolePermissions(productCode: string, roleCode: string): string[] {
  const productPermissions = PRODUCT_PERMISSIONS[productCode]
  if (!productPermissions) return []

  const rolePerms = productPermissions.find((rp) => rp.role === roleCode)
  return rolePerms?.permissions || []
}

/**
 * Get all roles and permissions for a product
 */
export function getProductRolePermissions(productCode: string): RolePermissions[] {
  return PRODUCT_PERMISSIONS[productCode] || []
}

/**
 * Check if a role has a permission
 */
export function hasPermission(
  productCode: string,
  roleCode: string,
  permission: string
): boolean {
  const permissions = getRolePermissions(productCode, roleCode)
  return permissions.includes(permission)
}
