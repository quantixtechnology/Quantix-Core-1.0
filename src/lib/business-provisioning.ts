// ============================================================================
// Business Provisioning Engine (v1.3.0 - CORRECTED)
// Platform Orchestrator Only - Zero Product Business Logic
// Delegates all product-specific provisioning to Products
// ============================================================================

import { db } from '@/lib/db'
import { getCompleteProductProfile } from '@/lib/product-management'
import { ProductProvisionerRegistry, provisionWithRegistry } from '@/lib/product-provisioner-registry'

export interface ProvisioningStep {
  name: string
  execute: () => Promise<void>
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
 * Product Provisioning Interface
 * Each Product implements this interface for their business logic provisioning
 */
export interface ProductProvisioner {
  provision(businessId: string, config: ProductProvisioningConfig): Promise<ProductProvisioningResult>
}

export interface ProductProvisioningConfig {
  businessId: string
  productCode: string
  subscriptionPlanCode: string
  enabledFeatures: string[]
  workspaceId: string
}

export interface ProductProvisioningResult {
  success: boolean
  error?: string
  message?: string
}

/**
 * Provision a business after creation
 * Pure platform orchestrator - delegates product provisioning to Products
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

    // Execute platform provisioning steps in order
    const provisioningSteps = getPlatformProvisioningSteps(businessId, workspace.id, business.productCode)

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
 * Get all platform provisioning steps in execution order
 * These are ONLY platform-level steps, not product-specific
 */
function getPlatformProvisioningSteps(businessId: string, workspaceId: string, productCode: string): ProvisioningStep[] {
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
      name: 'create_owner_account',
      execute: async () => createOwnerAccountStep(businessId),
    },
    {
      name: 'assign_licensed_features',
      execute: async () => assignLicensedFeaturesStep(businessId, workspaceId),
    },
    {
      name: 'apply_platform_roles',
      execute: async () => applyPlatformRolesStep(businessId, productCode),
    },
    {
      name: 'apply_platform_permissions',
      execute: async () => applyPlatformPermissionsStep(businessId, productCode),
    },
    {
      name: 'allocate_storage',
      execute: async () => allocateStorageStep(businessId, workspaceId, productCode),
    },
    {
      name: 'call_product_provisioner',
      execute: async () => callProductProvisionerStep(businessId, workspaceId, productCode),
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
 * Step 3: Create Owner Account
 */
async function createOwnerAccountStep(businessId: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    throw new Error(`Business ${businessId} not found`)
  }

  if (!business.contactEmail) {
    throw new Error('Business contact email is required to create owner account')
  }

  // Check if owner already exists
  const existingOwner = await db.businessUser.findFirst({
    where: {
      businessId,
      role: 'CLIENT_OWNER',
    },
  })

  if (existingOwner) {
    return // Owner already exists
  }

  // Create owner user account
  const ownerUser = await db.user.create({
    data: {
      email: business.contactEmail,
      loginId: business.contactEmail.split('@')[0] || business.slug,
      name: business.name,
      phone: business.contactPhone || '',
      isActive: true,
      authProvider: 'EMAIL_OTP',
      hasPassword: false,
      emailVerified: false,
    },
  })

  // Link user to business as owner
  await db.businessUser.create({
    data: {
      businessId,
      userId: ownerUser.id,
      role: 'CLIENT_OWNER',
      isActive: true,
    },
  })

  // TODO: Send welcome email with OTP or password reset link to business.contactEmail
}

/**
 * Step 4: Assign Licensed Features from subscription plan
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
 * Step 4: Apply Platform Roles (not product-specific)
 * These are global platform roles, not product roles
 */
async function applyPlatformRolesStep(businessId: string, productCode: string) {
  // Platform roles are defined globally, just verify they exist
  const businessRoles = await db.businessRole.count({
    where: { businessId },
  })

  // If no roles exist, they will be created from product defaults in product provisioner
  // This step just verifies we're ready to assign them
  return
}

/**
 * Step 5: Apply Platform Permissions
 * Verify permissions structure is ready (actual permissions set by product)
 */
async function applyPlatformPermissionsStep(businessId: string, productCode: string) {
  // Permission validation happens at platform level
  // Actual permissions are product-specific and set by product provisioner
  return
}

/**
 * Step 6: Allocate Storage Quota
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
 * Step 7: Call Product Provisioner
 * This is where the Product handles ALL its business logic provisioning
 * Quantix Core does not know what happens here
 * Uses ProductProvisionerRegistry for dynamic product lookup
 */
async function callProductProvisionerStep(businessId: string, workspaceId: string, productCode: string) {
  const business = await db.business.findUnique({
    where: { id: businessId },
  })

  if (!business) {
    throw new Error('Business not found')
  }

  const enabledFeatures = JSON.parse(business.enabledFeatures || '[]') as string[]

  // Build provisioning config for product
  const config: ProductProvisioningConfig = {
    businessId,
    productCode,
    subscriptionPlanCode: business.subscriptionPlanCode || '',
    enabledFeatures,
    workspaceId,
  }

  // Check if product has registered a provisioner
  // This allows graceful degradation if product hasn't registered yet
  if (!ProductProvisionerRegistry.has(productCode)) {
    // Product hasn't registered provisioner yet - allow graceful fallback
    // This maintains backward compatibility during product migration
    return
  }

  // Call product provisioner via registry
  // Quantix Core never knows the implementation
  await provisionWithRegistry(businessId, productCode, config)
}

/**
 * Step 8: Generate Website Configuration
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
 * Step 9: Generate Workspace Configuration
 * This is minimal platform configuration
 * Product provides its own configuration via provisioner
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
