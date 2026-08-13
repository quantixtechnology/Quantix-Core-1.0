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
 * Written as "not a processing centre" rather than "in [RETAIL, BOTH]" on
 * purpose: the column is a free String with a RETAIL_STORE default, and legacy
 * or future rows carrying some other value are retail-ish by intent. Only
 * PROCESSING_CENTER is genuinely disqualifying, so an unrecognised value keeps
 * serving customers instead of silently emptying a tenant's store list.
 */
export const customerFacingStoreWhere = { storeType: { not: STORE_TYPE_PROCESSING } } as const

/** Same rule, for filtering rows already in memory. */
export function isCustomerFacingStore(store: { storeType?: string | null }): boolean {
  return store.storeType !== STORE_TYPE_PROCESSING
}
