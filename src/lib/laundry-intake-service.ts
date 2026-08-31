// ============================================================================
// WHICH SERVICE AN INTAKE MAY USE — the ORDER's answer, never the master list.
//
// A Pickup-First order is booked with a service and no garments: the customer
// chose "Wash & Iron", the bag was collected, and the garments are counted at
// Store Audit. That booked service is already recorded on the order
// (LaundryOrderService) and the intake endpoint already enforces it — ONE
// SERVICE = ONE ORDER refuses any garment carrying a different one.
//
// The intake screens were offering the WHOLE configured services list and
// defaulting to the first of it. So the counter was invited to pick a service
// the server would then refuse, the pick drifted every time a row was added,
// and the order sat at Store Audit with zero garments and no way forward.
//
// This resolves the ONE question those screens should have asked: given what
// this order was booked with, what may the operator choose? Exactly one answer
// means the screen STATES it rather than asking. It decides nothing about
// pricing, availability, subscription cover or the workflow — the server still
// owns all of those, unchanged.
// ============================================================================
import { serviceKey, type ServiceLineLike } from "@/lib/laundry-one-service"

/** A service from the tenant's configured master (GET /api/laundry/services). */
export interface ConfiguredService {
  id: string
  name: string
}

export interface IntakeServiceChoice {
  /** What the picker may offer. Never wider than the order's own services. */
  options: ConfiguredService[]
  /** Exactly one possible answer — state it, do not ask for it. */
  locked: boolean
  /** The pre-selected service id; "" when the operator must choose. */
  serviceId: string
  /** The name to display while locked. */
  lockedName: string | null
}

const norm = (s: string | null | undefined) => String(s || "").trim().toUpperCase()

/**
 * The services an intake on this order may use.
 *
 * `booked` is the order's own service-bearing rows — its LaundryOrderService
 * rows plus any LaundryOrderItem already on it, exactly the set the server
 * checks against. `configured` is the tenant's service master, used only to
 * give a booked service its current name.
 *
 * A booked row carrying only a NAME (a bag booking that never resolved a real
 * service) is offered only when that name matches a configured service — an
 * unresolvable name cannot be priced, and saving it would persist a ₹0
 * "Service" line, which is the billing hole this must not reopen.
 */
export function intakeServiceChoice(
  booked: ServiceLineLike[] | null | undefined,
  configured: ConfiguredService[] | null | undefined,
): IntakeServiceChoice {
  const master = (configured || []).filter((s) => s && s.id)
  const byId = new Map(master.map((s) => [s.id, s]))
  const byName = new Map(master.map((s) => [norm(s.name), s]))

  const seenBooked = new Set<string>()
  const seenOption = new Set<string>()
  const options: ConfiguredService[] = []
  for (const b of booked || []) {
    const key = serviceKey(b)
    if (!key || seenBooked.has(key)) continue
    seenBooked.add(key)
    const hit =
      (b.serviceId ? byId.get(b.serviceId) : undefined) ??
      byName.get(norm(b.serviceName)) ??
      // Booked with a real service that is no longer in the master (retired or
      // renamed). It is still THE service of this order, so it is still the
      // only thing the server will accept — offer it under its booked name.
      (b.serviceId ? { id: b.serviceId, name: b.serviceName || "Booked service" } : null)
    if (!hit || seenOption.has(hit.id)) continue
    seenOption.add(hit.id)
    options.push(hit)
  }

  // The ordinary case: one booked service, so there is nothing to ask.
  if (options.length === 1) {
    return { options, locked: true, serviceId: options[0].id, lockedName: options[0].name }
  }
  // A legacy order carrying two services: both still work, and the operator
  // says which — guessing services[0] is the bug, not the fix.
  if (options.length > 1) {
    return { options, locked: false, serviceId: "", lockedName: null }
  }
  // Nothing booked (a walk-in/offline order, or a booking whose service name
  // matches nothing configured): the first garment ESTABLISHES the service, so
  // it is chosen deliberately from the master rather than defaulted into.
  return { options: master, locked: false, serviceId: "", lockedName: null }
}
