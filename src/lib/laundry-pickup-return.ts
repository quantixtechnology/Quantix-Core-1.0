// Returning the bags a customer is holding, at their next pickup.
//
// BUSINESS RULE: a customer returns ALL the bags they hold. There is no partial
// return — the pickup cannot complete while any bag is still out.
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
  complete: boolean
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
  const complete = returned === total // vacuously true when the customer holds none
  return {
    bags: rows,
    total,
    returned,
    complete,
    message: complete ? null : `${returned} of ${total} customer bags returned. Scan all bags before completing pickup.`,
  }
}

export type ReturnScanResult =
  | { ok: true; bagNumber: string; returned: number; total: number; complete: boolean; alreadyReturned: boolean }
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
    return { ok: true, bagNumber: row.bagNumber, returned: view.returned, total: view.total, complete: view.complete, alreadyReturned: true }
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
  return { ok: true, bagNumber: row.bagNumber, returned: after.returned, total: after.total, complete: after.complete, alreadyReturned: false }
}

/**
 * The bag half of the pickup completion gate — server-authoritative.
 *
 * Returns null when the pickup may complete, or the operator-facing reason when
 * bags are still out. A customer holding nothing is never blocked.
 */
export async function pickupReturnGate(
  lbId: string,
  customerId: string | null | undefined,
  opts: { orderId?: string | null } = {},
): Promise<string | null> {
  if (!customerId) return null
  const view = await customerReturnBags(lbId, customerId, opts)
  return view.complete ? null : view.message
}
