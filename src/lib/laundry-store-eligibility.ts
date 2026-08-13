// Which laundry stores a CUSTOMER may be routed to.
//
// A Processing Center is an internal operations location. It has coordinates
// and it is active, so every distance calculation happily returned it as the
// "nearest store" — a customer could be told their nearest branch is a
// building they can never visit, and an order could be filed against it.
//
// The rule uses the EXISTING LaundryStore.storeType. No new field, no
// isCustomerFacing flag:
//
//   RETAIL_STORE      ✅ customer-facing
//   BOTH              ✅ customer-facing (retail + processing)
//   PROCESSING_CENTER ❌ internal only
//
// This is the ONE definition. Customer-facing store selection imports it
// instead of writing its own filter, so a Processing Center cannot leak in
// through a flow that forgot. INTERNAL screens must NOT use it — Processing
// Centers remain fully visible and usable everywhere in Laundry OS.

/** Values stored in LaundryStore.storeType (a plain String column). */
export const STORE_TYPE_RETAIL = "RETAIL_STORE"
export const STORE_TYPE_PROCESSING = "PROCESSING_CENTER"
export const STORE_TYPE_BOTH = "BOTH"

/** The types a customer may be routed to. */
export const CUSTOMER_FACING_STORE_TYPES = [STORE_TYPE_RETAIL, STORE_TYPE_BOTH] as const

/**
 * Prisma `where` fragment for customer-facing stores.
 *
 * Two conditions, both required:
 *   • not a PROCESSING_CENTER — that is an internal location
 *   • operationally complete — a retail-only store must know where its
 *     garments are processed. A BOTH store processes its own, so it needs no
 *     assignment and always qualifies.
 *
 * "not PROCESSING_CENTER" rather than "in [RETAIL, BOTH]" on purpose: the
 * column is a free String with a RETAIL_STORE default, so an unrecognised
 * legacy value is treated as retail rather than silently vanishing.
 */
export const customerFacingStoreWhere = {
  storeType: { not: STORE_TYPE_PROCESSING },
  OR: [
    { storeType: STORE_TYPE_BOTH },
    { processingCenterStoreId: { not: null } },
  ] as { storeType?: string; processingCenterStoreId?: { not: null } }[],
}

/** Same rule, for filtering rows already in memory. */
export function isCustomerFacingStore(store: { storeType?: string | null; processingCenterStoreId?: string | null }): boolean {
  if (store.storeType === STORE_TYPE_PROCESSING) return false
  // A self-processing location is complete by definition.
  if (store.storeType === STORE_TYPE_BOTH) return true
  return !!store.processingCenterStoreId
}

// ============================================================================
// Store → Processing Center assignment
//
// Every ACTIVE retail store must name the location that processes its
// garments. Different areas legitimately use different centres, so this is a
// PER-STORE administrative decision — never inferred from distance. Once Store
// A is assigned to PC-A, PC-A is the source of truth even if PC-B is closer.
// ============================================================================

/** Can this location process garments? */
export function isProcessingCapable(store: { storeType?: string | null; isActive?: boolean }): boolean {
  if (store.isActive === false) return false
  return store.storeType === STORE_TYPE_PROCESSING || store.storeType === STORE_TYPE_BOTH
}

/**
 * Does this store need to name ANOTHER location as its processing centre?
 *
 * Only a retail-only store does. A BOTH location processes its own workload
 * and a PROCESSING_CENTER is one — requiring them to point at a third party
 * would be complexity with no operational meaning.
 */
export function requiresProcessingCenterAssignment(storeType?: string | null): boolean {
  return storeType !== STORE_TYPE_PROCESSING && storeType !== STORE_TYPE_BOTH
}

export const NO_PROCESSING_CENTER =
  "Every Retail Store must be assigned to a Processing Center before it can become active. This determines where garments from this store will be processed."
export const PROCESSING_CENTER_NOT_FOUND =
  "The selected Processing Center was not found in this business."
export const PROCESSING_CENTER_INVALID =
  "The selected location is not a Processing Center. Choose an active Processing Center or a Retail + Processing location."
export const PROCESSING_CENTER_INACTIVE =
  "The selected Processing Center is inactive. Choose an active one."
export const PROCESSING_CENTER_SELF =
  "A store cannot be its own Processing Center unless its type is Retail + Processing."

export interface AssignmentCandidate {
  id: string
  storeType?: string | null
  isActive?: boolean
  laundryBusinessId?: string | null
}

/**
 * Why this store may not be ACTIVE with this assignment, or null when it may.
 *
 * Pure — the caller loads the rows. Used by the create API, the update API and
 * the UI so all three refuse for the same reason, in the same words.
 */
export function processingAssignmentRefusal(input: {
  storeType?: string | null
  isActive?: boolean
  storeId?: string | null
  /** The chosen centre, already loaded and tenant-scoped, or null. */
  centre: AssignmentCandidate | null
  /** The id the caller asked for, to tell "not chosen" from "not found". */
  requestedCentreId?: string | null
}): string | null {
  // An INACTIVE store may be saved incomplete — the rule gates ACTIVATION, so
  // a draft can be captured and finished later.
  if (input.isActive === false) return null
  if (!requiresProcessingCenterAssignment(input.storeType)) return null

  if (!input.requestedCentreId) return NO_PROCESSING_CENTER
  if (!input.centre) return PROCESSING_CENTER_NOT_FOUND
  if (input.storeId && input.centre.id === input.storeId) return PROCESSING_CENTER_SELF
  // Order matters: "inactive" is more useful than "not a centre" when it is one.
  if (input.centre.isActive === false) return PROCESSING_CENTER_INACTIVE
  if (!isProcessingCapable(input.centre)) return PROCESSING_CENTER_INVALID
  return null
}

/**
 * The centre that processes this store's garments, for the snapshot taken when
 * an order is committed to processing. A BOTH location resolves to ITSELF —
 * that is what "processes its own workload" means operationally.
 */
export function resolveProcessingCenterId(store: {
  id: string
  storeType?: string | null
  processingCenterStoreId?: string | null
}): string | null {
  if (!requiresProcessingCenterAssignment(store.storeType)) return store.id
  return store.processingCenterStoreId ?? null
}
