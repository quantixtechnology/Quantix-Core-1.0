// ============================================================================
// Product Feature Catalogs
// Master registry of all features available for each product
// These features are enforced by the platform, not by individual products
// References: Audit reports (COMMERCE_OS_ARCHITECTURE_AUDIT.md, LAUNDRY_OS_ARCHITECTURE_AUDIT.md)
// ============================================================================

export interface ProductFeature {
  code: string
  name: string
  description: string
  category: 'CORE' | 'ADVANCED' | 'PREMIUM'
  requiredForProduct: boolean
}

export interface ProductRole {
  code: string
  name: string
  description: string
  permissions: string[]
}

export interface ProductCatalog {
  features: ProductFeature[]
  roles: ProductRole[]
  subscriptionPlans: string[]
}

// ============================================================================
// COMMERCE OS FEATURE CATALOG
// Based on: COMMERCE_OS_ARCHITECTURE_AUDIT.md (85-90% complete)
// Source: src/components/business/layout/business-sidebar.tsx
// ============================================================================

export const COMMERCE_OS_CATALOG: ProductCatalog = {
  features: [
    // Core Commerce Features (required)
    {
      code: 'PRODUCTS',
      name: 'Product Catalog',
      description: 'Product management, categories, variants, images',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'INVENTORY',
      name: 'Inventory Management',
      description: 'Stock tracking, levels, alerts, multi-store inventory',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'ORDERS',
      name: 'Order Management',
      description: 'Order creation, status tracking, order history, invoices',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'CUSTOMERS',
      name: 'Customer Management',
      description: 'Customer database, profiles, purchase history, communications',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'DELIVERY',
      name: 'Delivery Management',
      description: 'Delivery zones, partner management, order tracking, real-time location',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'PAYMENTS',
      name: 'Payment Processing',
      description: 'Multiple payment gateway integration, refunds, payment history',
      category: 'CORE',
      requiredForProduct: true,
    },

    // Advanced Commerce Features
    {
      code: 'POS',
      name: 'POS System',
      description: 'Point of sale terminal, thermal printing, in-store sales',
      category: 'ADVANCED',
      requiredForProduct: false,
    },
    {
      code: 'COUPONS',
      name: 'Promotions & Coupons',
      description: 'Discount codes, promotional campaigns, offer management',
      category: 'ADVANCED',
      requiredForProduct: false,
    },
    {
      code: 'MARKETING',
      name: 'Marketing & Campaigns',
      description: 'Promotional banners, email campaigns, customer communications',
      category: 'ADVANCED',
      requiredForProduct: false,
    },
    {
      code: 'LOYALTY',
      name: 'Loyalty Program',
      description: 'Points system, rewards, customer loyalty tracking',
      category: 'ADVANCED',
      requiredForProduct: false,
    },

    // Premium Features
    {
      code: 'WHOLESALE',
      name: 'Wholesale Management',
      description: 'Bulk pricing, wholesale customer management, special pricing tiers',
      category: 'PREMIUM',
      requiredForProduct: false,
    },
    {
      code: 'ERP',
      name: 'ERP Integration',
      description: 'Enterprise resource planning integration, advanced analytics',
      category: 'PREMIUM',
      requiredForProduct: false,
    },
  ],

  roles: [
    {
      code: 'COMMERCE_OWNER',
      name: 'Commerce Owner',
      description: 'Full access to Commerce OS',
      permissions: ['orders:*', 'products:*', 'inventory:*', 'customers:*', 'delivery:*', 'payments:*'],
    },
    {
      code: 'STORE_MANAGER',
      name: 'Store Manager',
      description: 'Store operations and order management',
      permissions: ['orders:view', 'orders:edit', 'inventory:view', 'customers:view'],
    },
    {
      code: 'INVENTORY_STAFF',
      name: 'Inventory Staff',
      description: 'Stock and inventory management',
      permissions: ['inventory:*', 'products:view'],
    },
    {
      code: 'DELIVERY_STAFF',
      name: 'Delivery Staff',
      description: 'Delivery operations',
      permissions: ['delivery:view', 'orders:view'],
    },
    {
      code: 'CUSTOMER_SUPPORT',
      name: 'Customer Support',
      description: 'Customer service and order tracking',
      permissions: ['customers:view', 'orders:view', 'refunds:process'],
    },
  ],

  subscriptionPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
}

// ============================================================================
// LAUNDRY OS FEATURE CATALOG
// Based on: LAUNDRY_OS_ARCHITECTURE_AUDIT.md (78-82% complete)
// Source: Laundry workflow in Prisma schema + sidebar
// ============================================================================

export const LAUNDRY_OS_CATALOG: ProductCatalog = {
  features: [
    // Core Laundry Features (required)
    {
      code: 'ORDERS',
      name: 'Order Management',
      description: 'Laundry order creation, tracking, history, invoicing',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'PICKUP_DELIVERY',
      name: 'Pickup & Delivery',
      description: 'Customer pickup scheduling, delivery zones, partner assignment',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'STORE_AUDIT',
      name: 'Store Audit',
      description: 'Incoming order audit, garment verification, condition tracking',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'PROCESSING',
      name: 'Processing Center',
      description: 'Processing center management, queue handling, workflow stages',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'BATCH_QUEUE',
      name: 'Batch & Queue Management',
      description: 'Batch creation, queue management, batch status tracking',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'QC_SYSTEM',
      name: 'Quality Control',
      description: 'QC checks, quality assurance, inspection workflows',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'CUSTOMERS',
      name: 'Customer Management',
      description: 'Customer database, delivery address management, order history',
      category: 'CORE',
      requiredForProduct: true,
    },

    // Advanced Laundry Features
    {
      code: 'CRM',
      name: 'CRM System',
      description: 'Customer relationship management, communication history, notes',
      category: 'ADVANCED',
      requiredForProduct: false,
    },
    {
      code: 'MARKETING',
      name: 'Marketing',
      description: 'Promotional campaigns, customer engagement, announcements',
      category: 'ADVANCED',
      requiredForProduct: false,
    },
    {
      code: 'SUBSCRIPTIONS',
      name: 'Subscription Plans',
      description: 'Recurring service packages, monthly plans, subscription management',
      category: 'ADVANCED',
      requiredForProduct: false,
    },

    // Premium Features
    {
      code: 'MULTI_STORE',
      name: 'Multi-Store Management',
      description: 'Multiple store/branch management, centralized control',
      category: 'PREMIUM',
      requiredForProduct: false,
    },
    {
      code: 'MULTI_PROCESSING',
      name: 'Multi-Processing Centers',
      description: 'Multiple processing center support, distributed processing',
      category: 'PREMIUM',
      requiredForProduct: false,
    },
    {
      code: 'WHATSAPP',
      name: 'WhatsApp Integration',
      description: 'WhatsApp notifications, customer communication',
      category: 'PREMIUM',
      requiredForProduct: false,
    },
  ],

  roles: [
    {
      code: 'LAUNDRY_OWNER',
      name: 'Laundry Owner',
      description: 'Full access to Laundry OS',
      permissions: ['orders:*', 'processing:*', 'customers:*', 'delivery:*', 'qc:*'],
    },
    {
      code: 'STORE_MANAGER',
      name: 'Store Manager',
      description: 'Store operations',
      permissions: ['orders:view', 'orders:edit', 'customers:view', 'audit:perform'],
    },
    {
      code: 'AUDIT_EXECUTIVE',
      name: 'Audit Executive',
      description: 'Store audit operations',
      permissions: ['audit:perform', 'orders:view'],
    },
    {
      code: 'PROCESSING_MANAGER',
      name: 'Processing Manager',
      description: 'Processing center management',
      permissions: ['processing:*', 'batch:*', 'queue:*'],
    },
    {
      code: 'PROCESSING_STAFF',
      name: 'Processing Staff',
      description: 'Processing operations',
      permissions: ['processing:view', 'batch:view', 'queue:view'],
    },
    {
      code: 'QC_EXECUTIVE',
      name: 'QC Executive',
      description: 'Quality control operations',
      permissions: ['qc:*', 'orders:view'],
    },
    {
      code: 'DELIVERY_EXECUTIVE',
      name: 'Delivery Executive',
      description: 'Delivery management',
      permissions: ['delivery:*', 'orders:view'],
    },
  ],

  subscriptionPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
}

// ============================================================================
// CAR WASH OS FEATURE CATALOG (Placeholder - Future Implementation)
// ============================================================================

export const CARWASH_OS_CATALOG: ProductCatalog = {
  features: [
    {
      code: 'SERVICES',
      name: 'Service Management',
      description: 'Service types, packages, pricing',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'SCHEDULING',
      name: 'Service Scheduling',
      description: 'Appointment booking, time slot management',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'QUEUE',
      name: 'Queue Management',
      description: 'Service queue, wait time tracking',
      category: 'CORE',
      requiredForProduct: true,
    },
    {
      code: 'CUSTOMERS',
      name: 'Customer Management',
      description: 'Customer database, vehicle information',
      category: 'CORE',
      requiredForProduct: true,
    },
  ],

  roles: [
    {
      code: 'CARWASH_OWNER',
      name: 'Car Wash Owner',
      description: 'Full access',
      permissions: ['services:*', 'scheduling:*', 'queue:*'],
    },
  ],

  subscriptionPlans: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
}

// ============================================================================
// Product Catalogs Registry
// Maps product code to its feature catalog
// ============================================================================

export const PRODUCT_CATALOGS: Record<string, ProductCatalog> = {
  COMMERCE: COMMERCE_OS_CATALOG,
  LAUNDRY: LAUNDRY_OS_CATALOG,
  CARWASH: CARWASH_OS_CATALOG,
}

/**
 * Get feature catalog for a product
 */
export function getProductCatalog(productCode: string): ProductCatalog | null {
  return PRODUCT_CATALOGS[productCode] || null
}

/**
 * Get all features for a product
 */
export function getProductFeatures(productCode: string): ProductFeature[] {
  const catalog = getProductCatalog(productCode)
  return catalog?.features || []
}

/**
 * Get all roles for a product
 */
export function getProductRoles(productCode: string): ProductRole[] {
  const catalog = getProductCatalog(productCode)
  return catalog?.roles || []
}

/**
 * Check if product has a feature
 */
export function hasFeature(productCode: string, featureCode: string): boolean {
  const features = getProductFeatures(productCode)
  return features.some((f) => f.code === featureCode)
}

/**
 * Get required features for a product (those that are always enabled)
 */
export function getRequiredFeatures(productCode: string): ProductFeature[] {
  const features = getProductFeatures(productCode)
  return features.filter((f) => f.requiredForProduct)
}

/**
 * Get optional features for a product (those that can be enabled/disabled)
 */
export function getOptionalFeatures(productCode: string): ProductFeature[] {
  const features = getProductFeatures(productCode)
  return features.filter((f) => !f.requiredForProduct)
}
