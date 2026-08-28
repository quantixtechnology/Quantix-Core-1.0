// Returning the bags a customer is holding, at their next pickup.
//
// BUSINESS RULE: returning bags is OPTIONAL and PARTIAL. A customer may hand
// back all, some, one or none of the bags they hold, and the pickup completes
// either way — PICKUP COMPLETION IS NOT BAG-RETURN COMPLETION. Nothing here
// gates the pickup workflow; there is deliberately no gate function to call.
//
// A bag is returned ONLY by being scanned. A bag that is not scanned stays with
// the customer, keeps its custody, and appears again on their next pickup.
//
// NO SCHEMA CHANGE. Everything is derived from state that already exists:
//   • getBagsWithCustomer() — bags whose status is HANDED_TO_CUSTOMER and whose
//     currentCustomerId is this customer. A returned bag leaves that status, so
//     it drops out on its own and history never reappears as work to do (§14).
//   • receiveReturnedBag() — the existing lifecycle writer. It keeps the bag id,
//     completes the usage row rather than re-opening it, records the event, and
//     decides the resulting status from the bag's CONDITION.
//   • LaundryBagEvent — already append-only and indexed, used to recognise a bag
//     already returned during THIS pickup so a re-scan is idempotent.
//
// No second customer-bag relation, no replacement bag ids, no new lifecycle
// state.
import { prisma } from "@/lib/prisma"
import {
  getBagsWithCustomer, receiveReturnedBag, BAG_CONDITION, isCondition,
  type BagCondition,
} from "@/lib/laundry-bag-lifecycle"

/** The event receiveReturnedBag() appends when a customer hands a bag back. */
export const RETURNED_ACTION = "RETURNED_BY_CUSTOMER"

export interface ReturnBagRow {
  bagId: string
  bagNumber: string
  orderId: string | null
  orderNumber: string | null
  returned: boolean
  index: number
}

export interface CustomerReturnView {
  bags: ReturnBagRow[]
  total: number
  returned: number
  /** Still with the customer after this pickup — carried to the next one. */
  outstanding: number
  /** Every held bag came back. INFORMATIONAL — it gates nothing. */
  allReturned: boolean
  /** Progress for the operator to read. Never a blocking message. */
  message: string | null
}

/**
 * The bags this customer must hand back, with what has already been scanned.
 *
 * `total` is the outstanding bags PLUS those already returned in this pickup, so
 * the operator sees a stable "N of M" rather than a shrinking list. Bags
 * returned on an earlier visit are not counted — they are no longer held and
 * carry no event for this pickup.
 */
export async function customerReturnBags(
  lbId: string,
  customerId: string,
  opts: { orderId?: string | null } = {},
): Promise<CustomerReturnView> {
  const held = await getBagsWithCustomer(lbId, customerId)

  // Bags this customer has handed back during THIS pickup — they have left
  // HANDED_TO_CUSTOMER, so they are no longer in `held` and must be counted
  // from their return event instead.
  const returnedEvents = opts.orderId
    ? await prisma.laundryBagEvent.findMany({
        where: { businessId: lbId, customerId, action: RETURNED_ACTION, orderId: opts.orderId },
        select: { bagId: true, bagNumber: true, orderId: true, orderNumber: true },
        orderBy: { createdAt: "asc" },
      })
    : []
  const seen = new Set<string>()
  const returnedRows = returnedEvents.filter((e) => (seen.has(e.bagId) ? false : (seen.add(e.bagId), true)))

  const rows: ReturnBagRow[] = [
    ...returnedRows.map((e) => ({
      bagId: e.bagId, bagNumber: e.bagNumber, orderId: e.orderId, orderNumber: e.orderNumber,
      returned: true, index: 0,
    })),
    ...held.map((b) => ({
      bagId: b.bagId, bagNumber: b.bagNumber, orderId: b.orderId, orderNumber: b.orderNumber,
      returned: false, index: 0,
    })),
  ].map((r, i) => ({ ...r, index: i + 1 }))

  const total = rows.length
  const returned = rows.filter((r) => r.returned).length
  const outstanding = total - returned
  const allReturned = outstanding === 0
  return {
    bags: rows,
    total,
    returned,
    outstanding,
    allReturned,
    // States the position; never tells the operator they cannot continue.
    message: total === 0
      ? null
      : allReturned
        ? `${returned} of ${total} bags returned.`
        : `${returned} of ${total} bags returned. ${outstanding} bag${outstanding === 1 ? "" : "s"} remain${outstanding === 1 ? "s" : ""} with customer.`,
  }
}

export type ReturnScanResult =
  | { ok: true; bagNumber: string; returned: number; total: number; outstanding: number; allReturned: boolean; alreadyReturned: boolean }
  | { ok: false; status: number; error: string }

/**
 * Take one scanned bag back from the customer.
 *
 * Refused unless the bag is currently held by THIS customer — which rules out
 * another customer's bag, another tenant's bag (the lookup is business-scoped)
 * and a bag that is not out with anyone. Re-scanning a bag already returned in
 * this pickup is a no-op, not a second return.
 */
export async function confirmReturnedBag(opts: {
  lbId: string
  customerId: string
  code: string
  orderId?: string | null
  storeId?: string | null
  condition?: BagCondition | string | null
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}): Promise<ReturnScanResult> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "Scan a bag to return it." }

  const view = await customerReturnBags(opts.lbId, opts.customerId, { orderId: opts.orderId })
  const wanted = code.toUpperCase()
  const row = view.bags.find((b) => b.bagNumber.toUpperCase() === wanted)

  if (row?.returned) {
    return { ok: true, bagNumber: row.bagNumber, returned: view.returned, total: view.total, outstanding: view.outstanding, allReturned: view.allReturned, alreadyReturned: true }
  }
  if (!row) {
    return { ok: false, status: 409, error: `Bag ${code} is not currently assigned to this customer.` }
  }

  // The existing lifecycle writer: same bag id, usage row completed not
  // re-opened, event appended, resulting status decided by CONDITION.
  const condition: BagCondition = isCondition(opts.condition) ? opts.condition : BAG_CONDITION.GOOD
  const res = await receiveReturnedBag({
    lbId: opts.lbId,
    bagId: row.bagId,
    condition,
    orderId: opts.orderId ?? row.orderId ?? null,
    customerId: opts.customerId,
    storeId: opts.storeId ?? null,
    actor: opts.actor,
  })
  if (!res.ok) return { ok: false, status: res.status, error: res.error }

  const after = await customerReturnBags(opts.lbId, opts.customerId, { orderId: opts.orderId })
  return { ok: true, bagNumber: row.bagNumber, returned: after.returned, total: after.total, outstanding: after.outstanding, allReturned: after.allReturned, alreadyReturned: false }
}

// DELIBERATELY NO GATE FUNCTION.
//
// An earlier revision exported pickupReturnGate(), which blocked a pickup until
// every customer-held bag came back. That rule was reversed: a customer may
// return some bags, one, or none, and the pickup completes regardless. The
// function is removed rather than left unused, because a gate that exists is a
// gate someone wires up. Pickup completion is governed only by the existing
// pickup workflow requirements.
