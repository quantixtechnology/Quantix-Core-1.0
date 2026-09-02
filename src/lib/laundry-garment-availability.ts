// Which order lines the Pricing Matrix cannot price — phrased for the counter.
//
// The server already refuses these: createLaundryOrder and the intake endpoint
// reject a garment × service pair with no active pricing rule. What staff saw
// was the refusal without the reason, so a correct guard looked like a broken
// system. This turns the same fact into a sentence they can act on.
//
// It reads the SAME availability map the guard is derived from — the active
// Pricing Matrix rules, served by GET /api/laundry/garment-services — so a line
// this warns about is exactly a line the server will refuse. No second
// eligibility list, no hardcoded pairing, and nothing is decided here.
//
// SUBSCRIPTION COVER IS A DIFFERENT QUESTION and is deliberately untouched:
// "not included in the plan" means priced normally, "not available" means it
// cannot be ordered at all. The audit screen already shows the former.

/** garmentId → the services it is priced for. Null while it loads. */
export type PricedServices = Record<string, string[]>

export interface AvailabilityLine {
  garmentId?: string | null
  serviceId?: string | null
  garmentName?: string | null
  serviceName?: string | null
}

export interface UnavailableLine {
  garmentName: string
  serviceName: string
  /** One sentence, no ids, no codes, no status numbers. */
  message: string
}

/**
 * Every line whose service cannot price its garment, in order, one row per
 * distinct pair.
 *
 * Returns nothing while `priced` is null — the map has not loaded, and warning
 * on a guess would be worse than staying quiet. A line missing either id is
 * skipped for the same reason.
 */
export function unavailableOrderLines(
  items: AvailabilityLine[] | null | undefined,
  priced: PricedServices | null | undefined,
): UnavailableLine[] {
  if (!priced) return []
  const seen = new Set<string>()
  const out: UnavailableLine[] = []
  for (const it of items || []) {
    const g = it?.garmentId
    const s = it?.serviceId
    if (!g || !s) continue
    if ((priced[g] || []).includes(s)) continue
    const key = `${g}|${s}`
    if (seen.has(key)) continue
    seen.add(key)
    const garmentName = it.garmentName || "This garment"
    const serviceName = it.serviceName || "the selected service"
    out.push({ garmentName, serviceName, message: `${garmentName} is not available for ${serviceName}.` })
  }
  return out
}

// ── Selection-time availability ─────────────────────────────────────────────
//
// The same question as unavailableOrderLines above, asked one row at a time and
// BEFORE the save rather than after the refusal. It reads the identical
// PricedServices map — the active Pricing Matrix rules served by
// GET /api/laundry/garment-services, which is derived from the same condition
// resolveLineRule() prices by — so there is no second eligibility matrix and a
// pair this allows is exactly a pair the server will accept.
//
// The SERVER REMAINS THE AUTHORITY. Nothing here bypasses, weakens or replaces
// SERVICE_NOT_AVAILABLE_FOR_GARMENT; this only stops the operator reaching it
// blind, with a form they cannot diagnose.

/**
 * Can this garment be recorded under this service?
 *
 * Unknown (`priced` still loading, or either id missing) answers TRUE: the
 * screen must never block a save on a guess. The server still refuses.
 */
export function garmentAvailableForService(
  garmentId: string | null | undefined,
  serviceId: string | null | undefined,
  priced: PricedServices | null | undefined,
): boolean {
  if (!priced || !garmentId || !serviceId) return true
  return (priced[garmentId] || []).includes(serviceId)
}

export interface UnavailableNotice {
  /** "Not available for Wash & Fold" */
  title: string
  /** The full sentence, naming the garment, the service and the way out. */
  detail: string
  /** "Blanket (Single) — Not available for Wash & Fold" — for a dropdown row. */
  optionLabel: string
}

/**
 * Why this pair cannot be recorded, in the operator's words — or null when it
 * can. Names BOTH the garment and the service, because "which one is wrong?"
 * is the question the old failed-save left unanswered.
 */
export function unavailableNotice(
  garmentName: string | null | undefined,
  serviceName: string | null | undefined,
): UnavailableNotice {
  const g = (garmentName || "").trim() || "This garment"
  const s = (serviceName || "").trim() || "the selected service"
  return {
    title: `Not available for ${s}`,
    detail: `${g} cannot be processed under ${s}. Select a supported garment or change the service.`,
    optionLabel: `${g} — Not available for ${s}`,
  }
}

/** The garment ids a service can actually price, for narrowing a picker. */
export function garmentsForService(
  serviceId: string | null | undefined,
  priced: PricedServices | null | undefined,
): Set<string> | null {
  if (!priced || !serviceId) return null
  const out = new Set<string>()
  for (const [garmentId, services] of Object.entries(priced)) {
    if (services.includes(serviceId)) out.add(garmentId)
  }
  return out
}
