// ============================================================================
// Business → Product Assignment
// Handles linking businesses to products during creation
// ============================================================================

import { db } from '@/lib/db'
import { getCompleteProductProfile } from '@/lib/product-management'
import { getProductFeatures } from '@/lib/product-features'

export interface BusinessProductAssignment {
  businessId: string
  productCode: string
  subscriptionPlanCode: string
  enabledFeatures: string[]
}

/**
 * Assign a product to a business during creation
 * Stores product code, version, plan, and enabled features
 * Does NOT modify product data - only references it
 */
export async function assignProductToBusiness(
  businessId: string,
  productCode: string,
  subscriptionPlanCode: string
) {
  // Verify product exists
  const product = await db.platformProduct.findUnique({
    where: { code: productCode },
  })

  if (!product) {
    throw new Error(`Product ${productCode} not found`)
  }

  // Verify subscription plan exists
  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode,
        code: subscriptionPlanCode,
      },
    },
  })

  if (!plan) {
    throw new Error(`Subscription plan ${subscriptionPlanCode} not found for product ${productCode}`)
  }

  // Get enabled features from the plan
  const includedFeatures = JSON.parse(plan.includedFeatures) as string[]

  // Update business with product assignment
  const updated = await db.business.update({
    where: { id: businessId },
    data: {
      productCode,
      productVersion: product.currentVersion,
      subscriptionPlanCode,
      enabledFeatures: JSON.stringify(includedFeatures),
    },
  })

  return updated
}

/**
 * Get the product profile for a business
 * Combines business-assigned product with template data
 */
export async function getBusinessProductProfile(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business || !business.productCode) {
    return null
  }

  const product = await getCompleteProductProfile(business.productCode)
  if (!product) {
    return null
  }

  return {
    business: {
      id: business.id,
      name: business.name,
      productCode: business.productCode,
      productVersion: business.productVersion,
      subscriptionPlanCode: business.subscriptionPlanCode,
      enabledFeatures: JSON.parse(business.enabledFeatures) as string[],
    },
    product: {
      name: product.name,
      version: product.currentVersion,
      storage: product.defaultStorageQuotaMB,
      plan: product.plans.find((p) => p.code === business.subscriptionPlanCode),
      features: product.catalog?.features || [],
      roles: product.catalog?.roles || [],
    },
  }
}

/**
 * Get available products for business creation
 * Returns only active products
 */
export async function getAvailableProductsForCreation() {
  const products = await db.platformProduct.findMany({
    where: {
      status: 'ACTIVE',
      isEnabled: true,
    },
    orderBy: { name: 'asc' },
  })

  return Promise.all(
    products.map(async (product) => {
      const profile = await getCompleteProductProfile(product.code)
      return {
        code: product.code,
        name: product.name,
        description: product.description,
        version: product.currentVersion,
        storage: product.defaultStorageQuotaMB,
        plans: profile?.plans || [],
      }
    })
  )
}

/**
 * Validate product assignment
 * Ensures product, plan, and features are consistent
 */
export async function validateProductAssignment(
  productCode: string,
  subscriptionPlanCode: string,
  requestedFeatures?: string[]
): Promise<{ valid: boolean; error?: string }> {
  const product = await db.platformProduct.findUnique({
    where: { code: productCode },
  })

  if (!product) {
    return { valid: false, error: `Product ${productCode} not found` }
  }

  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode,
        code: subscriptionPlanCode,
      },
    },
  })

  if (!plan) {
    return { valid: false, error: `Plan ${subscriptionPlanCode} not found for product ${productCode}` }
  }

  // If specific features are requested, validate they're included in the plan
  if (requestedFeatures && requestedFeatures.length > 0) {
    const planFeatures = JSON.parse(plan.includedFeatures) as string[]
    const invalidFeatures = requestedFeatures.filter((f) => !planFeatures.includes(f))

    if (invalidFeatures.length > 0) {
      return {
        valid: false,
        error: `Features ${invalidFeatures.join(', ')} not included in plan ${subscriptionPlanCode}`,
      }
    }
  }

  return { valid: true }
}
