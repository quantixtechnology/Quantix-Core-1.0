// ============================================================================
// Quantix Core Platform — Platform Configuration & Module Registry
// "Run Your Business Smarter" — www.quantixtechnology.in
//
// Server-side only — do NOT import React components from this file.
// ============================================================================

import { db } from '@/lib/db';
import type { BusinessType, ModuleKey, ModuleConfig, ModuleStatus } from './types';

// ============================================================================
// MODULE REGISTRY — All supported business modules
// ============================================================================

/**
 * Central module registry. Each module defines:
 * - name: Human-readable display name
 * - description: What this module provides
 * - features: List of features enabled by this module
 * - defaultConfig: Default configuration when module is first enabled
 */
export const MODULE_REGISTRY: Record<ModuleKey, ModuleConfig> = {
  grocery: {
    name: 'Grocery Store',
    description: 'Full-featured grocery store with categories, variants, inventory, delivery, and POS',
    features: [
      'product_catalog',
      'categories',
      'variants_pricing',
      'inventory_tracking',
      'delivery_zones',
      'pos_terminal',
      'gst_billing',
      'promocodes',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: false,
      enablePOS: true,
      enableSubscriptions: false,
      defaultDeliveryRadius: 5,
      defaultPreparationTime: 30,
    },
  },
  restaurant: {
    name: 'Restaurant / Food Delivery',
    description: 'Restaurant with menu management, dine-in, delivery, and POS',
    features: [
      'menu_management',
      'dine_in',
      'delivery_zones',
      'pos_terminal',
      'kitchen_display',
      'table_management',
      'gst_billing',
      'promocodes',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: true,
      enableDineIn: true,
      enablePOS: true,
      defaultDeliveryRadius: 8,
      defaultPreparationTime: 25,
    },
  },
  pharmacy: {
    name: 'Pharmacy',
    description: 'Pharmacy with prescription management, delivery, and POS',
    features: [
      'product_catalog',
      'categories',
      'prescription_upload',
      'delivery_zones',
      'pos_terminal',
      'inventory_tracking',
      'gst_billing',
      'fssai_compliance',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: true,
      enablePOS: true,
      enableSubscriptions: false,
      defaultDeliveryRadius: 5,
      defaultPreparationTime: 15,
      requirePrescription: false,
    },
  },
  car_wash: {
    name: 'Car Wash',
    description: 'Car wash booking with credit-based subscriptions and scheduling',
    features: [
      'service_catalog',
      'credit_subscriptions',
      'booking_schedule',
      'pos_terminal',
      'gst_billing',
    ],
    defaultConfig: {
      enableDelivery: false,
      enablePickup: false,
      enablePOS: true,
      enableSubscriptions: true,
      defaultPreparationTime: 30,
      creditBasedModel: true,
    },
  },
  laundry: {
    name: 'Laundry & Dry Cleaning',
    description: 'Laundry with pickup & delivery, credit subscriptions, and order tracking',
    features: [
      'service_catalog',
      'pickup_and_delivery',
      'credit_subscriptions',
      'order_tracking',
      'gst_billing',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickupAndDelivery: true,
      enablePOS: false,
      enableSubscriptions: true,
      defaultDeliveryRadius: 10,
      defaultPreparationTime: 60,
      creditBasedModel: true,
    },
  },
  home_services: {
    name: 'Home Services',
    description: 'Home services booking with credit subscriptions and scheduling',
    features: [
      'service_catalog',
      'credit_subscriptions',
      'booking_schedule',
      'service_tracking',
      'gst_billing',
    ],
    defaultConfig: {
      enableDelivery: false,
      enablePickup: false,
      enablePOS: false,
      enableSubscriptions: true,
      defaultDeliveryRadius: 15,
      defaultPreparationTime: 60,
      creditBasedModel: true,
    },
  },
  ecommerce: {
    name: 'E-Commerce',
    description: 'General e-commerce with product catalog, delivery, and payments',
    features: [
      'product_catalog',
      'categories',
      'variants_pricing',
      'inventory_tracking',
      'delivery_zones',
      'gst_billing',
      'promocodes',
      'payment_gateway',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: false,
      enablePOS: false,
      enableSubscriptions: false,
      defaultDeliveryRadius: 20,
      defaultPreparationTime: 60,
    },
  },
  cosmetics: {
    name: 'Cosmetics & Beauty',
    description: 'Cosmetics store with product catalog, delivery, and POS',
    features: [
      'product_catalog',
      'categories',
      'variants_pricing',
      'inventory_tracking',
      'delivery_zones',
      'pos_terminal',
      'gst_billing',
      'promocodes',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: false,
      enablePOS: true,
      enableSubscriptions: false,
      defaultDeliveryRadius: 10,
      defaultPreparationTime: 20,
    },
  },
  meat_delivery: {
    name: 'Meat Delivery',
    description: 'Fresh meat delivery with product catalog, delivery, and FSSAI compliance',
    features: [
      'product_catalog',
      'categories',
      'variants_pricing',
      'inventory_tracking',
      'delivery_zones',
      'pos_terminal',
      'gst_billing',
      'fssai_compliance',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: true,
      enablePOS: true,
      enableSubscriptions: false,
      defaultDeliveryRadius: 8,
      defaultPreparationTime: 20,
    },
  },
  furniture: {
    name: 'Furniture Store',
    description: 'Furniture store with product catalog, delivery, and POS',
    features: [
      'product_catalog',
      'categories',
      'variants_pricing',
      'inventory_tracking',
      'delivery_zones',
      'pos_terminal',
      'gst_billing',
    ],
    defaultConfig: {
      enableDelivery: true,
      enablePickup: false,
      enablePOS: true,
      enableSubscriptions: false,
      defaultDeliveryRadius: 30,
      defaultPreparationTime: 120,
    },
  },
  directory: {
    name: 'Business Directory',
    description: 'Business listing directory with categories and search',
    features: [
      'business_listings',
      'categories',
      'search',
      'reviews',
    ],
    defaultConfig: {
      enableDelivery: false,
      enablePickup: false,
      enablePOS: false,
      enableSubscriptions: false,
    },
  },
};

// ============================================================================
// BUSINESS TYPE → DEFAULT MODULES
// Maps each BusinessType to the modules that should be auto-enabled
// ============================================================================

export const BUSINESS_TYPE_DEFAULT_MODULES: Record<BusinessType, ModuleKey[]> = {
  GROCERY: ['grocery'],
  FOOD_DELIVERY: ['restaurant'],
  LAUNDRY: ['laundry'],
  CAR_WASH: ['car_wash'],
  PHARMACY: ['pharmacy'],
  HOME_SERVICES: ['home_services'],
  ECOMMERCE: ['ecommerce'],
  COSMETICS: ['cosmetics'],
  MEAT_DELIVERY: ['meat_delivery'],
  FURNITURE: ['furniture'],
  DIRECTORY: ['directory'],
};

// ============================================================================
// PLATFORM CONFIG — Read/Write platform-level key-value config
// ============================================================================

/**
 * Read a platform configuration value by key.
 * Returns the parsed JSON value, or null if not found.
 */
export async function getPlatformConfig<T = unknown>(key: string): Promise<T | null> {
  const config = await db.platformConfig.findUnique({ where: { key } });
  if (!config) return null;
  try {
    return JSON.parse(config.value) as T;
  } catch {
    // If not valid JSON, return the raw string
    return config.value as unknown as T;
  }
}

/**
 * Set a platform configuration value.
 * Value will be JSON-serialized before storage.
 */
export async function setPlatformConfig(key: string, value: unknown, description?: string): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await db.platformConfig.upsert({
    where: { key },
    update: { value: serialized, description },
    create: { key, value: serialized, description },
  });
}

// ============================================================================
// BUSINESS MODULE OPERATIONS
// ============================================================================

/**
 * Get all enabled modules for a business.
 * Returns an array of BusinessModuleInfo objects.
 */
export async function getBusinessModules(businessId: string): Promise<
  Array<{
    id: string;
    moduleKey: string;
    moduleName: string;
    version: string;
    status: ModuleStatus;
    config: Record<string, unknown>;
    enabledAt: Date | null;
    disabledAt: Date | null;
  }>
> {
  const modules = await db.businessModule.findMany({
    where: { businessId },
    orderBy: { moduleKey: 'asc' },
  });

  return modules.map((m) => ({
    id: m.id,
    moduleKey: m.moduleKey,
    moduleName: m.moduleName,
    version: m.version,
    status: m.status as ModuleStatus,
    config: JSON.parse(m.config || '{}'),
    enabledAt: m.enabledAt,
    disabledAt: m.disabledAt,
  }));
}

/**
 * Check if a specific module is enabled for a business.
 * A module is considered active if its status is ENABLED or TRIAL.
 */
export async function isModuleEnabled(businessId: string, moduleKey: ModuleKey): Promise<boolean> {
  const moduleRecord = await db.businessModule.findUnique({
    where: {
      businessId_moduleKey: { businessId, moduleKey },
    },
    select: { status: true },
  });

  if (!moduleRecord) return false;
  return moduleRecord.status === 'ENABLED' || moduleRecord.status === 'TRIAL';
}

/**
 * Enable a module for a business.
 * Creates the module record if it doesn't exist, or updates it if disabled.
 * Applies registry defaults for config if no custom config provided.
 */
export async function enableModule(
  businessId: string,
  moduleKey: ModuleKey,
  config?: Record<string, unknown>
): Promise<void> {
  const registry = MODULE_REGISTRY[moduleKey];
  if (!registry) {
    throw new Error(`Unknown module key: ${moduleKey}`);
  }

  const moduleConfig = config || registry.defaultConfig;

  await db.businessModule.upsert({
    where: {
      businessId_moduleKey: { businessId, moduleKey },
    },
    update: {
      status: 'ENABLED',
      moduleName: registry.name,
      config: JSON.stringify(moduleConfig),
      enabledAt: new Date(),
      disabledAt: null,
    },
    create: {
      businessId,
      moduleKey,
      moduleName: registry.name,
      version: '1.0.0',
      status: 'ENABLED',
      config: JSON.stringify(moduleConfig),
      enabledAt: new Date(),
    },
  });
}

/**
 * Disable a module for a business.
 * Sets status to DISABLED and records the disabled timestamp.
 */
export async function disableModule(businessId: string, moduleKey: ModuleKey): Promise<void> {
  await db.businessModule.updateMany({
    where: {
      businessId,
      moduleKey,
      status: { not: 'DISABLED' },
    },
    data: {
      status: 'DISABLED',
      disabledAt: new Date(),
    },
  });
}

/**
 * Enable all default modules for a business based on its type.
 * Called during business onboarding.
 */
export async function enableDefaultModules(businessId: string, businessType: BusinessType): Promise<void> {
  const defaultModules = BUSINESS_TYPE_DEFAULT_MODULES[businessType] || [];

  for (const moduleKey of defaultModules) {
    await enableModule(businessId, moduleKey);
  }
}
