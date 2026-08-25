// Which services a garment can actually be ordered under.
//
// There is no second eligibility table and no hardcoded pairing: a garment ×
// service is orderable exactly when the Pricing Matrix has an ACTIVE rule for
// that pair, which is the same condition resolveLineRule() uses to price it —
//
//     r.isActive && r.serviceId === line.serviceId && r.garmentId === line.garmentId
//
// so "selectable" and "priceable" cannot drift apart. A cell the matrix shows as
// NA has no active rule, which is why New Order could add Blanket + Wash & Fold
// and bill ₹0: nothing matched, and the engine's "No pricing rule" line was
// persisted instead of refused.
//
// Deliberately separate from subscription eligibility. "Not included in the
// subscription" means priced normally; "not available" means it cannot be
// ordered at all. Both live on the same rule row and neither implies the other.
import { prisma } from "@/lib/prisma"

/** garmentId → the ACTIVE services that garment is priced for. */
export async function garmentServiceAvailability(laundryBusinessId: string): Promise<Record<string, string[]>> {
  const [rules, services] = await Promise.all([
    prisma.laundryPricingRule.findMany({
      where: { businessId: laundryBusinessId, isActive: true, garmentId: { not: null }, serviceId: { not: null } },
      select: { garmentId: true, serviceId: true },
    }),
    // An inactive service is not offered even where a rule survives for it.
    prisma.laundryService.findMany({ where: { businessId: laundryBusinessId, isActive: true }, select: { id: true } }),
  ])
  const active = new Set(services.map((s) => s.id))
  const out: Record<string, Set<string>> = {}
  for (const r of rules) {
    if (!r.garmentId || !r.serviceId || !active.has(r.serviceId)) continue
    ;(out[r.garmentId] ??= new Set()).add(r.serviceId)
  }
  return Object.fromEntries(Object.entries(out).map(([g, s]) => [g, [...s]]))
}

export interface PricedLine {
  serviceId: string | null
  serviceName: string
  garmentName: string
  pricingRuleId: string | null
}

/**
 * The first line the Pricing Matrix cannot price, phrased for the person who
 * chose it. Returns null when every line matched a rule.
 *
 * Reads `pricingRuleId`, which is the engine's own matchedRuleId — so this
 * refuses precisely what the engine could not price, rather than guessing from
 * a zero total (a genuinely free service is priced by a real rule and stays
 * allowed).
 */
export function unavailableCombinationError(lines: PricedLine[]): string | null {
  const bad = lines.find((l) => !l.pricingRuleId)
  if (!bad) return null
  return `${bad.serviceName} is not available for ${bad.garmentName}. Please select an available service.`
}
