// ============================================================================
// Quantix Technology — Multi-Tenant Architecture
// Row-Level Isolation via business_id + store_id
// MANAGED PLATFORM: Super Admin has no business_id constraint
// ============================================================================

import { db } from './db';
import type { Role, BusinessType } from './types';
import { isPlatformRole } from './permissions';

// ============================================================================
// TYPES
// ============================================================================

export interface TenantContext {
  businessId: string;
  storeId?: string;
  role: Role;
  isPlatformAdmin: boolean;
}

export interface TenantQueryFilter {
  businessId: string;
  storeId?: string;
}

/**
 * Business-type-specific feature configuration.
 * Each business type gets a different set of enabled modules.
 */
export const BUSINESS_TYPE_FEATURES: Record<BusinessType, BusinessTypeFeatureConfig> = {
  GROCERY: {
    hasDelivery: true,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 5,
    defaultPreparationTime: 30,
    requiresFssai: true,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  FOOD_DELIVERY: {
    hasDelivery: true,
    hasPickup: true,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: true,
    hasSchedule: true,
    defaultDeliveryRadius: 8,
    defaultPreparationTime: 25,
    requiresFssai: true,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  LAUNDRY: {
    hasDelivery: true,
    hasPickup: false,
    hasPickupAndDelivery: true,
    hasPOS: false,
    hasSubscription: true,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 10,
    defaultPreparationTime: 60,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: true,
    productType: 'SERVICE',
  },
  CAR_WASH: {
    hasDelivery: false,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: true,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 0,
    defaultPreparationTime: 30,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: true,
    productType: 'SERVICE',
  },
  PHARMACY: {
    hasDelivery: true,
    hasPickup: true,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 5,
    defaultPreparationTime: 15,
    requiresFssai: true,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  HOME_SERVICES: {
    hasDelivery: false,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: false,
    hasSubscription: true,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 15,
    defaultPreparationTime: 60,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: true,
    productType: 'SERVICE',
  },
  ECOMMERCE: {
    hasDelivery: true,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: false,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: false,
    defaultDeliveryRadius: 20,
    defaultPreparationTime: 60,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  COSMETICS: {
    hasDelivery: true,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: false,
    defaultDeliveryRadius: 10,
    defaultPreparationTime: 20,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  MEAT_DELIVERY: {
    hasDelivery: true,
    hasPickup: true,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 8,
    defaultPreparationTime: 20,
    requiresFssai: true,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  FURNITURE: {
    hasDelivery: true,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: true,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: true,
    defaultDeliveryRadius: 30,
    defaultPreparationTime: 120,
    requiresFssai: false,
    requiresGst: true,
    creditBasedSubscription: false,
    productType: 'PHYSICAL',
  },
  DIRECTORY: {
    hasDelivery: false,
    hasPickup: false,
    hasPickupAndDelivery: false,
    hasPOS: false,
    hasSubscription: false,
    hasDineIn: false,
    hasSchedule: false,
    defaultDeliveryRadius: 0,
    defaultPreparationTime: 0,
    requiresFssai: false,
    requiresGst: false,
    creditBasedSubscription: false,
    productType: 'SERVICE',
  },
};

export interface BusinessTypeFeatureConfig {
  hasDelivery: boolean;
  hasPickup: boolean;
  hasPickupAndDelivery: boolean;
  hasPOS: boolean;
  hasSubscription: boolean;
  hasDineIn: boolean;
  hasSchedule: boolean;
  defaultDeliveryRadius: number;
  defaultPreparationTime: number;
  requiresFssai: boolean;
  requiresGst: boolean;
  creditBasedSubscription: boolean;
  productType: 'PHYSICAL' | 'DIGITAL' | 'SERVICE' | 'SUBSCRIPTION';
}

// ============================================================================
// TENANT QUERY BUILDER — Auto-scopes all Prisma queries
// ============================================================================

/**
 * Build a where clause that enforces tenant isolation.
 * Platform admins (Super Admin, Sales Team) can bypass business_id filtering.
 */
export function tenantFilter(ctx: TenantContext): TenantQueryFilter {
  return {
    businessId: ctx.businessId,
    storeId: ctx.storeId,
  };
}

/**
 * Build a business-scoped where clause (no store filter).
 * Use for models that belong to a business but not a specific store.
 */
export function businessFilter(businessId: string): { businessId: string } {
  return { businessId };
}

/**
 * Build a store-scoped where clause.
 * Use for models that belong to a specific store (inventory, POS sessions).
 */
export function storeFilter(storeId: string): { storeId: string } {
  return { storeId };
}

/**
 * Validate that a user has access to a specific business.
 * Platform admins can access any business.
 */
export function canAccessBusiness(ctx: TenantContext, targetBusinessId: string): boolean {
  if (ctx.isPlatformAdmin) return true;
  return ctx.businessId === targetBusinessId;
}

/**
 * Validate that a user has access to a specific store.
 * Platform admins and business-level users can access any store in their business.
 * Store managers can only access their assigned store.
 */
export function canAccessStore(ctx: TenantContext, targetStoreId: string): boolean {
  if (ctx.isPlatformAdmin) return true;
  // Store manager is scoped to their store
  if (ctx.role === 'STORE_MANAGER' && ctx.storeId) {
    return ctx.storeId === targetStoreId;
  }
  // Other roles with business access can access all stores in the business
  return true;
}

// ============================================================================
// TENANT RESOLUTION — Resolve business context from request
// ============================================================================

/**
 * Resolve full tenant context including business and store details.
 * Returns null if the business/store doesn't exist or user lacks access.
 */
export async function resolveTenantContext(
  userId: string,
  businessId?: string,
  storeId?: string
): Promise<{
  businessId: string;
  businessType: BusinessType;
  businessSlug: string;
  businessName: string;
  role: Role;
  storeId?: string;
  isPlatformAdmin: boolean;
} | null> {
  // Check if user is a platform admin
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      businessUsers: { where: { isActive: true } },
      salesProfile: true,
    },
  });

  if (!user || !user.isActive) return null;

  const isPlatformAdmin = user.email.endsWith('@quantixtechnology.in') || !!user.salesProfile;

  // Platform admin without specific business context
  if (isPlatformAdmin && !businessId) {
    return {
      businessId: '',
      businessType: 'GROCERY',
      businessSlug: '',
      businessName: 'Quantix Technology',
      role: user.salesProfile ? 'QUANTIX_SALES_TEAM' : 'QUANTIX_SUPER_ADMIN',
      isPlatformAdmin: true,
    };
  }

  // Platform admin targeting a specific business
  if (isPlatformAdmin && businessId) {
    const business = await db.business.findUnique({ where: { id: businessId } });
    if (!business) return null;
    return {
      businessId: business.id,
      businessType: business.businessType as BusinessType,
      businessSlug: business.slug,
      businessName: business.name,
      role: user.salesProfile ? 'QUANTIX_SALES_TEAM' : 'QUANTIX_SUPER_ADMIN',
      storeId,
      isPlatformAdmin: true,
    };
  }

  // Non-platform user — must have business membership
  const bu = user.businessUsers.find(b =>
    businessId ? b.businessId === businessId : true
  );
  if (!bu) return null;

  const business = await db.business.findUnique({ where: { id: bu.businessId } });
  if (!business) return null;

  return {
    businessId: business.id,
    businessType: business.businessType as BusinessType,
    businessSlug: business.slug,
    businessName: business.name,
    role: bu.role as Role,
    storeId: storeId || bu.storeId || undefined,
    isPlatformAdmin: false,
  };
}

// ============================================================================
// BUSINESS TYPE VALIDATION
// ============================================================================

/**
 * Get the feature config for a business type.
 */
export function getBusinessTypeFeatures(type: BusinessType): BusinessTypeFeatureConfig {
  return BUSINESS_TYPE_FEATURES[type];
}

/**
 * Check if a business type supports a specific order type.
 */
export function businessSupportsOrderType(
  type: BusinessType,
  orderType: 'DELIVERY' | 'PICKUP' | 'DINE_IN' | 'POS' | 'SUBSCRIPTION' | 'PICKUP_AND_DELIVERY'
): boolean {
  const features = BUSINESS_TYPE_FEATURES[type];
  switch (orderType) {
    case 'DELIVERY': return features.hasDelivery;
    case 'PICKUP': return features.hasPickup;
    case 'DINE_IN': return features.hasDineIn;
    case 'POS': return features.hasPOS;
    case 'SUBSCRIPTION': return features.hasSubscription;
    case 'PICKUP_AND_DELIVERY': return features.hasPickupAndDelivery;
    default: return false;
  }
}

/**
 * Validate that a business has the required licenses for its type.
 */
export function validateBusinessLicenses(
  type: BusinessType,
  data: { gstNumber?: string | null; fssaiLicense?: string | null }
): { valid: boolean; missing: string[] } {
  const features = BUSINESS_TYPE_FEATURES[type];
  const missing: string[] = [];

  if (features.requiresGst && !data.gstNumber) {
    missing.push('GST Number is required for this business type');
  }
  if (features.requiresFssai && !data.fssaiLicense) {
    missing.push('FSSAI License is required for food businesses');
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Check if a role is allowed to switch between businesses.
 * Only platform admins and client owners can switch.
 */
export function canSwitchBusiness(role: Role): boolean {
  return isPlatformRole(role) || role === 'CLIENT_OWNER';
}
