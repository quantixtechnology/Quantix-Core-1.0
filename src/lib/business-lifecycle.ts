// ============================================================================
// Business Lifecycle Management
// Determines business state and available actions.
//
// SCHEMA ALIGNMENT (v1.5.3):
// Every state below is derived ONLY from fields that exist on the Business
// model in prisma/schema.prisma:
//   - business.productCode          (String?)  — assigned product
//   - business.subscriptionPlanCode (String?)  — assigned plan
//   - business.status               (BusinessStatus enum)
//
// There is NO `workspaceId` field and NO `platformWorkspace` relation on
// Business. Workspace/provisioning detail lives on the separate
// PlatformWorkspace model (keyed by businessId, with its own status /
// provisioningStatus) and is NOT a Business relation — so this pure function
// must not reference it. Provisioning completion is reflected back onto the
// Business via its `status` transition (ONBOARDING → ACTIVE/TRIAL, or
// PROVISIONING_FAILED on failure).
// ============================================================================

export type BusinessLifecycleState =
  | 'draft' // no product assigned yet
  | 'needs_plan' // product assigned, plan not yet selected
  | 'ready_to_provision' // product + plan assigned, not yet provisioned/live
  | 'active' // provisioned and live (workspace exists)

export interface BusinessLifecycle {
  state: BusinessLifecycleState
  isComplete: boolean
  nextStep: string | null
  canEdit: boolean
  canAssignProduct: boolean
  canAssignPlan: boolean
  canProvision: boolean
  canOpenWorkspace: boolean
}

// Business.status values that mean the business has NOT yet been provisioned.
// Everything else (ACTIVE, TRIAL, INACTIVE, SUSPENDED, EXPIRED, CHURNED) means
// provisioning has already happened and a workspace exists.
const PRE_PROVISION_STATUSES = new Set(['ONBOARDING', 'PROVISIONING_FAILED'])

/**
 * Determine business lifecycle state from real Business fields.
 * @param business A Business record (needs productCode, subscriptionPlanCode, status)
 */
export function getBusinessLifecycle(business: {
  productCode?: string | null
  subscriptionPlanCode?: string | null
  status?: string | null
}): BusinessLifecycle {
  const hasProduct = !!business.productCode
  const hasPlan = !!business.subscriptionPlanCode
  const status = business.status || 'ONBOARDING'
  // "Provisioned" = product + plan assigned AND the business has moved past the
  // pre-provision statuses. This is the only schema-real signal for a workspace.
  const isProvisioned = hasProduct && hasPlan && !PRE_PROVISION_STATUSES.has(status)

  let state: BusinessLifecycleState
  let nextStep: string | null
  let isComplete = false

  if (!hasProduct) {
    state = 'draft'
    nextStep = 'product'
  } else if (!hasPlan) {
    state = 'needs_plan'
    nextStep = 'plan'
  } else if (!isProvisioned) {
    state = 'ready_to_provision'
    nextStep = 'provisioning'
  } else {
    state = 'active'
    nextStep = null
    isComplete = true
  }

  return {
    state,
    isComplete,
    nextStep,
    canEdit: true, // Always allow edit
    canAssignProduct: !hasProduct,
    canAssignPlan: hasProduct && !hasPlan,
    canProvision: hasProduct && hasPlan && !isProvisioned,
    canOpenWorkspace: isProvisioned,
  }
}

/**
 * Get user-friendly label for lifecycle state
 */
export function getStateLabel(state: BusinessLifecycleState): string {
  const labels: Record<BusinessLifecycleState, string> = {
    draft: 'Draft',
    needs_plan: 'Needs Plan',
    ready_to_provision: 'Ready to Provision',
    active: 'Active',
  }
  return labels[state]
}

/**
 * Determine which step of the onboarding wizard to resume from.
 * Derived purely from product/plan assignment (both real Business fields).
 */
export function getResumeStep(business: {
  productCode?: string | null
  subscriptionPlanCode?: string | null
}): 'product' | 'plan' | 'review' | null {
  const hasProduct = !!business.productCode
  const hasPlan = !!business.subscriptionPlanCode

  if (!hasProduct) return 'product'
  if (!hasPlan) return 'plan'
  return 'review'
}
