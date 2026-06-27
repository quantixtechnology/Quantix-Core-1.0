// ============================================================================
// Business Lifecycle Management
// Determines business state and available actions
// ============================================================================

export type BusinessLifecycleState =
  | 'draft'
  | 'needs_product'
  | 'needs_plan'
  | 'ready_to_provision'
  | 'provisioning'
  | 'workspace_ready'
  | 'active'

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

/**
 * Determine business lifecycle state based on completion
 */
export function getBusinessLifecycle(business: any): BusinessLifecycle {
  const hasProduct = !!business.productCode
  const hasPlan = !!business.subscriptionPlanCode
  const hasWorkspace = !!business.workspaceId
  const workspaceReady = business.platformWorkspace?.status === 'READY'

  // Determine state
  let state: BusinessLifecycleState = 'draft'
  let nextStep: string | null = 'product'
  let isComplete = false

  if (!hasProduct) {
    state = 'draft'
    nextStep = 'product'
  } else if (!hasPlan) {
    state = 'needs_plan'
    nextStep = 'plan'
  } else if (!hasWorkspace) {
    state = 'ready_to_provision'
    nextStep = 'provisioning'
  } else if (!workspaceReady) {
    state = 'provisioning'
    nextStep = null
  } else if (workspaceReady) {
    state = 'workspace_ready'
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
    canProvision: hasProduct && hasPlan && !hasWorkspace,
    canOpenWorkspace: workspaceReady,
  }
}

/**
 * Get user-friendly label for lifecycle state
 */
export function getStateLabel(state: BusinessLifecycleState): string {
  const labels: Record<BusinessLifecycleState, string> = {
    draft: 'Draft',
    needs_product: 'Needs Product',
    needs_plan: 'Needs Plan',
    ready_to_provision: 'Ready to Provision',
    provisioning: 'Provisioning',
    workspace_ready: 'Workspace Ready',
    active: 'Active',
  }
  return labels[state]
}

/**
 * Determine which step of wizard to start from
 */
export function getResumeStep(business: any): 'product' | 'plan' | 'review' | null {
  const hasProduct = !!business.productCode
  const hasPlan = !!business.subscriptionPlanCode

  if (!hasProduct) return 'product'
  if (!hasPlan) return 'plan'
  if (hasProduct && hasPlan) return 'review'
  return null
}
