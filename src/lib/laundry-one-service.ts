// ============================================================================
// ONE SERVICE = ONE ORDER — an order-ENTRY rule, nothing else.
//
// A new order may carry garments for exactly ONE service. Any number of
// garments, one service. Mixing Wash & Iron and Dry Clean in a single order is
// what produced the downstream ambiguity in service orders, bags, audit and
// processing, so it is refused at creation instead of managed afterwards.
//
// What this is NOT:
//   • not a migration — existing multi-service orders are never touched, never
//     split, never rewritten, and keep working through the service-aware bag
//     and workflow code exactly as they do today;
//   • not a bag-lifecycle change;
//   • not the Express/Normal rule, which is a separate constraint and unaffected.
//
// The rule for adding garments to an order that already exists is deliberately
// phrased as "you may never introduce a service the order does not already
// have". On a new one-service order that means "same service only". On a legacy
// two-service order it means both of its services still work — so intake and
// Store Audit continue on those orders — while a third can never appear.
// ============================================================================

export interface ServiceRef {
  serviceId: string | null
  serviceName: string
}

export interface ServiceLineLike {
  serviceId?: string | null
  serviceName?: string | null
}

export type OneServiceVerdict =
  | { ok: true; service: ServiceRef | null }
  | { ok: false; code: "MULTIPLE_SERVICES"; error: string; existingService: string; rejectedService: string }

/** Services are identified by id, falling back to a normalised name. */
export const serviceKey = (s: ServiceLineLike): string =>
  (s.serviceId && String(s.serviceId).trim()) || String(s.serviceName || "").trim().toUpperCase()

/** The distinct services present in a set of lines, in first-seen order. */
export function distinctServices(lines: ServiceLineLike[]): ServiceRef[] {
  const seen = new Map<string, ServiceRef>()
  for (const l of lines) {
    const k = serviceKey(l)
    if (!k || seen.has(k)) continue
    seen.set(k, { serviceId: l.serviceId ?? null, serviceName: String(l.serviceName || "this service") })
  }
  return [...seen.values()]
}

/** The one message every surface shows, with the real service names. */
export const conflictMessage = (existing: string, rejected: string) =>
  `This order already contains garments for ${existing}. Different services cannot be added to the same order. Please create a new order for ${rejected}.`

const refuse = (existing: ServiceRef, rejected: ServiceRef): OneServiceVerdict => ({
  ok: false,
  code: "MULTIPLE_SERVICES",
  error: conflictMessage(existing.serviceName, rejected.serviceName),
  existingService: existing.serviceName,
  rejectedService: rejected.serviceName,
})

/**
 * A NEW order may carry exactly one service.
 *
 * Returns the established service, or null when there are no service-bearing
 * lines at all (a bag-mode/service-only booking establishes it elsewhere).
 */
export function assertSingleServiceOrder(lines: ServiceLineLike[]): OneServiceVerdict {
  const services = distinctServices(lines)
  if (services.length <= 1) return { ok: true, service: services[0] ?? null }
  return refuse(services[0], services[1])
}

/**
 * A garment may only use a service the order ALREADY has — or, on an order with
 * none yet, establish the first one (and the incoming set must itself be
 * single-service).
 *
 * `existing` must be read from the authoritative order state, and on a writer
 * that can race, re-read inside the transaction: two requests that each saw an
 * empty order must not both establish a different service.
 */
export function assertServiceAllowedOnOrder(
  existing: ServiceLineLike[],
  incoming: ServiceLineLike[],
): OneServiceVerdict {
  const have = distinctServices(existing)
  const want = distinctServices(incoming)
  if (want.length === 0) return { ok: true, service: have[0] ?? null }

  // Nothing on the order yet → the first garment establishes the service, and
  // the batch itself must not span more than one.
  if (have.length === 0) return assertSingleServiceOrder(incoming)

  const keys = new Set(have.map(serviceKey))
  const intruder = want.find((w) => !keys.has(serviceKey(w)))
  if (intruder) return refuse(have[0], intruder)
  return { ok: true, service: have[0] }
}

/**
 * The order engine throws on a mixed-service create (it has no NextResponse of
 * its own). Every creation endpoint uses this to answer 400 with the operator
 * message rather than a bare 500.
 */
export function oneServiceError(e: unknown): { error: string; code: string; existingService?: string; rejectedService?: string } | null {
  if (!e || typeof e !== "object") return null
  const x = e as { code?: string; message?: string; existingService?: string; rejectedService?: string }
  if (x.code !== "MULTIPLE_SERVICES") return null
  return { error: x.message || "Different services cannot be added to the same order.", code: x.code, existingService: x.existingService, rejectedService: x.rejectedService }
}
