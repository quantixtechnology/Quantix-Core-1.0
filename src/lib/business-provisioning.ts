// ============================================================================
// Business Provisioning Engine (v1.3.0)
// Handles automated provisioning of businesses after creation
// Idempotent, retry-safe, fully auditable
// ============================================================================

import { db } from '@/lib/db'
import { getCompleteProductProfile } from '@/lib/product-management'
import { getBusinessProductProfile } from '@/lib/business-product-assignment'
import { provisionCommerceResources } from '@/lib/provisioning/commerce-provisioning'
import { provisionLaundryResources } from '@/lib/provisioning/laundry-provisioning'
import { provisionCarWashResources } from '@/lib/provisioning/carwash-provisioning'

export interface ProvisioningStep {
  name: string
  execute: () => Promise<void>
  isIdempotent?: boolean
}

export interface ProvisioningResult {
  success: boolean
  workspaceId: string
  steps: Array<{
    name: string
    status: 'COMPLETED' | 'FAILED'
    duration: number
    error?: string
  }>
  error?: string
}

/**
 * Provision a business after creation
 * This is called automatically after Business is created with product assignment
 * All steps are idempotent and retry-safe
 */
export async function provisionBusiness(businessId: string): Promise<ProvisioningResult> {
  const startTime = Date.now()
  const steps: ProvisioningResult['steps'] = []

  try {
    // Get business and product information
    const business = await db.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      throw new Error(`Business ${businessId} not found`)
    }

    if (!business.productCode) {
      throw new Error(`Business ${businessId} has no product assignment`)
    }

    // Create or get workspace
    let workspace = await db.platformWorkspace.findUnique({
      where: {
        businessId_productCode: {
          businessId,
          productCode: business.productCode,
        },
      },
    })

    if (!workspace) {
      workspace = await db.platformWorkspace.create({
        data: {
          businessId,
          productCode: business.productCode,
          workspaceUrl: `${business.productCode.toLowerCase()}.quantixtechnology.in/${businessId}`,
          status: 'PROVISIONING',
          provisioningStatus: 'IN_PROGRESS',
          provisioningStartedAt: new Date(),
          subscriptionPlan: business.subscriptionPlanCode,
        },
      })
    } else {
      // If workspace exists but provisioning failed before, retry
      await db.platformWorkspace.update({
        where: { id: workspace.id },
        data: {
          provisioningStatus: 'IN_PROGRESS',
          provisioningStartedAt: new Date(),
          provisioningError: null,
        },
      })
    }

    // Execute provisioning steps in order
    const provisioningSteps = getProvisioningSteps(businessId, workspace.id, business.productCode)

    for (const step of provisioningSteps) {
      const stepStartTime = Date.now()
      try {
        await logProvisioningStep(workspace.id, businessId, step.name, 'STARTED')
        await step.execute()
        const duration = Date.now() - stepStartTime
        await logProvisioningStep(workspace.id, businessId, step.name, 'COMPLETED', undefined, duration)
        steps.push({
          name: step.name,
          status: 'COMPLETED',
          duration,
        })
      } catch (error) {
        const duration = Date.now() - stepStartTime
        const errorMessage = error instanceof Error ? error.message : String(error)
        await logProvisioningStep(workspace.id, businessId, step.name, 'FAILED', errorMessage, duration)
        steps.push({
          name: step.name,
          status: 'FAILED',
          duration,
          error: errorMessage,
        })
        throw error
      }
    }

    // Mark provisioning as complete
    await db.platformWorkspace.update({
      where: { id: workspace.id },
      data: {
        status: 'READY',
        provisioningStatus: 'COMPLETED',
        provisioningCompletedAt: new Date(),
      },
    })

    return {
      success: true,
      workspaceId: workspace.id,
      steps,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Find workspace and mark as failed
    const workspace = await db.platformWorkspace.findFirst({
      where: { businessId },
    })

    if (workspace) {
      await db.platformWorkspace.update({
        where: { id: workspace.id },
        data: {
          status: 'Failed',
          provisioningStatus: 'FAILED',
          provisioningError: errorMessage,
        },
      })
    }

    // Update business status
    await db.business.update({
      where: { id: businessId },
      data: {
        status: 'PROVISIONING_FAILED',
      },
    })

    return {
      success: false,
      workspaceId: workspace?.id || '',
      steps,
      error: errorMessage,
    }
  }
}

/**
 * Get all provisioning steps in execution order
 */
function getProvisioningSteps(businessId: string, workspaceId: string, productCode: string): ProvisioningStep[] {
  return [
    {
      name: 'validate_product',
      execute: async () => validateProductStep(productCode),
    },
    {
      name: 'validate_subscription_plan',
      execute: async () => validateSubscriptionPlanStep(businessId, productCode),
    },
    {
      name: 'assign_licensed_features',
      execute: async () => assignLicensedFeaturesStep(businessId, workspaceId),
    },
    {
      name: 'apply_product_defaults',
      execute: async () => applyProductDefaultsStep(businessId, productCode),
    },
    {
      name: 'apply_default_roles',
      execute: async () => applyDefaultRolesStep(businessId, productCode),
    },
    {
      name: 'apply_default_permissions',
      execute: async () => applyDefaultPermissionsStep(businessId, productCode),
    },
    {
      name: 'allocate_storage',
      execute: async () => allocateStorageStep(businessId, workspaceId, productCode),
    },
    {
      name: 'provision_product_resources',
      execute: async () => provisionProductResourcesStep(businessId, productCode),
    },
    {
      name: 'generate_website_config',
      execute: async () => generateWebsiteConfigStep(businessId, workspaceId),
    },
    {
      name: 'generate_workspace_config',
      execute: async () => generateWorkspaceConfigStep(businessId, workspaceId),
    },
  ]
}

/**
 * Step 1: Validate Product exists and is active
 */
async function validateProductStep(productCode: string) {
  const product = await db.platformProduct.findUnique({
    where: { code: productCode },
  })

  if (!product) {
    throw new Error(`Product ${productCode} not found`)
  }

  if (product.status !== 'ACTIVE' || !product.isEnabled) {
    throw new Error(`Product ${productCode} is not active`)
  }
}

/**
 * Step 2: Validate Subscription Plan exists
 */
async function validateSubscriptionPlanStep(businessId: string, productCode: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business?.subscriptionPlanCode) {
    throw new Error('Subscription plan not assigned to business')
  }

  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode,
        code: business.subscriptionPlanCode,
      },
    },
  })

  if (!plan) {
    throw new Error(`Plan ${business.subscriptionPlanCode} not found for product ${productCode}`)
  }
}

/**
 * Step 3: Assign Licensed Features from subscription plan
 */
async function assignLicensedFeaturesStep(businessId: string, workspaceId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business?.productCode || !business.subscriptionPlanCode) {
    throw new Error('Business product assignment incomplete')
  }

  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode: business.productCode,
        code: business.subscriptionPlanCode,
      },
    },
  })

  if (!plan) {
    throw new Error('Subscription plan not found')
  }

  // Features are already assigned to business in v1.2.0, just verify
  const enabledFeatures = JSON.parse(business.enabledFeatures || '[]') as string[]
  if (enabledFeatures.length === 0) {
    throw new Error('No features assigned from subscription plan')
  }
}

/**
 * Step 4: Apply Product Default Settings to Business
 */
async function applyProductDefaultsStep(businessId: string, productCode: string) {
  const defaults = await db.productDefaultSettings.findUnique({
    where: { productCode },
  })

  if (!defaults) {
    // No defaults defined, skip
    return
  }

  // Apply defaults to business if not already set
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  const updates: Record<string, any> = {}

  // Only apply defaults if not already configured
  if (!business?.defaultCurrency || business.defaultCurrency === 'INR') {
    updates.defaultCurrency = defaults.defaultCurrency
  }

  if (!business?.timezone || business.timezone === 'Asia/Kolkata') {
    updates.timezone = defaults.defaultTimezone
  }

  if (!business?.defaultLocale) {
    updates.defaultLocale = defaults.defaultLanguage
  }

  if (Object.keys(updates).length > 0) {
    await db.business.update({
      where: { id: businessId },
      data: updates,
    })
  }
}

/**
 * Step 5: Apply Default Roles
 * This creates the default roles for the business from product templates
 */
async function applyDefaultRolesStep(businessId: string, productCode: string) {
  const product = await getCompleteProductProfile(productCode)
  if (!product?.catalog?.roles) {
    return
  }

  // For each product role, create a corresponding business role
  for (const productRole of product.catalog.roles) {
    // Check if role already exists
    const existing = await db.businessRole.findFirst({
      where: {
        businessId,
        name: productRole.name,
      },
    })

    if (!existing) {
      await db.businessRole.create({
        data: {
          businessId,
          name: productRole.name,
          code: productRole.code,
          description: `Default ${productRole.name} role from ${productCode}`,
          permissions: JSON.stringify(productRole.permissions || []),
        },
      })
    }
  }
}

/**
 * Step 6: Apply Default Permissions
 * This is done at the role level in step 5, verify permissions exist
 */
async function applyDefaultPermissionsStep(businessId: string, productCode: string) {
  const roles = await db.businessRole.findMany({
    where: { businessId },
  })

  // Verify at least one role has permissions
  for (const role of roles) {
    const permissions = JSON.parse(role.permissions || '[]')
    if (permissions.length === 0) {
      throw new Error(`Role ${role.name} has no permissions`)
    }
  }
}

/**
 * Step 7: Allocate Storage Quota
 */
async function allocateStorageStep(businessId: string, workspaceId: string, productCode: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business?.subscriptionPlanCode) {
    throw new Error('Subscription plan not found')
  }

  const plan = await db.productPlan.findUnique({
    where: {
      productCode_code: {
        productCode,
        code: business.subscriptionPlanCode,
      },
    },
  })

  if (!plan) {
    throw new Error('Plan not found for storage allocation')
  }

  // Update workspace with storage allocation
  await db.platformWorkspace.update({
    where: { id: workspaceId },
    data: {
      storageAllocatedMB: plan.storageQuotaMB,
    },
  })
}

/**
 * Step 8: Provision Product-Specific Resources
 * Different products provision different defaults
 */
async function provisionProductResourcesStep(businessId: string, productCode: string) {
  switch (productCode) {
    case 'COMMERCE':
      await provisionCommerceResources(businessId)
      break
    case 'LAUNDRY':
      await provisionLaundryResources(businessId)
      break
    case 'CARWASH':
      await provisionCarWashResources(businessId)
      break
    default:
      throw new Error(`Unknown product ${productCode}`)
  }
}

/**
 * Step 9: Generate Website Configuration
 */
async function generateWebsiteConfigStep(businessId: string, workspaceId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    throw new Error('Business not found')
  }

  const websiteConfig = {
    domain: business.slug ? `${business.slug}.quantixtechnology.in` : null,
    ssl: true,
    branding: {
      logo: business.logo,
      favicon: business.favicon,
      primaryColor: business.primaryColor,
      secondaryColor: business.secondaryColor,
    },
    status: 'PENDING',
    createdAt: new Date(),
  }

  await db.platformWorkspace.update({
    where: { id: workspaceId },
    data: {
      websiteConfig: JSON.stringify(websiteConfig),
    },
  })
}

/**
 * Step 10: Generate Workspace Configuration
 */
async function generateWorkspaceConfigStep(businessId: string, workspaceId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    throw new Error('Business not found')
  }

  const enabledFeatures = JSON.parse(business.enabledFeatures || '[]') as string[]
  const roles = await db.businessRole.findMany({
    where: { businessId },
  })

  const workspaceConfig = {
    businessId,
    businessName: business.name,
    productCode: business.productCode,
    productVersion: business.productVersion,
    subscriptionPlan: business.subscriptionPlanCode,
    enabledFeatures,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      permissions: JSON.parse(r.permissions || '[]'),
    })),
    settings: JSON.parse(business.settings || '{}'),
    localization: {
      currency: business.defaultCurrency,
      timezone: business.timezone,
      locale: business.defaultLocale,
    },
    createdAt: new Date(),
  }

  await db.platformWorkspace.update({
    where: { id: workspaceId },
    data: {
      workspaceConfig: JSON.stringify(workspaceConfig),
      featuresEnabled: enabledFeatures.length,
    },
  })
}

/**
 * Log provisioning step execution
 */
async function logProvisioningStep(
  workspaceId: string,
  businessId: string,
  step: string,
  status: 'STARTED' | 'COMPLETED' | 'FAILED',
  error?: string,
  duration?: number
) {
  await db.provisioningAuditLog.create({
    data: {
      workspaceId,
      businessId,
      step,
      status,
      error,
      completedAt: status !== 'STARTED' ? new Date() : undefined,
      duration,
    },
  })
}

/**
 * Get provisioning status for a business
 */
export async function getProvisioningStatus(businessId: string) {
  const workspace = await db.platformWorkspace.findFirst({
    where: { businessId },
  })

  if (!workspace) {
    return null
  }

  const audits = await db.provisioningAuditLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'asc' },
  })

  return {
    workspaceId: workspace.id,
    status: workspace.provisioningStatus,
    error: workspace.provisioningError,
    startedAt: workspace.provisioningStartedAt,
    completedAt: workspace.provisioningCompletedAt,
    steps: audits.map((a) => ({
      name: a.step,
      status: a.status,
      duration: a.duration,
      error: a.error,
    })),
  }
}
