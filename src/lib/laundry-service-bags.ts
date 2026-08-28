// ============================================================================
// SERVICE-LEVEL BAG ACCOUNTING — one service order, its own bag requirement,
// its own physical bags, its own completion.
//
// The rule this exists to enforce:
//
//     A service is bag-complete when the bags assigned TO THAT SERVICE meet
//     THAT SERVICE's requirement. The parent order is complete only when every
//     service is. A total that happens to add up means nothing.
//
// Two Wash & Fold bags must never make Dry Clean look accounted for. That is
// what a whole-order count cannot express, and it is why this groups first and
// counts second.
//
// The requirement comes from LaundryOrderService.requiredBags — never from the
// number of services, the number of bags already assigned, the garment count,
// deliveryBagNumber, or services[0].
// ============================================================================
import type { OrderBag } from "@/lib/laundry-order-bags"

/** One service on the order, with the bag requirement it was booked with. */
export interface ServiceRequirement {
  serviceId: string | null
  serviceName: string
  requiredBags: number
}

export interface ServiceBagLine {
  serviceId: string | null
  serviceName: string
  required: number
  assigned: number
  bags: OrderBag[]
  complete: boolean
  /** "2 / 2" — what the operator reads. */
  label: string
}

export interface ServiceBagAccounting {
  services: ServiceBagLine[]
  /** Bags on the order that match no booked service — surfaced, never counted
   *  towards a requirement they cannot prove. */
  unmatched: OrderBag[]
  totalRequired: number
  totalAssigned: number
  /**
   * There is a per-service requirement to check at all. An order with no booked
   * service rows has none — callers must fall back to their existing rule
   * rather than treating "no requirement" as "requirement failed", which would
   * make such an order permanently incomplete.
   */
  applicable: boolean
  /** Every service has met its OWN requirement. Meaningless unless `applicable`. */
  complete: boolean
  /** "3 / 4 bags" */
  summary: string
  /** Operator-facing reason while incomplete, naming the short services. */
  message: string | null
}

/** Bags and services are matched on service id, falling back to the name. */
const keyOf = (serviceId: string | null | undefined, serviceName: string | null | undefined) =>
  (serviceId && serviceId.trim()) || (serviceName || "").trim().toUpperCase() || ""

/** A requirement is at least 1 — a booked service always needs a bag. */
export const normaliseRequired = (n: number | null | undefined) =>
  Number.isFinite(n) && (n as number) > 0 ? Math.floor(n as number) : 1

/**
 * Account an order's physical bags against its service requirements.
 *
 * `bags` is the authoritative assignment list (orderBags) — closed rows
 * included, because a bag handed to the customer was still received for that
 * service.
 */
export function accountBagsByService(
  services: ServiceRequirement[],
  bags: OrderBag[],
): ServiceBagAccounting {
  const byKey = new Map<string, OrderBag[]>()
  for (const b of bags) {
    const k = keyOf(b.serviceId, b.serviceName)
    const arr = byKey.get(k)
    if (arr) arr.push(b)
    else byKey.set(k, [b])
  }

  const claimed = new Set<string>()
  const lines: ServiceBagLine[] = services.map((s) => {
    const k = keyOf(s.serviceId, s.serviceName)
    claimed.add(k)
    const mine = byKey.get(k) ?? []
    const required = normaliseRequired(s.requiredBags)
    const assigned = mine.length
    return {
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      required,
      assigned,
      bags: mine,
      complete: assigned >= required,
      label: `${assigned} / ${required}`,
    }
  })

  const unmatched: OrderBag[] = []
  for (const [k, arr] of byKey) if (!claimed.has(k)) unmatched.push(...arr)

  const totalRequired = lines.reduce((n, l) => n + l.required, 0)
  const totalAssigned = lines.reduce((n, l) => n + l.assigned, 0)
  const short = lines.filter((l) => !l.complete)

  return {
    services: lines,
    unmatched,
    totalRequired,
    totalAssigned,
    applicable: lines.length > 0,
    // EVERY service, individually. Never the totals.
    complete: lines.length > 0 && short.length === 0,
    summary: `${totalAssigned} / ${totalRequired} bags`,
    message: short.length === 0
      ? null
      : short
          .map((l) => `${l.serviceName} has ${l.required - l.assigned} bag${l.required - l.assigned === 1 ? "" : "s"} outstanding (${l.label})`)
          .join(" · "),
  }
}

/**
 * Which service a scanned bag belongs to.
 *
 * A one-service order needs no operator decision — there is only one answer, so
 * the existing single-service flow keeps working with no extra step. With more
 * than one service the operator MUST choose: guessing (services[0]) is the bug
 * this replaces, and a wrong guess silently mis-files a physical bag.
 */
export type ServicePick =
  | { ok: true; service: ServiceRequirement }
  | { ok: false; error: string; needsChoice: boolean }

export function pickServiceForBag(
  services: ServiceRequirement[],
  requestedServiceId: string | null | undefined,
): ServicePick {
  if (services.length === 0) {
    // An order with no booked services still accepts a bag — offline/store
    // orders exist and must not be blocked. It is simply unattributed.
    return { ok: true, service: { serviceId: null, serviceName: "Laundry", requiredBags: 1 } }
  }
  const wanted = (requestedServiceId || "").trim()
  if (!wanted) {
    if (services.length === 1) return { ok: true, service: services[0] }
    return {
      ok: false,
      needsChoice: true,
      error: `This order has ${services.length} services — choose which one this bag belongs to.`,
    }
  }
  const found = services.find((s) => s.serviceId === wanted)
  if (!found) {
    return { ok: false, needsChoice: true, error: "That service is not on this order." }
  }
  return { ok: true, service: found }
}
