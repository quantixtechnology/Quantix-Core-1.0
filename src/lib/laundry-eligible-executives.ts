// Which Delivery Executives may be assigned to an order — ONE definition, used
// by every dispatch surface (Ready for Delivery, Pickup Assignment, Manual
// Reassignment, Bulk Assignment, Store Admin PWA, and anything added later).
//
// An order always belongs to exactly one store (LaundryOrder.storeId is
// required), so eligibility is decided against that store:
//
//   assigned to the order's store  OR  assigned to All Stores
//
// "All Stores" is how LaundryDeliveryExecutive.storeId = null is read — a
// floating executive who works across the whole business. They stay eligible
// everywhere, which is why the store test is an OR and never a plain equality.
//
// Availability: OFF means off-duty and is excluded. BUSY is NOT excluded — a
// rider who is out on a job is still who you queue the next drop onto, and
// hiding them would empty the dropdown during exactly the busiest part of the
// day. Only a deliberate off-duty state removes someone from dispatch.
//
// Two shapes of the same rule:
//   • eligibleExecutiveWhere() — a Prisma filter, so a business with hundreds
//     of executives never ships the whole master list to a dropdown.
//   • isExecutiveEligible() / filterEligibleExecutives() — the pure predicate,
//     for a screen that holds one list spanning several stores (the Dispatch
//     Center board) and must narrow it per job.
// Both express the same rule; keep them in step.

/** LaundryDeliveryExecutive.storeId when the executive works across all stores. */
export const ALL_STORES = null

/** availability values that remove an executive from dispatch. */
export const UNAVAILABLE_STATES = ["OFF"] as const

export const NO_EXECUTIVES_FOR_STORE = "No delivery executives assigned to this store."

/** The fields eligibility is decided on — any richer executive row satisfies this. */
export interface EligibleExecutiveFields {
  storeId?: string | null
  isActive?: boolean
  availability?: string | null
  archivedAt?: string | Date | null
}

/** Prisma `where` for the executives assignable to `storeId`. */
export function eligibleExecutiveWhere(businessId: string, storeId: string | null | undefined) {
  return {
    businessId,
    isActive: true,
    archivedAt: null,
    availability: { notIn: [...UNAVAILABLE_STATES] },
    // No order store (shouldn't happen — storeId is required) → don't narrow,
    // so a caller that can't resolve the store still gets a usable list rather
    // than a silently empty dropdown.
    ...(storeId ? { OR: [{ storeId }, { storeId: ALL_STORES }] } : {}),
  }
}

export function isExecutiveEligible(exec: EligibleExecutiveFields, storeId: string | null | undefined): boolean {
  if (exec.isActive === false) return false
  if (exec.archivedAt) return false
  if (exec.availability && (UNAVAILABLE_STATES as readonly string[]).includes(exec.availability)) return false
  if (!storeId) return true
  return exec.storeId === storeId || exec.storeId == null
}

export function filterEligibleExecutives<T extends EligibleExecutiveFields>(execs: T[], storeId: string | null | undefined): T[] {
  return execs.filter((e) => isExecutiveEligible(e, storeId))
}

/**
 * Executives assignable to EVERY one of the given stores — for a bulk action
 * whose selection spans stores. Narrowing to the intersection means a bulk
 * assign can never hand an order to an executive who doesn't serve its store;
 * a mixed-store selection leaves only the All-Stores executives.
 */
export function filterEligibleForStores<T extends EligibleExecutiveFields>(execs: T[], storeIds: (string | null | undefined)[]): T[] {
  const stores = [...new Set(storeIds.filter(Boolean) as string[])]
  if (!stores.length) return filterEligibleExecutives(execs, null)
  return execs.filter((e) => stores.every((s) => isExecutiveEligible(e, s)))
}
