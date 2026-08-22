// ============================================================================
// Business Provisioning Engine (v1.3.0 - CORRECTED)
// Platform Orchestrator Only - Zero Product Business Logic
// Delegates all product-specific provisioning to Products
// ============================================================================

import { db } from '@/lib/db'
import { getCompleteProductProfile } from '@/lib/product-management'
import { ProductProvisionerRegistry, provisionWithRegistry } from '@/lib/product-provisioner-registry'
import { hashPassword, generateTempPassword } from '@/lib/password-utils'
import { normaliseEmail, mustChangePasswordFor, planOwnerAccount } from '@/lib/owner-account'
import {
  classifyProvisioningFailure, isRetryable, retryDelayMs, MAX_STEP_ATTEMPTS,
  type FailureKind,
} from '@/lib/provisioning-retry'

/** Options threaded into a provisioning run. */
export interface ProvisionOptions {
  // Initial Business Owner password set by the Super Admin during provisioning.
  // If omitted, a temporary password is generated and returned so it can be shared.
  ownerPassword?: string
  // Owner identity as the Super Admin entered it on the Business Creation form.
  // Each falls back to the business record, which is what happened before these
  // existed — the owner's name defaulted to the BUSINESS name, so an entered
  // Owner Name was collected and then silently dropped.
  ownerName?: string
  ownerEmail?: string
  ownerPhone?: string
}

/**
 * What the owner step learned while running, surfaced on the result.
 *
 * The Super Admin has to be told when the password they typed was not applied,
 * or they will hand over a credential that does not work.
 */
export interface OwnerProvisionContext {
  /** Set only when provisioning generated the password (none was supplied). */
  tempPassword?: string
  /** The email already had a platform account; it was reused, not duplicated. */
  linkedExistingUser?: boolean
  /** That account already had a password, so it kept it. */
  ownerPasswordUnchanged?: boolean
  /** That account is globally disabled — the owner cannot sign in until it is enabled. */
  ownerAccountInactive?: boolean
}

export interface ProvisioningStep {
  name: string
  execute: () => Promise<void>
  /**
   * Whether a run that is resuming after a failure may skip this step because
   * it already completed.
   *
   * Every step here is idempotent, so skipping is an optimisation and never a
   * correctness requirement — which is why the default is to run again. The
   * steps that merely read the CURRENT configuration are re-run deliberately:
   * an admin who fixed a plan and pressed Provision again must not be served
   * the allocation computed from the old one. Only the steps that do real,
   * expensive work are skipped.
   */
  skipOnResume?: boolean
}

export interface ProvisioningResult {
  success: boolean
  workspaceId: string
  steps: Array<{
    name: string
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    duration: number
    error?: string
    /** How many times the step ran. >1 means a transient failure was retried. */
    attempts?: number
  }>
  /** How many steps the pipeline has, so a UI can say "step 4 of 10". */
  stepsTotal?: number
  /** Steps skipped because a previous attempt had already completed them. */
  resumedFrom?: string
  error?: string
  /**
   * Whether the failure is worth another attempt. PERMANENT means the run
   * stopped on something a retry cannot fix, and the admin has to act — which
   * is the only case that should show them a Retry button.
   */
  failureKind?: FailureKind
  /** The step that failed, so the UI can point at it. */
  failedStep?: string
  // Set only when provisioning generated a temporary owner password
  // (i.e. the Super Admin did not supply one). Surface it so it can be shared.
  ownerTempPassword?: string
  // The owner email already had a platform account (an owner or member of
  // another business, or a customer). It was reused rather than duplicated.
  ownerLinkedExistingUser?: boolean
  // That account kept the password it already had, so the one entered here was
  // NOT applied. Without this the Super Admin shares a credential that fails.
  ownerPasswordUnchanged?: boolean
  // That account is disabled platform-wide; the owner cannot sign in yet.
  ownerAccountInactive?: boolean
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
export async function provisionBusiness(businessId: string, opts: ProvisionOptions = {}): Promise<ProvisioningResult> {
  const startTime = Date.now()
  const steps: ProvisioningResult['steps'] = []
  // Holder so the owner-account step can report a generated temp password.
  const ownerCtx: OwnerProvisionContext = {}
  let failedStep: string | undefined
  let failureKind: FailureKind | undefined
  let resumedFrom: string | undefined
  let stepsTotal: number | undefined

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

    // Registry-driven workspace host (never hardcoded). Falls back to the
    // conventional <product>.<base> only if the product is unregistered.
    const productRecord = await db.platformProduct.findUnique({
      where: { code: business.productCode },
      select: { workspaceUrl: true },
    })
    const workspaceHost = (productRecord?.workspaceUrl || `${business.productCode.toLowerCase()}.quantixtechnology.in`)
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .split('/')[0]

    // Read BEFORE the row is flipped to IN_PROGRESS below, or the answer is
    // always "no" and resume never engages.
    const wasCompletedBefore = workspace?.provisioningStatus === 'COMPLETED'

    if (!workspace) {
      workspace = await db.platformWorkspace.create({
        data: {
          businessId,
          productCode: business.productCode,
          workspaceUrl: `${workspaceHost}/${businessId}`,
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
    const provisioningSteps = getPlatformProvisioningSteps(businessId, workspace.id, business.productCode, opts, ownerCtx)
    stepsTotal = provisioningSteps.length

    // Resume. A workspace that has never completed and is being provisioned
    // again is recovering from a failure part-way down the list — so the
    // expensive steps it already got through are not done twice. A workspace
    // that HAS completed is being deliberately re-provisioned, and runs whole.
    const alreadyDone = wasCompletedBefore
      ? new Set<string>()
      : await completedStepNames(workspace.id)

    for (const step of provisioningSteps) {
      if (step.skipOnResume && alreadyDone.has(step.name)) {
        resumedFrom ??= step.name
        steps.push({ name: step.name, status: 'SKIPPED', duration: 0, attempts: 0 })
        continue
      }

      const stepStartTime = Date.now()
      let attempts = 0
      // Retry loop. A dropped socket or a momentarily busy database is not a
      // reason to send the admin back to the button — see provisioning-retry.
      for (;;) {
        attempts++
        try {
          await logProvisioningStep(workspace.id, businessId, step.name, 'STARTED')
          await step.execute()
          const duration = Date.now() - stepStartTime
          await logProvisioningStep(workspace.id, businessId, step.name, 'COMPLETED', undefined, duration)
          steps.push({ name: step.name, status: 'COMPLETED', duration, attempts })
          break
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          const retriable = isRetryable(error) && attempts < MAX_STEP_ATTEMPTS
          if (retriable) {
            // Recorded, so the audit log shows the attempt that failed rather
            // than pretending the step went cleanly.
            await logProvisioningStep(workspace.id, businessId, step.name, 'FAILED', `${errorMessage} (attempt ${attempts}, retrying)`, Date.now() - stepStartTime)
            await sleep(retryDelayMs(attempts))
            continue
          }
          const duration = Date.now() - stepStartTime
          await logProvisioningStep(workspace.id, businessId, step.name, 'FAILED', errorMessage, duration)
          steps.push({ name: step.name, status: 'FAILED', duration, error: errorMessage, attempts })
          failedStep = step.name
          failureKind = classifyProvisioningFailure(error)
          throw error
        }
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

    // Advance the business lifecycle to provisioned/live. The lifecycle engine
    // treats any status outside { ONBOARDING, PROVISIONING_FAILED } as
    // provisioned ('active'), so a successful provision must reflect ACTIVE on
    // the business (mirrors the existing failure path that sets
    // PROVISIONING_FAILED). ACTIVE is an existing BusinessStatus value.
    await db.business.update({
      where: { id: businessId },
      data: { status: 'ACTIVE' },
    })

    return {
      success: true,
      workspaceId: workspace.id,
      steps,
      stepsTotal,
      resumedFrom,
      ownerTempPassword: ownerCtx.tempPassword,
      ownerLinkedExistingUser: ownerCtx.linkedExistingUser,
      ownerPasswordUnchanged: ownerCtx.ownerPasswordUnchanged,
      ownerAccountInactive: ownerCtx.ownerAccountInactive,
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
      stepsTotal,
      resumedFrom,
      error: errorMessage,
      failedStep,
      // Classified even when the throw happened before any step ran (a missing
      // business or product), so the UI always knows whether to offer Retry.
      failureKind: failureKind ?? classifyProvisioningFailure(error),
    }
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Step names this workspace has already got through.
 *
 * Read from the audit log rather than tracked on the workspace row, because
 * that log is already written on every attempt — there is nothing new to keep
 * in step. A step that failed and later succeeded appears as both; the
 * COMPLETED row is the one that decides.
 */
async function completedStepNames(workspaceId: string): Promise<Set<string>> {
  const rows = await db.provisioningAuditLog.findMany({
    where: { workspaceId, status: 'COMPLETED' },
    select: { step: true },
  })
  return new Set(rows.map((r) => r.step))
}

/**
 * Get all platform provisioning steps in execution order
 * These are ONLY platform-level steps, not product-specific
 */
function getPlatformProvisioningSteps(businessId: string, workspaceId: string, productCode: string, opts: ProvisionOptions = {}, ownerCtx: OwnerProvisionContext = {}): ProvisioningStep[] {
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
      // Hashing a password and writing two rows; and its own early return
      // already refuses to make a second owner.
      skipOnResume: true,
      execute: async () => createOwnerAccountStep(businessId, opts, ownerCtx),
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
      // The one genuinely expensive step: it hands over to the product, which
      // seeds an entire workspace. Repeating a completed hand-off on every
      // retry is what made re-provisioning feel like starting from scratch.
      skipOnResume: true,
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
async function createOwnerAccountStep(businessId: string, opts: ProvisionOptions = {}, ownerCtx: OwnerProvisionContext = {}) {
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

  // Initial owner password: the Super Admin sets it during provisioning. If none
  // was supplied, generate a temporary one (surfaced via the provisioning result).
  let rawPassword = opts.ownerPassword
  const adminChosePassword = !!rawPassword
  if (!rawPassword) {
    rawPassword = generateTempPassword()
    ownerCtx.tempPassword = rawPassword
  }
  const passwordHash = await hashPassword(rawPassword)

  // Owner identity as entered by the Super Admin, falling back to the business
  // record. Email is normalised because login matches it lowercased.
  const ownerEmail = normaliseEmail(opts.ownerEmail || business.contactEmail)
  const ownerName = opts.ownerName?.trim() || business.name
  const ownerPhone = opts.ownerPhone?.trim() || business.contactPhone || ''

  // One person, several businesses — which is exactly what the schema models:
  //
  //     User (email globally unique) → BusinessUser @@unique([userId, businessId]) → Business
  //
  // So an address that already has an account is not a collision. It is the
  // same person being given another workspace, and the membership row is what
  // separates the two. Refusing it made a real email permanently unusable for
  // every future tenant, which is the opposite of multi-tenant.
  //
  // A SECOND user row for the same address is what would break login (the
  // lookup resolves loginId first, then email, and would be ambiguous) — and
  // the unique constraint forbids it anyway. Reusing the row is what keeps
  // that guarantee, not throwing.
  const existing = await db.user.findFirst({
    where: { OR: [{ email: ownerEmail }, { loginId: ownerEmail }] },
    select: { id: true, passwordHash: true, isActive: true },
  })

  // The rule itself lives in owner-account.ts, as a decision over the existing
  // row — separate from the writes below, so it can be tested for what it
  // decides.
  const plan = planOwnerAccount(existing)
  let ownerUserId: string

  if (plan.action === 'REUSE_USER') {
    ownerUserId = plan.userId
    ownerCtx.linkedExistingUser = true

    if (plan.setPassword) {
      await db.user.update({
        where: { id: plan.userId },
        data: {
          passwordHash,
          hasPassword: true,
          authProvider: 'PASSWORD',
          mustChangePassword: mustChangePasswordFor(adminChosePassword ? 'ADMIN_SET' : 'GENERATED'),
          passwordChangedAt: new Date(),
        },
      })
    }
    if (plan.passwordUnchanged) {
      // Their existing password still applies. Say so — and drop the generated
      // one, because reporting a password that was never written would send
      // the Super Admin off to share a credential that does not work.
      ownerCtx.ownerPasswordUnchanged = true
      ownerCtx.tempPassword = undefined
    }
    // Deliberately NOT reactivated here: a globally disabled account was
    // disabled for a reason that has nothing to do with this business. Flag it
    // so provisioning does not report an owner who cannot sign in.
    if (plan.inactive) ownerCtx.ownerAccountInactive = true
  } else {
    // Create owner user account
    // Use unique loginId based on email + business ID to avoid collisions
    const loginId = `${business.slug}-owner-${business.id.substring(0, 8)}`

    const ownerUser = await db.user.create({
      data: {
        email: ownerEmail,
        loginId,
        name: ownerName,
        phone: ownerPhone,
        isActive: true,
        authProvider: 'PASSWORD',
        passwordHash,
        hasPassword: true,
        // A password the Super Admin typed is a real credential they will hand
        // over, not a temporary one — forcing a rotation would defeat "the owner
        // can log in with the configured password". A generated one still must
        // be changed on first login.
        mustChangePassword: mustChangePasswordFor(adminChosePassword ? 'ADMIN_SET' : 'GENERATED'),
        emailVerified: true, // owner identity verified by the Super Admin
        createdBy: 'PROVISIONING',
      },
    })
    ownerUserId = ownerUser.id
  }

  // Link user to business as owner.
  //
  // upsert, because the same person may already be in THIS business in another
  // capacity — staff who is now being made the owner. @@unique([userId,
  // businessId]) would refuse a second row, so the choice is to promote in
  // place or to fail; promoting is what the Super Admin asked for, and it is
  // scoped to this business alone. Their membership of every other business is
  // a different row and is not touched.
  await db.businessUser.upsert({
    where: { userId_businessId: { userId: ownerUserId, businessId } },
    update: { role: 'CLIENT_OWNER', isActive: true },
    create: {
      businessId,
      userId: ownerUserId,
      role: 'CLIENT_OWNER',
      isActive: true,
    },
  })
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

  // Effective storage = Business Override ?? Plan Default.
  // Per-business override lives in settings.resourceOverrides.storageGB (Phase 7),
  // stored in the same GB convention the Review UI uses (GB = storageQuotaMB / 1024 / 1024),
  // so convert back to the plan's storageQuotaMB unit before allocating.
  let effectiveStorageMB = plan.storageQuotaMB
  try {
    const settings = business.settings ? JSON.parse(business.settings) : {}
    const overrideStorageGB = settings?.resourceOverrides?.storageGB
    if (typeof overrideStorageGB === 'number' && overrideStorageGB >= 1) {
      effectiveStorageMB = overrideStorageGB * 1024 * 1024
    }
  } catch {
    // Malformed settings JSON — fall back to plan default.
  }

  // NOTE: Users (plan.userLimit) and Stores/Branches (plan.branchLimit) overrides
  // are persisted on the business but are NOT consumed anywhere in provisioning
  // yet (ProductProvisioningConfig carries no resource limits). They remain
  // FUTURE INTEGRATION POINTS and are intentionally left untouched here.

  // Update workspace with storage allocation
  await db.platformWorkspace.update({
    where: { id: workspaceId },
    data: {
      storageAllocatedMB: effectiveStorageMB,
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
      code: r.name,
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
