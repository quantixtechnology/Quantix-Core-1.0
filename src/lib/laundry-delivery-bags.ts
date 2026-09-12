// Delivery over the order's FINAL bag set.
//
// An order may have been packed into several bags (Sorting sets the plan,
// Packing may add to it), and the customer receives ALL of them. Delivery
// therefore reads the same authority every other stage reads —
// LaundryBagAssignment, via orderBags() — and requires every bag to be
// ACCOUNTED FOR before the handover is complete.
//
// ACCOUNTED FOR, not scanned. A bag scan must be TRACKED, but a bag scan must
// never STRAND a delivery: an executive standing at a customer's door with a
// torn QR label cannot be left unable to finish the job. So a bag is accounted
// for when it is either
//   1. scanned and confirmed, or
//   2. explicitly recorded as a scan EXCEPTION, with a reason and an actor.
// There is no bypass flag, and the client cannot simply declare a bag done —
// both paths write a record the gate then re-reads from the database.
//
// NO SCHEMA CHANGE. Confirmation and exception are both APPEND-ONLY events
// (LaundryBagEvent, already indexed by orderId, already carrying reason/actor)
// rather than new columns, so nothing existing is migrated, nothing is
// comma-packed into LaundryOrder.deliveryBagNumber, and both are part of the
// bag's permanent history rather than a status that overwrites itself.
//
// LaundryOrder.deliveryBagNumber is left alone. It stays readable for orders
// that pre-date the assignment rows (legacy compatibility) and is never written
// with more than one code.
import { prisma } from "@/lib/prisma"
import { orderBags, addBagToOrder, type OrderBag } from "@/lib/laundry-order-bags"
import { accountBagsByService, pickServiceForBag, type ServiceBagAccounting, type ServiceRequirement } from "@/lib/laundry-service-bags"
import { CUSTODIAN } from "@/lib/laundry-bag-lifecycle"
import type { BagConflict } from "@/lib/laundry-bag-assign"

/** The event action that records "this bag was scanned onto the delivery". */
export const DELIVERY_BAG_CONFIRMED = "DELIVERY_BAG_CONFIRMED"
/** The event action that records "this bag could not physically be scanned". */
export const DELIVERY_BAG_EXCEPTION = "DELIVERY_BAG_SCAN_EXCEPTION"

/**
 * The ONLY reasons a bag may go unscanned. A free-text reason is not accepted:
 * management needs to count "how often are labels failing", which requires a
 * closed set.
 */
export const EXCEPTION_REASONS = {
  QR_UNREADABLE: "QR damaged / unreadable",
  BAG_UNAVAILABLE: "Bag not available",
  OTHER: "Other",
} as const
export type ExceptionReasonCode = keyof typeof EXCEPTION_REASONS
export const EXCEPTION_REASON_CODES = Object.keys(EXCEPTION_REASONS) as ExceptionReasonCode[]
export const isExceptionReason = (v: unknown): v is ExceptionReasonCode =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(EXCEPTION_REASONS, v)

/** "Other" is not a reason on its own — it has to say what actually happened. */
export const REASON_REQUIRES_NOTE: ExceptionReasonCode[] = ["OTHER"]
const NOTE_MAX = 300

/**
 * Encoded into LaundryBagEvent.reason as `CODE` or `CODE: note` — one existing
 * column, no migration, and still legible to a human reading bag history.
 */
export const encodeExceptionReason = (code: ExceptionReasonCode, note: string | null) =>
  note ? `${code}: ${note}` : code

export interface DeliveryBagException {
  code: ExceptionReasonCode
  /** Human-facing reason, for the app and for the audit trail. */
  label: string
  note: string | null
  at: Date
  byId: string | null
  byName: string | null
}

export function parseExceptionReason(raw: string | null | undefined, at: Date, byId: string | null, byName: string | null): DeliveryBagException {
  const text = String(raw || "").trim()
  const sep = text.indexOf(":")
  const head = (sep === -1 ? text : text.slice(0, sep)).trim()
  const note = sep === -1 ? null : text.slice(sep + 1).trim() || null
  // An unrecognised historical value degrades to OTHER carrying its own text,
  // so an old or hand-written record is never silently blank in the audit.
  const code: ExceptionReasonCode = isExceptionReason(head) ? head : "OTHER"
  return {
    code,
    label: EXCEPTION_REASONS[code],
    note: isExceptionReason(head) ? note : text || null,
    at, byId, byName,
  }
}

export interface DeliveryBag extends OrderBag {
  confirmed: boolean
  confirmedAt: Date | null
  /** Set only when the bag could not be scanned. Never set alongside confirmed. */
  exception: DeliveryBagException | null
  /** Scanned OR excepted — the unit the completion gate counts. */
  accounted: boolean
}

export interface DeliveryBagsView {
  bags: DeliveryBag[]
  total: number
  confirmed: number
  exceptions: number
  accounted: number
  /** Every bag accounted for AND every service's own requirement met. */
  complete: boolean
  /** Per-service required-vs-received, so the panel can group by service order. */
  accounting: ServiceBagAccounting
  /** Always present: "2 of 3 bags scanned · 1 exception". */
  summary: string
  /** Operator-facing gate reason while incomplete, else null. */
  message: string | null
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The order's bags with their delivery state.
 *
 * An order with no bags at all is `complete` — a delivery that never had a bag
 * is a legitimate delivery, and the bag rule must not invent a blocker where
 * there is no bag to account for.
 */
export async function deliveryBags(lbId: string, orderId: string): Promise<DeliveryBagsView> {
  // Scope to THIS order's DELIVERY set. An assignment row is closed (RETURNED)
  // when the bag is released, so pickup/sorting rows an order has closed are
  // HISTORY — they are not bags being handed over today. Nothing in the
  // codebase writes purpose "DELIVERY" (Packing leaves purpose null and keeps
  // its row open), so the only faithful signal of a real delivery bag is an
  // OPEN assignment. The accounting below compares against the order's own
  // requiredBags, never a count of history rows.
  const all = await orderBags(lbId, orderId)
  const bags = all.filter((b) => b.open)
  const events = bags.length
    ? await prisma.laundryBagEvent.findMany({
        where: { businessId: lbId, orderId, action: { in: [DELIVERY_BAG_CONFIRMED, DELIVERY_BAG_EXCEPTION] } },
        select: { bagId: true, action: true, reason: true, actorId: true, actorName: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : []

  const firstConfirm = new Map<string, Date>()
  const firstException = new Map<string, DeliveryBagException>()
  for (const e of events) {
    if (e.action === DELIVERY_BAG_CONFIRMED) {
      if (!firstConfirm.has(e.bagId)) firstConfirm.set(e.bagId, e.createdAt)
    } else if (!firstException.has(e.bagId)) {
      firstException.set(e.bagId, parseExceptionReason(e.reason, e.createdAt, e.actorId ?? null, e.actorName ?? null))
    }
  }

  const rows: DeliveryBag[] = bags.map((b) => {
    const confirmed = firstConfirm.has(b.bagId)
    // A scan wins over an exception: if the bag was ultimately scanned, it was
    // not a failure to scan, whatever was recorded first.
    const exception = confirmed ? null : firstException.get(b.bagId) ?? null
    return {
      ...b,
      confirmed,
      confirmedAt: firstConfirm.get(b.bagId) ?? null,
      exception,
      accounted: confirmed || !!exception,
    }
  })

  const confirmed = rows.filter((r) => r.confirmed).length
  const exceptions = rows.filter((r) => !!r.exception).length
  const accounted = confirmed + exceptions
  const total = rows.length
  const allBagsAccounted = accounted === total // vacuously true when the order has no bags

  // SERVICE-LEVEL REQUIREMENT — a total that adds up proves nothing. Two Wash &
  // Fold bags must never make Dry Clean look accounted for, so each service is
  // checked against its OWN requiredBags using only the bags accounted for at
  // this delivery.
  const services = await prisma.laundryOrderService.findMany({
    where: { orderId },
    select: { serviceId: true, serviceName: true, requiredBags: true },
    orderBy: { createdAt: "asc" },
  })
  const accounting = accountBagsByService(services as ServiceRequirement[], rows.filter((r) => r.accounted))

  // An order that never had a bag stays deliverable — a bagless delivery is
  // legitimate and the rule must not invent a blocker where there is no bag.
  // Nor may an order with bags but no booked service rows become undeliverable:
  // no requirement is not a failed requirement, so the existing every-bag rule
  // stands on its own there. Only a real requirement can add to the gate.
  const requirementMet = accounting.applicable ? accounting.complete : true
  // `all.length === 0` (not `total === 0`): an order whose assignment HISTORY
  // has rows but whose CURRENT delivery set is empty is a real order that has
  // not been given its delivery bag — that must block when a service requires
  // one, while an order that never had a row stays deliverable.
  const complete = all.length === 0 ? true : allBagsAccounted && requirementMet

  const noDeliverySet = total === 0 && all.length > 0
  return {
    bags: rows,
    total,
    confirmed,
    exceptions,
    accounted,
    complete,
    accounting,
    summary: noDeliverySet
      ? accounting.summary
      : `${confirmed} of ${total} bags scanned${exceptions ? ` · ${plural(exceptions, "exception")}` : ""}`,
    message: complete
      ? null
      : !allBagsAccounted
        ? `${confirmed} of ${total} bags scanned. Scan the remaining ${plural(total - accounted, "bag")}, or record a scan exception, before completing delivery.`
        : noDeliverySet
          ? `No delivery bag assigned yet — ${accounting.summary}. ${accounting.message}`
          : `${accounting.summary} accounted for — ${accounting.message}`,
  }
}

/** Match a scanned code against THIS order's own bags. Nothing else can match. */
function findOnOrder(view: DeliveryBagsView, code: string) {
  const wanted = code.toUpperCase()
  return view.bags.find((b) => b.bagNumber.toUpperCase() === wanted || b.qrValue.toUpperCase() === wanted)
}

async function orderHeader(lbId: string, orderId: string) {
  return prisma.laundryOrder.findFirst({
    where: { id: orderId, businessId: lbId },
    select: { orderNumber: true, customerId: true, storeId: true },
  })
}

export type ConfirmResult =
  | { ok: true; bagNumber: string; confirmed: number; total: number; complete: boolean; alreadyConfirmed: boolean }
  | { ok: false; status: number; error: string }

/**
 * Confirm ONE scanned bag onto this order's delivery.
 *
 * Order-safe by construction: the scanned code is matched against THIS order's
 * own bag list, so a bag belonging to another order, another tenant, or to no
 * order at all simply is not found and is refused by name. Re-scanning a bag
 * already confirmed is a no-op that writes no second event.
 */
export async function confirmDeliveryBag(opts: {
  lbId: string
  orderId: string
  code: string
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}): Promise<ConfirmResult> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "Scan a bag to confirm it." }

  const view = await deliveryBags(opts.lbId, opts.orderId)
  const bag = findOnOrder(view, code)
  if (!bag) {
    // Named explicitly: the executive needs to know it is the wrong bag, not
    // that "something went wrong".
    return { ok: false, status: 409, error: `Bag ${code} does not belong to this order.` }
  }

  if (bag.confirmed) {
    return { ok: true, bagNumber: bag.bagNumber, confirmed: view.confirmed, total: view.total, complete: view.complete, alreadyConfirmed: true }
  }

  const order = await orderHeader(opts.lbId, opts.orderId)
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  // Append-only: the confirmation joins the bag's history and overwrites no
  // status. The bag's actual custody moves at delivery completion, through the
  // existing applyDeliveryDisposition().
  await prisma.laundryBagEvent.create({
    data: {
      bagId: bag.bagId, bagNumber: bag.bagNumber, businessId: opts.lbId,
      action: DELIVERY_BAG_CONFIRMED,
      orderId: opts.orderId, orderNumber: order.orderNumber,
      customerId: order.customerId, storeId: order.storeId,
      actorId: opts.actor?.id ?? null, actorName: opts.actor?.name ?? null, actorRole: opts.actor?.role ?? null,
    },
  })

  const after = await deliveryBags(opts.lbId, opts.orderId)
  return { ok: true, bagNumber: bag.bagNumber, confirmed: after.confirmed, total: after.total, complete: after.complete, alreadyConfirmed: false }
}

export type ExceptionResult =
  | { ok: true; bagNumber: string; reason: ExceptionReasonCode; note: string | null; accounted: number; total: number; complete: boolean; alreadyExcepted: boolean }
  | { ok: false; status: number; error: string }

/**
 * Record that ONE bag of this order could not physically be scanned.
 *
 * This is the ONLY way past the scan requirement, and it is not a bypass: the
 * bag must be one of this order's own bags, the reason must be one of the known
 * codes, "Other" must say what happened, and the result is a permanent event
 * naming the bag, the order, the executive, the reason and the time. The gate
 * then re-reads that record — it never trusts a client claim.
 *
 * The bag is NOT dispositioned here. It keeps its assignment, its custody and
 * its place in the order, and moves with every other bag when the delivery
 * completes through applyDeliveryDisposition().
 */
export async function recordDeliveryBagException(opts: {
  lbId: string
  orderId: string
  code: string
  reason: unknown
  note?: unknown
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}): Promise<ExceptionResult> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "Select the bag that could not be scanned." }

  if (!isExceptionReason(opts.reason)) {
    return { ok: false, status: 400, error: "Select a reason for the bag scan exception." }
  }
  const reason = opts.reason
  const note = String(opts.note ?? "").trim().slice(0, NOTE_MAX) || null
  if (REASON_REQUIRES_NOTE.includes(reason) && !note) {
    return { ok: false, status: 400, error: `Add a short note explaining the exception when the reason is "${EXCEPTION_REASONS.OTHER}".` }
  }

  const view = await deliveryBags(opts.lbId, opts.orderId)
  // The SAME membership check a scan gets. An exception cannot conjure a bag
  // onto the order, and a wrong bag cannot be turned into an accounted one.
  const bag = findOnOrder(view, code)
  if (!bag) return { ok: false, status: 409, error: `Bag ${code} does not belong to this order.` }

  if (bag.confirmed) {
    // It was scanned. There is nothing to except, and recording one would make
    // the audit trail read as a failure that did not happen.
    return { ok: false, status: 409, error: `Bag ${bag.bagNumber} was already scanned.` }
  }
  if (bag.exception) {
    return { ok: true, bagNumber: bag.bagNumber, reason: bag.exception.code, note: bag.exception.note, accounted: view.accounted, total: view.total, complete: view.complete, alreadyExcepted: true }
  }

  const order = await orderHeader(opts.lbId, opts.orderId)
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  await prisma.laundryBagEvent.create({
    data: {
      bagId: bag.bagId, bagNumber: bag.bagNumber, businessId: opts.lbId,
      action: DELIVERY_BAG_EXCEPTION,
      orderId: opts.orderId, orderNumber: order.orderNumber,
      customerId: order.customerId, storeId: order.storeId,
      reason: encodeExceptionReason(reason, note),
      actorId: opts.actor?.id ?? null, actorName: opts.actor?.name ?? null, actorRole: opts.actor?.role ?? null,
    },
  })

  const after = await deliveryBags(opts.lbId, opts.orderId)
  return { ok: true, bagNumber: bag.bagNumber, reason, note, accounted: after.accounted, total: after.total, complete: after.complete, alreadyExcepted: false }
}

export type AssignDeliveryBagResult =
  | {
      ok: true
      bag: OrderBag
      view: DeliveryBagsView
      alreadyOnOrder: boolean
      alreadyConfirmed: boolean
    }
  | { ok: false; status: number; error: string; conflict?: BagConflict }

/**
 * Assign a bag to the order's DELIVERY set, from the counter.
 *
 * This is the missing half of the Ready for Delivery screen: an order whose bag
 * set is empty shows "No delivery bag assigned yet" but, until now, had NO way
 * to put the physical bag the customer will take onto the order. It reuses the
 * exact building blocks every other stage uses, in the exact order, so no new
 * rule is invented here:
 *
 *   1. pickServiceForBag — one-service orders pick automatically; a multi-
 *      service order must say which service this bag belongs to.
 *   2. addBagToOrder — the guarded front door on assignBagToOrder(), which
 *      already refuses members of another tenant, bags held by another order,
 *      and damaged/lost/cleaning bags, and is idempotent on re-assign.
 *   3. confirmDeliveryBag — records the DELIVERY_BAG_CONFIRMED event the gate
 *      re-reads, so the same action a scan performs closes the gate here.
 *
 * The bag becomes a plain OPEN assignment (purpose null, exactly like Packing's
 * growth rows) and moves to the customer with every other bag when delivery
 * completes through the existing applyDeliveryDisposition(). The executive flow
 * does not call this helper and is unchanged.
 */
export async function assignDeliveryBagToOrder(opts: {
  lbId: string
  orderId: string
  code: string
  serviceId?: string | null
  actor?: { id?: string | null; name?: string | null; role?: string | null }
}): Promise<AssignDeliveryBagResult> {
  const code = String(opts.code || "").trim()
  if (!code) return { ok: false, status: 400, error: "Scan or enter the delivery bag to assign it." }

  const order = await orderHeader(opts.lbId, opts.orderId)
  if (!order) return { ok: false, status: 404, error: "Order not found" }

  const services = await prisma.laundryOrderService.findMany({
    where: { orderId: opts.orderId },
    select: { serviceId: true, serviceName: true, requiredBags: true },
    orderBy: { createdAt: "asc" },
  })
  const pick = pickServiceForBag(services as ServiceRequirement[], opts.serviceId)
  if (!pick.ok) return { ok: false, status: 400, error: pick.error }

  const alreadyOnOrder = !!(await orderBags(opts.lbId, opts.orderId))
    .find((b) => b.bagNumber.toUpperCase() === code.toUpperCase() || b.qrValue.toUpperCase() === code.toUpperCase())

  const res = await addBagToOrder({
    lbId: opts.lbId,
    orderId: opts.orderId,
    code,
    serviceId: pick.service.serviceId,
    serviceName: pick.service.serviceName,
    custodian: CUSTODIAN.STORE,
  })
  if (!res.ok) return { ok: false, status: res.status, error: res.error, conflict: res.conflict }

  // The bag is ON the order now, so the same confirmation a scan performs also
  // applies here — the gate reads the same event either way.
  const confirm = await confirmDeliveryBag({ lbId: opts.lbId, orderId: opts.orderId, code, actor: opts.actor })
  if (!confirm.ok) return { ok: false, status: confirm.status, error: confirm.error }

  return {
    ok: true,
    bag: res.bag,
    view: await deliveryBags(opts.lbId, opts.orderId),
    alreadyOnOrder,
    alreadyConfirmed: confirm.alreadyConfirmed,
  }
}

/**
 * The bag half of the delivery completion gate.
 *
 * Returns null when delivery may proceed, or the operator-facing reason when it
 * may not. Deliberately ONLY about bags: payment, Pay Later and OTP are not
 * consulted here and their existing rules are untouched.
 */
export async function deliveryBagGate(lbId: string, orderId: string): Promise<string | null> {
  const view = await deliveryBags(lbId, orderId)
  return view.complete ? null : view.message
}
