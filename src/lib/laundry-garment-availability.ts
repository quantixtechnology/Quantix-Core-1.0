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
