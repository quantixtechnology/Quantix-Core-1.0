// ============================================================================
// Laundry Subscription CONSUMPTION engine (Parts 5/6/9/10/13).
//
// A subscription only changes BILLING. It never touches the workflow: order,
// packet, garments, barcodes, routing, QC and delivery are produced by the
// frozen Operations Engine exactly as for a walk-in order. This module runs
// AFTER an order is created at full regular price and decides how much of that
// already-computed charge an active subscription allowance covers.
//
// Pricing is NEVER duplicated: the per-unit price + line amount are read from
// the persisted order snapshot (which the frozen Billing Resolver produced), so
// the extra (uncovered) charge is exactly the regular price for the remainder.
//
// Rules honoured here:
//   • KG and PIECE allowances, independently or together (Part 2/5).
//   • Service + garment eligibility with per-garment mode (Parts 3/4/5).
//   • Split billing when the allowance runs out (Part 6/9).
//   • Only ONE subscription may consume a given garment (Part 13) — a line is
//     assigned to the first eligible subscription with capacity; the remainder
//     is billed at regular price, never drawn from a second subscription.
// ============================================================================

export type AllowanceMode = "PER_KG" | "PER_PIECE"

export interface CoverageRule { serviceId: string; garmentId: string | null; mode: AllowanceMode }

export interface SubForCoverage {
  id: string
  remainingKg: number
  remainingPieces: number
  rules: CoverageRule[]
}

export interface CoverLine {
  itemId: string
  serviceId: string | null
  garmentId: string | null
  quantity: number   // 1 for an exploded PER_PIECE garment; whole line for PER_KG
  weightKg: number   // 0 when not weight-measured
  unitPrice: number  // per-piece or per-kg — from the frozen snapshot
  lineAmount: number // regular charge for the whole line — from the frozen snapshot
}

export interface LineCoverage {
  itemId: string
  subscriptionId: string | null
  mode: AllowanceMode | null
  coveredKg: number
  coveredPieces: number
  coveredAmount: number // value met by the subscription
  extraAmount: number   // remainder billed at the regular (frozen) price
}

export interface CoverageResult {
  lines: LineCoverage[]
  coveredAmount: number
  extraAmount: number
  perSub: Record<string, { consumedKg: number; consumedPieces: number }>
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Most-specific eligibility rule for a line in a subscription: a garment-scoped
// rule wins over a service-wide (garmentId=null) rule; null if not eligible.
function matchRule(sub: SubForCoverage, serviceId: string | null, garmentId: string | null): CoverageRule | null {
  if (!serviceId) return null
  const forService = sub.rules.filter((r) => r.serviceId === serviceId)
  return (
    forService.find((r) => r.garmentId && r.garmentId === garmentId) ||
    forService.find((r) => r.garmentId == null) ||
    null
  )
}

/**
 * Decide subscription coverage for a set of order lines. Pure — no DB, no
 * pricing recomputation. Subscriptions are consumed in the order given
 * (priority order); each line is covered by at most one subscription.
 */
export function computeCoverage(subsInput: SubForCoverage[], lines: CoverLine[]): CoverageResult {
  // Work on local balance copies so the caller's inputs are untouched.
  const subs = subsInput.map((s) => ({ ...s }))
  const perSub: Record<string, { consumedKg: number; consumedPieces: number }> = {}
  for (const s of subs) perSub[s.id] = { consumedKg: 0, consumedPieces: 0 }

  const out: LineCoverage[] = []
  let coveredTotal = 0

  for (const line of lines) {
    let cov: LineCoverage = { itemId: line.itemId, subscriptionId: null, mode: null, coveredKg: 0, coveredPieces: 0, coveredAmount: 0, extraAmount: r2(line.lineAmount) }

    for (const sub of subs) {
      const rule = matchRule(sub, line.serviceId, line.garmentId)
      if (!rule) continue

      if (rule.mode === "PER_PIECE") {
        const need = line.quantity > 0 ? line.quantity : 1
        if (sub.remainingPieces >= need) {
          sub.remainingPieces -= need
          perSub[sub.id].consumedPieces += need
          cov = { itemId: line.itemId, subscriptionId: sub.id, mode: "PER_PIECE", coveredKg: 0, coveredPieces: need, coveredAmount: r2(line.lineAmount), extraAmount: 0 }
          break // one subscription per garment
        }
        // not enough pieces in THIS sub → do not spill to another (Part 13);
        // the whole line stays regular unless a later rule/mode covers it.
        continue
      }

      // PER_KG
      if (rule.mode === "PER_KG") {
        const w = line.weightKg > 0 ? line.weightKg : 0
        if (w <= 0 || sub.remainingKg <= 0) continue
        const coveredKg = Math.min(sub.remainingKg, w)
        sub.remainingKg = r2(sub.remainingKg - coveredKg)
        perSub[sub.id].consumedKg = r2(perSub[sub.id].consumedKg + coveredKg)
        const coveredAmount = r2(coveredKg * line.unitPrice)
        cov = {
          itemId: line.itemId, subscriptionId: sub.id, mode: "PER_KG",
          coveredKg: r2(coveredKg), coveredPieces: 0,
          coveredAmount, extraAmount: r2(Math.max(0, line.lineAmount - coveredAmount)),
        }
        break // one subscription per garment (remainder billed regular)
      }
    }

    coveredTotal = r2(coveredTotal + cov.coveredAmount)
    out.push(cov)
  }

  const extraTotal = r2(lines.reduce((n, l) => n + l.lineAmount, 0) - coveredTotal)
  return { lines: out, coveredAmount: coveredTotal, extraAmount: extraTotal, perSub }
}
