// THE bag list of an order — one reader, used by every stage.
//
// Sorting sets the initial plan, Packing & QR may add to it, and Processing,
// Delivery and the next Pickup all have to agree about which physical bags
// belong to the order. Section 15 of the requirement: no stage keeps its own
// counter, because independent counters drift.
//
// The authority is LaundryBagAssignment — already one row per bag per order,
// already indexed by orderId, and already written by assignBagToOrder(). This
// module only READS that relation and offers one guarded way to add to it. It
// does not duplicate assignment logic, does not generate bag numbers, and does
// not introduce a second bag record: assignBagToOrder and the existing Bag
// Management generator remain the only writers.
//
// Deliberately NOT modelled: which garment is in which bag. The requirement
// (§18) is one order → many bags, with every physical bag accounted for.
import { prisma } from "@/lib/prisma"
import { assignBagToOrder, type BagConflict, type BagPurpose } from "@/lib/laundry-bag-assign"
import type { Custodian } from "@/lib/laundry-bag-lifecycle"

/** An assignment row's status while the bag is still working this order. */
const OPEN_ASSIGNMENT = "ASSIGNED"

export interface OrderBag {
  assignmentId: string
  bagId: string
  bagNumber: string
  qrValue: string
  /** Live bag state — AVAILABLE|COLLECTED|PROCESSING|HANDED_TO_CUSTOMER|… */
  status: string
  /** Who physically holds it — LAUNDRY|STORE|PROCESSING_CENTER|DELIVERY_EXECUTIVE|CUSTOMER */
  custodian: string
  /** Still carrying this order, as opposed to closed history. */
  open: boolean
  assignedAt: Date
  /** 1-based position, so a label can read "Bag 2 of 3". */
  index: number
  /**
   * WHICH SERVICE this physical bag belongs to, straight off the assignment row
   * that has always stored it. Without this every consumer had to guess, and
   * the ones that guessed took services[0] — so on a two-service order every
   * bag read as the first service and Dry Clean looked fully bagged when it
   * had none.
   */
  serviceId: string | null
  serviceName: string | null
  /**
   * WHY this bag is on the order — PICKUP | SORTING | DELIVERY, or null for a
   * row written before the role was recorded. Null is "not recorded", never
   * "general purpose": a reader that needs a specific role must require it.
   */
  purpose: string | null
}

/**
 * Every bag of an order, oldest first — the Sorting plan plus anything Packing
 * added, in the order they were assigned.
 *
 * Returns the CLOSED rows too (a bag handed to the customer is still one of the
 * order's bags, §13). Callers that mean "still in play" filter on `open`.
 */
export async function orderBags(lbId: string, orderId: string): Promise<OrderBag[]> {
  const rows = await prisma.laundryBagAssignment.findMany({
    where: { businessId: lbId, orderId },
    orderBy: { assignedAt: "asc" },
    include: { bag: { select: { id: true, bagNumber: true, qrValue: true, status: true, currentCustodianType: true, businessId: true } } },
  })
  return rows
    // Tenant belt-and-braces: the assignment is already business-scoped, and the
    // bag must belong to the same business. A mismatch is not renderable.
    .filter((r) => r.bag && r.bag.businessId === lbId)
    .map((r, i) => ({
      assignmentId: r.id,
      bagId: r.bagId,
      bagNumber: r.bag.bagNumber,
      qrValue: r.bag.qrValue || r.bag.bagNumber,
      status: r.bag.status,
      custodian: r.bag.currentCustodianType || "LAUNDRY",
      open: r.status === OPEN_ASSIGNMENT,
      assignedAt: r.assignedAt,
      index: i + 1,
      serviceId: r.serviceId ?? null,
      serviceName: r.serviceName ?? null,
      purpose: r.purpose ?? null,
    }))
}

/**
 * The same rows as orderBags(), for many orders at once.
 *
 * A queue screen shows tens of orders and needs each one's bags; asking per
 * order would be one query per row. Same table, same tenant scope, same
 * ordering and the same mapping — the only difference is the `in` filter, so
 * a caller cannot get a different answer by reading in bulk.
 */
export async function orderBagsForOrders(lbId: string, orderIds: string[]): Promise<Map<string, OrderBag[]>> {
  const out = new Map<string, OrderBag[]>()
  if (!orderIds.length) return out
  const rows = await prisma.laundryBagAssignment.findMany({
    where: { businessId: lbId, orderId: { in: orderIds } },
    orderBy: { assignedAt: "asc" },
    include: { bag: { select: { id: true, bagNumber: true, qrValue: true, status: true, currentCustodianType: true, businessId: true } } },
  })
  for (const r of rows) {
    if (!r.bag || r.bag.businessId !== lbId) continue
    const list = out.get(r.orderId) || []
    list.push({
      assignmentId: r.id,
      bagId: r.bagId,
      bagNumber: r.bag.bagNumber,
      qrValue: r.bag.qrValue || r.bag.bagNumber,
      status: r.bag.status,
      custodian: r.bag.currentCustodianType || "LAUNDRY",
      open: r.status === OPEN_ASSIGNMENT,
      assignedAt: r.assignedAt,
      index: list.length + 1,
      serviceId: r.serviceId ?? null,
      serviceName: r.serviceName ?? null,
      purpose: r.purpose ?? null,
    })
    out.set(r.orderId, list)
  }
  return out
}

/** How many bags this order currently has — the number every stage must match. */
export async function orderBagCount(lbId: string, orderId: string): Promise<number> {
  return prisma.laundryBagAssignment.count({ where: { businessId: lbId, orderId } })
}

export type AddBagResult =
  | { ok: true; bag: OrderBag; total: number; alreadyOnOrder: boolean }
  // `conflict` carries the refusal as fields as well as prose, so a caller can
  // lay it out instead of parsing the sentence. Passed straight through from
  // assignBagToOrder — nothing is decided here.
  | { ok: false; status: number; error: string; conflict?: BagConflict }

/**
 * Attach one more scanned bag to an order.
 *
 * A thin, guarded front door onto assignBagToOrder — which already rejects a
 * bag that does not exist, one belonging to another tenant, one held by another
 * order, and one that is damaged/lost/cleaning, and which is idempotent when the
 * same bag is re-scanned onto the same order. None of that is re-implemented
 * here; this only adds the order-level view around it.
 *
 * Adding NEVER replaces: the existing assignment rows are untouched (§5).
 */
export async function addBagToOrder(opts: {
  lbId: string
  orderId: string
  code: string
  serviceId?: string | null
  serviceName?: string
  /** Where the bag is being picked up — Sorting binds at the plant, not the store. */
  custodian?: Custodian
  /** WHY the bag is going on the order — see BAG_PURPOSE. */
  purpose?: BagPurpose
}): Promise<AddBagResult> {
  const before = await orderBags(opts.lbId, opts.orderId)
  const already = before.find((b) => b.bagNumber === opts.code.trim() || b.qrValue === opts.code.trim())

  const res = await assignBagToOrder({
    lbId: opts.lbId,
    orderId: opts.orderId,
    code: opts.code,
    serviceId: opts.serviceId ?? null,
    serviceName: opts.serviceName,
    custodian: opts.custodian,
    purpose: opts.purpose,
  })
  if (!res.ok) return { ok: false, status: res.status, error: res.error, conflict: res.conflict }

  const after = await orderBags(opts.lbId, opts.orderId)
  const bag = after.find((b) => b.bagId === res.bag.id)
  if (!bag) return { ok: false, status: 500, error: "The bag was assigned but could not be read back." }

  // A re-scan of a bag already on this order is a confirmation, not a second bag.
  return { ok: true, bag, total: after.length, alreadyOnOrder: !!already }
}

export interface BagScanProgress {
  total: number
  scanned: number
  complete: boolean
  /** Operator-facing when incomplete, else null. */
  message: string | null
}

/**
 * Progress for a stage that must account for every bag (§7).
 *
 * `scannedBagNumbers` is what the operator has confirmed at THIS stage; the
 * total comes from the authoritative assignment list, never a local counter.
 */
export function bagScanProgress(bags: OrderBag[], scannedBagNumbers: string[]): BagScanProgress {
  const scannedSet = new Set(scannedBagNumbers.map((c) => c.trim().toUpperCase()))
  const scanned = bags.filter((b) => scannedSet.has(b.bagNumber.toUpperCase())).length
  const total = bags.length
  const complete = total > 0 && scanned === total
  return {
    total,
    scanned,
    complete,
    message: complete || total === 0 ? null : `${scanned} of ${total} bags scanned. Scan all bags before continuing.`,
  }
}
