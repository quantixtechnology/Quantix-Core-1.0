// Customer-retained bag lifecycle ENGINE.
//
// THE RULE THIS EXISTS FOR: delivering an order completes the ORDER's use of a
// bag; it does not complete the BAG's life. The bag is normally handed to the
// customer and stays with them — for a day, for three orders, or for ever. It
// is not available stock, and it is not lost.
//
// That forces two ideas apart that the old model treated as one:
//
//   status     can this bag be used?      AVAILABLE, DAMAGED, RETIRED…
//   custodian  who is physically holding it?  STORE, CUSTOMER, EXECUTIVE…
//
// A bag with the customer is HANDED_TO_CUSTOMER / CUSTODIAN.CUSTOMER: excluded
// from available inventory, still fully accounted for. Nothing here ever marks
// a bag lost because a customer failed to return it (Rule 11) — that is a human
// decision, taken explicitly.
//
// SCOPE: the customer-facing DELIVERY bag. The pickup bag's release stage
// (laundry-bag-assign.ts) and the internal Processing Package are untouched.
//
// HISTORY IS APPEND-ONLY. LaundryBagAssignment is the per-order usage record —
// one row per order this physical bag has carried, never rewritten, so a bag
// reused across ORD-001, ORD-005 and ORD-009 has three intact rows.
// LaundryBagEvent is the movement log: every status/custody change, with actor.
import { prisma } from "@/lib/prisma"
import { issueBagId } from "@/lib/laundry-employee-identity"

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// ── Bag ID generation (single source of truth) ──────────────────────────────
// All Bag IDs are issued through the same atomic TenantEmployeeSequence counter
// used by Employee IDs. The format is {prefix}BAG{seq} (e.g. V8BAG001).
// Concurrent generation is safe: nextEmployeeSequence uses an atomic DB upsert.

/** Issue a single Bag ID through the atomic counter. */
export async function generateBagCode(platformBusinessId: string, laundryBusinessId: string): Promise<string> {
  return issueBagId(platformBusinessId, laundryBusinessId)
}

/** Issue `count` unique Bag IDs atomically — each call increments the counter. */
export async function bulkGenerateBagCodes(
  platformBusinessId: string,
  laundryBusinessId: string,
  count: number,
): Promise<string[]> {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(await issueBagId(platformBusinessId, laundryBusinessId))
  }
  return codes
}

// ── Vocabulary ───────────────────────────────────────────────────────────────

export const BAG_STATUS = {
  AVAILABLE: "AVAILABLE",
  ASSIGNED: "ASSIGNED",
  COLLECTED: "COLLECTED",
  RECEIVED_AT_STORE: "RECEIVED_AT_STORE",
  UNDER_AUDIT: "UNDER_AUDIT",
  PROCESSING: "PROCESSING",
  READY_FOR_DELIVERY: "READY_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  HANDED_TO_CUSTOMER: "HANDED_TO_CUSTOMER",
  RETURNED_BY_CUSTOMER: "RETURNED_BY_CUSTOMER",
  INSPECTION_REQUIRED: "INSPECTION_REQUIRED",
  DAMAGED: "DAMAGED",
  LOST: "LOST",
  RETIRED: "RETIRED",
} as const
export type BagStatus = (typeof BAG_STATUS)[keyof typeof BAG_STATUS]

export const CUSTODIAN = {
  LAUNDRY: "LAUNDRY",
  STORE: "STORE",
  PROCESSING_CENTER: "PROCESSING_CENTER",
  DELIVERY_EXECUTIVE: "DELIVERY_EXECUTIVE",
  CUSTOMER: "CUSTOMER",
} as const
export type Custodian = (typeof CUSTODIAN)[keyof typeof CUSTODIAN]

export const BAG_CONDITION = {
  GOOD: "GOOD",
  MINOR_DAMAGE: "MINOR_DAMAGE",
  DAMAGED: "DAMAGED",
  HEAVILY_DAMAGED: "HEAVILY_DAMAGED",
  UNUSABLE: "UNUSABLE",
} as const
export type BagCondition = (typeof BAG_CONDITION)[keyof typeof BAG_CONDITION]

/** What the executive records at the door. Handing the bag over is the NORMAL
 *  outcome and the default — never a failure, and never a blocker on delivery. */
export const DISPOSITION = {
  HANDED_TO_CUSTOMER: "HANDED_TO_CUSTOMER",
  RETURNED_TO_EXECUTIVE: "RETURNED_TO_EXECUTIVE",
  NO_BAG_DELIVERED: "NO_BAG_DELIVERED",
  DAMAGED: "DAMAGED",
  LOST: "LOST",
} as const
export type Disposition = (typeof DISPOSITION)[keyof typeof DISPOSITION]

export const DEFAULT_DISPOSITION: Disposition = DISPOSITION.HANDED_TO_CUSTOMER

export function isDisposition(v: unknown): v is Disposition {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(DISPOSITION, v)
}
export function isCondition(v: unknown): v is BagCondition {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(BAG_CONDITION, v)
}

/**
 * Condition decides whether a returned bag may circulate again — returning a
 * bag is NOT the same as it being reusable (Rule 8). Only GOOD goes straight
 * back to stock.
 */
export function conditionToStatus(condition: BagCondition): BagStatus {
  switch (condition) {
    case BAG_CONDITION.GOOD: return BAG_STATUS.AVAILABLE
    case BAG_CONDITION.MINOR_DAMAGE: return BAG_STATUS.INSPECTION_REQUIRED
    case BAG_CONDITION.DAMAGED:
    case BAG_CONDITION.HEAVILY_DAMAGED: return BAG_STATUS.DAMAGED
    case BAG_CONDITION.UNUSABLE: return BAG_STATUS.RETIRED
  }
}

/** Statuses that are NOT available stock — used by inventory and by reuse checks. */
export const NON_STOCK_STATUSES: readonly string[] = [
  BAG_STATUS.HANDED_TO_CUSTOMER, BAG_STATUS.INSPECTION_REQUIRED,
  BAG_STATUS.DAMAGED, BAG_STATUS.LOST, BAG_STATUS.RETIRED,
]

// ── Inventory buckets (§14) ──────────────────────────────────────────────────
// Every bag lands in EXACTLY ONE bucket, by a fixed precedence, so the buckets
// always sum to the registered total. Exception states win over location, then
// customer retention, then physical custody.

export interface BagInventory {
  total: number
  available: number
  withExecutives: number
  atStore: number
  atProcessingCenter: number
  outForDelivery: number
  withCustomers: number
  inspectionRequired: number
  damaged: number
  lost: number
  retired: number
  /** A status the model does not recognise. Surfaced for review, NEVER folded
   *  into Available — a bag nobody can classify is not a bag you can issue. */
  unclassified: number
}

export type BagBucket = Exclude<keyof BagInventory, "total">

/**
 * Mid-cycle statuses placed by CUSTODY rather than by name, including the legacy
 * values still on production rows. Anything outside this set is unclassified.
 */
const MID_CYCLE_STATUSES: readonly string[] = [
  BAG_STATUS.ASSIGNED, BAG_STATUS.COLLECTED, BAG_STATUS.RECEIVED_AT_STORE,
  BAG_STATUS.UNDER_AUDIT, BAG_STATUS.PROCESSING, BAG_STATUS.READY_FOR_DELIVERY,
  BAG_STATUS.RETURNED_BY_CUSTOMER,
  // Legacy statuses written before this module existed.
  "CLEANING", "DELIVERED", "RETURNED",
]

export function bucketFor(bag: { status: string; currentCustodianType?: string | null }): BagBucket {
  switch (bag.status) {
    case BAG_STATUS.RETIRED: return "retired"
    case BAG_STATUS.LOST: return "lost"
    case BAG_STATUS.DAMAGED: return "damaged"
    case BAG_STATUS.INSPECTION_REQUIRED: return "inspectionRequired"
    case BAG_STATUS.HANDED_TO_CUSTOMER: return "withCustomers"
    case BAG_STATUS.OUT_FOR_DELIVERY: return "outForDelivery"
    case BAG_STATUS.AVAILABLE: return "available"
  }
  // A status nobody recognises is reported as such (§17). Quietly calling it
  // "at store" would hide a data problem behind a plausible number.
  if (!MID_CYCLE_STATUSES.includes(bag.status)) return "unclassified"
  // Everything mid-cycle is placed by who is holding it, which is more truthful
  // than the status name — a COLLECTED bag is in a van, not at the counter.
  switch (bag.currentCustodianType) {
    case CUSTODIAN.CUSTOMER: return "withCustomers"
    case CUSTODIAN.DELIVERY_EXECUTIVE: return "withExecutives"
    case CUSTODIAN.PROCESSING_CENTER: return "atProcessingCenter"
    default: return "atStore"
  }
}

/**
 * Active inventory excludes RETIRED — a retired bag is gone from circulation and
 * counting it would inflate every ratio built on this number (§17).
 */
export function activeTotal(inv: BagInventory): number {
  return inv.total - inv.retired
}

const EMPTY_INVENTORY: BagInventory = {
  total: 0, available: 0, withExecutives: 0, atStore: 0, atProcessingCenter: 0,
  outForDelivery: 0, withCustomers: 0, inspectionRequired: 0, damaged: 0, lost: 0,
  retired: 0, unclassified: 0,
}

export function tallyInventory(bags: { status: string; currentCustodianType?: string | null }[]): BagInventory {
  const inv: BagInventory = { ...EMPTY_INVENTORY, total: bags.length }
  for (const b of bags) inv[bucketFor(b)] += 1
  return inv
}

export async function getBagInventory(lbId: string): Promise<BagInventory> {
  const bags = await prisma.laundryBag.findMany({
    where: { businessId: lbId },
    select: { status: true, currentCustodianType: true },
  })
  return tallyInventory(bags)
}

// ── Event log (§20) ──────────────────────────────────────────────────────────

export interface BagEventInput {
  bagId: string
  bagNumber: string
  businessId: string
  action: string
  previousStatus?: string | null
  newStatus?: string | null
  previousCustodianType?: string | null
  newCustodianType?: string | null
  orderId?: string | null
  orderNumber?: string | null
  customerId?: string | null
  customerName?: string | null
  storeId?: string | null
  condition?: string | null
  reason?: string | null
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}

/** Append one movement to the bag's permanent history. Never updates a row. */
export async function recordBagEvent(tx: Tx, e: BagEventInput) {
  return tx.laundryBagEvent.create({
    data: {
      bagId: e.bagId, bagNumber: e.bagNumber, businessId: e.businessId, action: e.action,
      previousStatus: e.previousStatus ?? null, newStatus: e.newStatus ?? null,
      previousCustodianType: e.previousCustodianType ?? null, newCustodianType: e.newCustodianType ?? null,
      orderId: e.orderId ?? null, orderNumber: e.orderNumber ?? null,
      customerId: e.customerId ?? null, customerName: e.customerName ?? null,
      storeId: e.storeId ?? null, condition: e.condition ?? null, reason: e.reason ?? null,
      actorId: e.actor?.id ?? null, actorName: e.actor?.name ?? null, actorRole: e.actor?.role ?? null,
    },
  })
}

export type LifecycleResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string; code?: string }

// ── Delivery disposition (§5) ────────────────────────────────────────────────

export interface DispositionInput {
  lbId: string
  orderId: string
  disposition?: Disposition
  condition?: BagCondition
  reason?: string | null
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}

/**
 * Record what happened to the delivery bag when the order was handed over.
 *
 * This NEVER gates the delivery. An order with no bag, an unknown bag or a bag
 * the customer kept are all successful deliveries — the bag outcome is recorded
 * beside the delivery, never in front of it (Rule 3, §5).
 */
export async function applyDeliveryDisposition(input: DispositionInput): Promise<LifecycleResult<{ bagNumber: string | null; disposition: Disposition }>> {
  const disposition = input.disposition && isDisposition(input.disposition) ? input.disposition : DEFAULT_DISPOSITION

  const order = await prisma.laundryOrder.findFirst({
    where: { id: input.orderId, businessId: input.lbId },
    select: { id: true, orderNumber: true, customerId: true, deliveryBagNumber: true, storeId: true },
  })
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  // No bag on this delivery is a legitimate outcome, not an error.
  if (!order.deliveryBagNumber || disposition === DISPOSITION.NO_BAG_DELIVERED) {
    return { ok: true, bagNumber: order.deliveryBagNumber ?? null, disposition: DISPOSITION.NO_BAG_DELIVERED }
  }

  const bag = await prisma.laundryBag.findFirst({
    where: { businessId: input.lbId, OR: [{ bagNumber: order.deliveryBagNumber }, { qrValue: order.deliveryBagNumber }] },
  })
  // A free-text delivery bag code that is not a registered reusable bag — the
  // delivery still stands; there is simply no asset to move.
  if (!bag) return { ok: true, bagNumber: order.deliveryBagNumber, disposition }

  const customer = order.customerId
    ? await prisma.customer.findUnique({ where: { id: order.customerId }, select: { name: true } })
    : null

  const now = new Date()
  const prevStatus = bag.status
  const prevCustodian = bag.currentCustodianType

  // Per-disposition target state. Only HANDED_TO_CUSTOMER attaches the bag to a
  // customer; the rest bring it back toward the laundry.
  let status: BagStatus
  let custodianType: Custodian
  let condition = bag.condition
  let returnStatus: string
  switch (disposition) {
    case DISPOSITION.HANDED_TO_CUSTOMER:
      status = BAG_STATUS.HANDED_TO_CUSTOMER; custodianType = CUSTODIAN.CUSTOMER
      returnStatus = "HANDED_TO_CUSTOMER"; break
    case DISPOSITION.RETURNED_TO_EXECUTIVE:
      status = BAG_STATUS.RETURNED_BY_CUSTOMER; custodianType = CUSTODIAN.DELIVERY_EXECUTIVE
      returnStatus = "RETURNED_TO_STORE"; break
    case DISPOSITION.DAMAGED:
      status = BAG_STATUS.DAMAGED; custodianType = CUSTODIAN.DELIVERY_EXECUTIVE
      condition = input.condition && isCondition(input.condition) ? input.condition : BAG_CONDITION.DAMAGED
      returnStatus = "DAMAGED"; break
    case DISPOSITION.LOST:
      // Custody stays with the customer: that is the last place it was seen.
      status = BAG_STATUS.LOST; custodianType = CUSTODIAN.CUSTOMER
      returnStatus = "LOST"; break
    default:
      status = BAG_STATUS.HANDED_TO_CUSTOMER; custodianType = CUSTODIAN.CUSTOMER
      returnStatus = "HANDED_TO_CUSTOMER"
  }

  const handedOver = disposition === DISPOSITION.HANDED_TO_CUSTOMER

  await prisma.$transaction(async (tx) => {
    await tx.laundryBag.update({
      where: { id: bag.id },
      data: {
        status, condition,
        currentCustodianType: custodianType,
        currentCustodianId: handedOver ? order.customerId : (input.actor?.id ?? null),
        currentCustodianName: handedOver ? (customer?.name ?? null) : (input.actor?.name ?? null),
        currentCustomerId: order.customerId ?? bag.currentCustomerId,
        currentCustomerName: customer?.name ?? bag.currentCustomerName,
        currentStoreId: order.storeId ?? bag.currentStoreId,
        handedToCustomerAt: handedOver ? now : null,
        handedToCustomerOrderId: handedOver ? order.id : null,
        lastUsedAt: now,
      },
    })
    // Close this order's usage row — the row itself is never rewritten later.
    await tx.laundryBagAssignment.updateMany({
      where: { bagId: bag.id, orderId: order.id, status: "ASSIGNED" },
      data: {
        status: handedOver ? "HANDED_TO_CUSTOMER" : "RETURNED",
        deliveredDate: now, returnStatus,
        receivedBy: handedOver ? (customer?.name ?? "Customer") : (input.actor?.name ?? null),
      },
    })
    await recordBagEvent(tx, {
      bagId: bag.id, bagNumber: bag.bagNumber, businessId: input.lbId,
      action: disposition,
      previousStatus: prevStatus, newStatus: status,
      previousCustodianType: prevCustodian, newCustodianType: custodianType,
      orderId: order.id, orderNumber: order.orderNumber,
      customerId: order.customerId, customerName: customer?.name ?? null,
      storeId: order.storeId, condition,
      reason: input.reason ?? null, actor: input.actor,
    })
  })

  return { ok: true, bagNumber: bag.bagNumber, disposition }
}

// ── Identifying a bag a customer brings back (§6, §9, §11) ───────────────────

export interface ReturnedBagInfo {
  bagId: string
  bagNumber: string
  status: string
  condition: string
  qrDamaged: boolean
  custodianType: string
  previousCustomerId: string | null
  previousCustomerName: string | null
  previousOrderId: string | null
  previousOrderNumber: string | null
  lastDeliveredAt: Date | null
  /** The bag was last handed to the customer standing here. */
  sameCustomer: boolean
  /** It belongs to someone else — staff must confirm before reuse (Rule 10). */
  requiresAuthorization: boolean
  /** Was actually out with a customer, rather than ordinary stock. */
  wasWithCustomer: boolean
  reusable: boolean
  blockedReason: string | null
}

/**
 * Look up a scanned bag and report its provenance WITHOUT changing anything.
 * The caller shows this to the executive, who decides: use this bag, or issue a
 * new one. Nothing is silently reassigned (§9).
 */
export async function identifyReturnedBag(opts: {
  lbId: string
  code: string
  customerId?: string | null
}): Promise<LifecycleResult<{ bag: ReturnedBagInfo }>> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "A bag code is required" }

  const bag = await prisma.laundryBag.findFirst({
    where: { businessId: opts.lbId, OR: [{ bagNumber: code }, { qrValue: code }] },
  })
  if (!bag) return { ok: false, status: 404, error: `Bag "${code}" is not registered.`, code: "UNKNOWN_BAG" }

  const lastUsage = await prisma.laundryBagAssignment.findFirst({
    where: { bagId: bag.id },
    orderBy: { assignedAt: "desc" },
    select: { orderId: true, orderNumber: true, customerId: true, customerName: true, deliveredDate: true },
  })

  const previousCustomerId = bag.currentCustomerId ?? lastUsage?.customerId ?? null
  const sameCustomer = !!opts.customerId && !!previousCustomerId && opts.customerId === previousCustomerId
  const wasWithCustomer = bag.status === BAG_STATUS.HANDED_TO_CUSTOMER

  let blockedReason: string | null = null
  if (bag.status === BAG_STATUS.LOST) blockedReason = "This bag is marked Lost. Staff must clear it before reuse."
  else if (bag.status === BAG_STATUS.RETIRED) blockedReason = "This bag is retired and cannot be reused."
  else if (bag.status === BAG_STATUS.DAMAGED) blockedReason = "This bag is marked Damaged. It must be repaired or retired."
  else if (bag.status === BAG_STATUS.INSPECTION_REQUIRED) blockedReason = "This bag is awaiting inspection."
  else if (!bag.active) blockedReason = "This bag is inactive."

  return {
    ok: true,
    bag: {
      bagId: bag.id, bagNumber: bag.bagNumber, status: bag.status, condition: bag.condition,
      qrDamaged: bag.qrDamaged, custodianType: bag.currentCustodianType,
      previousCustomerId,
      previousCustomerName: bag.currentCustomerName ?? lastUsage?.customerName ?? null,
      previousOrderId: bag.handedToCustomerOrderId ?? lastUsage?.orderId ?? null,
      previousOrderNumber: lastUsage?.orderNumber ?? bag.currentOrderNumber ?? null,
      lastDeliveredAt: bag.handedToCustomerAt ?? lastUsage?.deliveredDate ?? null,
      sameCustomer,
      // Only a bag that actually sits with a DIFFERENT customer needs sign-off.
      requiresAuthorization: wasWithCustomer && !!previousCustomerId && !!opts.customerId && !sameCustomer,
      wasWithCustomer,
      reusable: blockedReason === null,
      blockedReason,
    },
  }
}

// ── Receiving a returned bag (§10) ───────────────────────────────────────────

export interface ReceiveReturnInput {
  lbId: string
  bagId: string
  condition: BagCondition
  /** Present when the return happens during a pickup for a specific order. */
  orderId?: string | null
  customerId?: string | null
  storeId?: string | null
  /** Required when the bag was last held by a DIFFERENT customer (Rule 10). */
  authorizedBy?: string | null
  receivedByCustodian?: Custodian
  reason?: string | null
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}

/**
 * Take a bag back from a customer and place it where its CONDITION says it
 * belongs. Returning is not the same as being reusable: only GOOD re-enters
 * stock, minor damage waits for inspection, worse is quarantined (Rule 8).
 *
 * The usage row that was closed as HANDED_TO_CUSTOMER is completed with the
 * return detail — it is never re-opened and never rewritten.
 */
export async function receiveReturnedBag(input: ReceiveReturnInput): Promise<LifecycleResult<{ bagNumber: string; status: BagStatus; condition: BagCondition }>> {
  if (!isCondition(input.condition)) return { ok: false, status: 400, error: "A valid bag condition is required" }

  const bag = await prisma.laundryBag.findFirst({ where: { id: input.bagId, businessId: input.lbId } })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  if (bag.status === BAG_STATUS.RETIRED) return { ok: false, status: 409, error: "This bag is retired and cannot be returned to service." }

  const previousCustomerId = bag.currentCustomerId
  const crossCustomer = bag.status === BAG_STATUS.HANDED_TO_CUSTOMER
    && !!previousCustomerId && !!input.customerId && previousCustomerId !== input.customerId
  if (crossCustomer && !input.authorizedBy) {
    return {
      ok: false, status: 409, code: "AUTHORIZATION_REQUIRED",
      error: `Bag ${bag.bagNumber} was last held by another customer. Authorised staff must confirm before it is reused.`,
    }
  }

  const status = conditionToStatus(input.condition)
  const custodianType = input.receivedByCustodian ?? CUSTODIAN.STORE
  const now = new Date()
  const prevStatus = bag.status

  // Guarded write: whoever gets there first wins, a second concurrent return
  // finds the status already moved and is rejected rather than double-counting.
  const claimed = await prisma.laundryBag.updateMany({
    where: { id: bag.id, status: prevStatus },
    data: {
      status, condition: input.condition,
      currentCustodianType: custodianType,
      currentCustodianId: input.actor?.id ?? null,
      currentCustodianName: input.actor?.name ?? null,
      currentStoreId: input.storeId ?? bag.currentStoreId,
      // The bag is back with the laundry — it is no longer with a customer.
      currentCustomerId: null, currentCustomerName: null,
      handedToCustomerAt: null, handedToCustomerOrderId: null,
      lastReturnedAt: now,
      totalUsageCount: { increment: 1 },
    },
  })
  if (claimed.count === 0) {
    return { ok: false, status: 409, code: "CONCURRENT_RETURN", error: "This bag was just received by someone else." }
  }

  await prisma.$transaction(async (tx) => {
    // Complete the usage row this return closes out — the most recent one that
    // is still open with the customer.
    const usage = await tx.laundryBagAssignment.findFirst({
      where: { bagId: bag.id, status: { in: ["HANDED_TO_CUSTOMER", "ASSIGNED"] } },
      orderBy: { assignedAt: "desc" },
      select: { id: true },
    })
    if (usage) {
      await tx.laundryBagAssignment.update({
        where: { id: usage.id },
        data: {
          status: "RETURNED", returnedAt: now, returnDate: now,
          returnStatus: "RETURNED_TO_STORE",
          conditionAtReturn: input.condition,
          returnedBy: input.actor?.name ?? null,
        },
      })
    }
    await recordBagEvent(tx, {
      bagId: bag.id, bagNumber: bag.bagNumber, businessId: input.lbId,
      action: "RETURNED_BY_CUSTOMER",
      previousStatus: prevStatus, newStatus: status,
      previousCustodianType: bag.currentCustodianType, newCustodianType: custodianType,
      orderId: input.orderId ?? null,
      customerId: previousCustomerId, customerName: bag.currentCustomerName,
      storeId: input.storeId ?? bag.currentStoreId,
      condition: input.condition,
      reason: crossCustomer
        ? `Returned by a different customer — authorised by ${input.authorizedBy}`
        : (input.reason ?? null),
      actor: input.actor,
    })
  })

  return { ok: true, bagNumber: bag.bagNumber, status, condition: input.condition }
}

// ── Customer-held bags (§13) ─────────────────────────────────────────────────

export interface CustomerHeldBag {
  bagId: string
  bagNumber: string
  orderId: string | null
  orderNumber: string | null
  handedOverAt: Date | null
}

/**
 * What this customer is believed to be holding — based on the last recorded
 * physical event, never on an assumption that they owe anything back.
 */
export async function getBagsWithCustomer(lbId: string, customerId: string): Promise<CustomerHeldBag[]> {
  const bags = await prisma.laundryBag.findMany({
    where: { businessId: lbId, currentCustomerId: customerId, status: BAG_STATUS.HANDED_TO_CUSTOMER },
    orderBy: { handedToCustomerAt: "desc" },
    select: { id: true, bagNumber: true, handedToCustomerOrderId: true, currentOrderNumber: true, handedToCustomerAt: true },
  })
  return bags.map((b) => ({
    bagId: b.id, bagNumber: b.bagNumber,
    orderId: b.handedToCustomerOrderId, orderNumber: b.currentOrderNumber,
    handedOverAt: b.handedToCustomerAt,
  }))
}

// ── Explicit human decisions (§11, §15 Rule 11) ──────────────────────────────

/** Flag an unreadable QR without duplicating the bag's identity (§11). */
export async function markQrDamaged(opts: { lbId: string; bagId: string; actor?: BagEventInput["actor"] }): Promise<LifecycleResult> {
  const bag = await prisma.laundryBag.findFirst({ where: { id: opts.bagId, businessId: opts.lbId }, select: { id: true, bagNumber: true, status: true } })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  await prisma.$transaction(async (tx) => {
    await tx.laundryBag.update({ where: { id: bag.id }, data: { qrDamaged: true } })
    await recordBagEvent(tx, {
      bagId: bag.id, bagNumber: bag.bagNumber, businessId: opts.lbId, action: "QR_DAMAGED",
      previousStatus: bag.status, newStatus: bag.status, reason: "QR unreadable — identity preserved", actor: opts.actor,
    })
  })
  return { ok: true }
}

/**
 * Mark a bag lost or retired. Always a deliberate act: nothing in this engine
 * ever reaches these states on its own, however long a customer keeps a bag.
 */
export async function setTerminalState(opts: {
  lbId: string; bagId: string; state: "LOST" | "RETIRED"; reason?: string | null; actor?: BagEventInput["actor"]
}): Promise<LifecycleResult> {
  const bag = await prisma.laundryBag.findFirst({ where: { id: opts.bagId, businessId: opts.lbId }, select: { id: true, bagNumber: true, status: true, currentCustodianType: true, currentCustomerId: true, currentCustomerName: true } })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  const status = opts.state === "LOST" ? BAG_STATUS.LOST : BAG_STATUS.RETIRED
  await prisma.$transaction(async (tx) => {
    await tx.laundryBag.update({
      where: { id: bag.id },
      data: { status, ...(opts.state === "RETIRED" ? { active: false } : {}) },
    })
    await recordBagEvent(tx, {
      bagId: bag.id, bagNumber: bag.bagNumber, businessId: opts.lbId, action: status,
      previousStatus: bag.status, newStatus: status,
      previousCustodianType: bag.currentCustodianType, newCustodianType: bag.currentCustodianType,
      customerId: bag.currentCustomerId, customerName: bag.currentCustomerName,
      reason: opts.reason ?? null, actor: opts.actor,
    })
  })
  return { ok: true }
}

// ── History (§12) ────────────────────────────────────────────────────────────

export async function getBagHistory(lbId: string, bagId: string) {
  const [usages, events] = await Promise.all([
    prisma.laundryBagAssignment.findMany({ where: { bagId, businessId: lbId }, orderBy: { assignedAt: "desc" } }),
    prisma.laundryBagEvent.findMany({ where: { bagId, businessId: lbId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ])
  return { usages, events }
}

// ── Presentation vocabulary (§13) ────────────────────────────────────────────
// Business-friendly names for states staff read on screen. The stored enum is
// UNCHANGED — this is a display layer, so nothing downstream has to care.

export const STATUS_LABEL: Record<string, string> = {
  [BAG_STATUS.AVAILABLE]: "Available",
  [BAG_STATUS.ASSIGNED]: "Assigned",
  [BAG_STATUS.COLLECTED]: "Collected",
  [BAG_STATUS.RECEIVED_AT_STORE]: "At Store",
  [BAG_STATUS.UNDER_AUDIT]: "Under Audit",
  [BAG_STATUS.PROCESSING]: "At Processing Center",
  [BAG_STATUS.READY_FOR_DELIVERY]: "Ready for Delivery",
  [BAG_STATUS.OUT_FOR_DELIVERY]: "Out for Delivery",
  [BAG_STATUS.HANDED_TO_CUSTOMER]: "With Customer",
  [BAG_STATUS.RETURNED_BY_CUSTOMER]: "Returned by Customer",
  [BAG_STATUS.INSPECTION_REQUIRED]: "Inspection Required",
  [BAG_STATUS.DAMAGED]: "Damaged",
  [BAG_STATUS.LOST]: "Lost",
  [BAG_STATUS.RETIRED]: "Retired",
  CLEANING: "Cleaning",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
}

export const CUSTODIAN_LABEL: Record<string, string> = {
  [CUSTODIAN.LAUNDRY]: "Laundry",
  [CUSTODIAN.STORE]: "Store",
  [CUSTODIAN.PROCESSING_CENTER]: "Processing Center",
  [CUSTODIAN.DELIVERY_EXECUTIVE]: "Delivery Executive",
  [CUSTODIAN.CUSTOMER]: "Customer",
}

export const CONDITION_LABEL: Record<string, string> = {
  [BAG_CONDITION.GOOD]: "Good",
  [BAG_CONDITION.MINOR_DAMAGE]: "Minor Damage",
  [BAG_CONDITION.DAMAGED]: "Damaged",
  [BAG_CONDITION.HEAVILY_DAMAGED]: "Heavily Damaged",
  [BAG_CONDITION.UNUSABLE]: "Unusable",
}

/** Human wording for a movement in the bag's timeline. */
export const EVENT_LABEL: Record<string, string> = {
  [DISPOSITION.HANDED_TO_CUSTOMER]: "Handed to customer",
  [DISPOSITION.RETURNED_TO_EXECUTIVE]: "Returned to executive at the door",
  [DISPOSITION.DAMAGED]: "Reported damaged",
  [DISPOSITION.LOST]: "Reported lost",
  RETURNED_BY_CUSTOMER: "Customer returned the bag",
  INSPECTED: "Inspected",
  QR_DAMAGED: "QR marked damaged",
  RETIRED: "Retired from circulation",
  RELEASED: "Released to available stock",
}

export const humanStatus = (s: string | null | undefined) => (s ? STATUS_LABEL[s] ?? s.replace(/_/g, " ") : "—")
export const humanCustodian = (c: string | null | undefined) => (c ? CUSTODIAN_LABEL[c] ?? c.replace(/_/g, " ") : "—")
export const humanCondition = (c: string | null | undefined) => (c ? CONDITION_LABEL[c] ?? c.replace(/_/g, " ") : "—")
export const humanEvent = (a: string | null | undefined) => (a ? EVENT_LABEL[a] ?? a.replace(/_/g, " ") : "—")

/** True when the status is one this module knows about (§17 data review). */
export function isKnownStatus(status: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATUS_LABEL, status)
}

// ── Inspection decision (§15) ────────────────────────────────────────────────

/**
 * Close out an INSPECTION_REQUIRED bag with a condition decision, using the SAME
 * condition→status rule as a customer return — there is one lifecycle, not an
 * admin copy of it. GOOD returns the bag to stock; anything worse keeps it out.
 */
export async function inspectBag(opts: {
  lbId: string
  bagId: string
  condition: BagCondition
  notes?: string | null
  actor?: BagEventInput["actor"]
}): Promise<LifecycleResult<{ bagNumber: string; status: BagStatus }>> {
  if (!isCondition(opts.condition)) return { ok: false, status: 400, error: "A valid bag condition is required" }
  const bag = await prisma.laundryBag.findFirst({
    where: { id: opts.bagId, businessId: opts.lbId },
    select: { id: true, bagNumber: true, status: true, currentCustodianType: true, currentStoreId: true },
  })
  if (!bag) return { ok: false, status: 404, error: "Bag not found." }
  if (bag.status === BAG_STATUS.RETIRED) return { ok: false, status: 409, error: "This bag is retired." }
  // Inspection applies to a bag physically in the laundry's hands — never to one
  // sitting with a customer, which would fabricate a return that never happened.
  if (bag.status === BAG_STATUS.HANDED_TO_CUSTOMER) {
    return { ok: false, status: 409, error: "This bag is with the customer. It must be returned before it can be inspected." }
  }

  const status = conditionToStatus(opts.condition)
  const claimed = await prisma.laundryBag.updateMany({
    where: { id: bag.id, status: bag.status },
    data: { status, condition: opts.condition, ...(status === BAG_STATUS.RETIRED ? { active: false } : {}) },
  })
  if (claimed.count === 0) return { ok: false, status: 409, code: "CONCURRENT_UPDATE", error: "This bag was just updated by someone else." }

  await prisma.$transaction(async (tx) => {
    await recordBagEvent(tx, {
      bagId: bag.id, bagNumber: bag.bagNumber, businessId: opts.lbId, action: "INSPECTED",
      previousStatus: bag.status, newStatus: status,
      previousCustodianType: bag.currentCustodianType, newCustodianType: bag.currentCustodianType,
      storeId: bag.currentStoreId, condition: opts.condition,
      reason: opts.notes ?? null, actor: opts.actor,
    })
  })
  return { ok: true, bagNumber: bag.bagNumber, status }
}
