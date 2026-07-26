import { describe, it, expect } from 'vitest'
import { perKgStrategy } from '@/lib/laundry-billing-strategies'
import { computeCoverage, type SubForCoverage, type CoverLine } from '@/lib/laundry-subscription-consumption'

// ============================================================================
// KG subscription coverage at Store Audit.
//
// A PER_KG order is billed ONCE at audit (total weight × rate) and the amount is
// allocated across the garment lines. For a customer on a KG subscription those
// garments must NOT be billed — the eligible KG is consumed from the allowance
// and only the uncovered remainder stays as balance due.
//
// The regression this guards: perKgStrategy used to allocate only lineAmount, so
// each item's weightKg stayed 0 and computeCoverage's PER_KG branch (which keys
// off line.weightKg) covered nothing → subscribed customers were billed in full.
// ============================================================================

// 4 garments, all PER_KG @ ₹100/kg, order weighed at 0.80kg → ₹80.
const kgLines = (qty = 1, count = 4) =>
  Array.from({ length: count }, () => ({ pricingType: 'PER_KG', quantity: qty, unitPrice: 100, gstPercent: 0 }))

function toCoverLines(): CoverLine[] {
  const priced = perKgStrategy.price(kgLines(), { totalWeightKg: 0.8 })
  return priced.map((p, i) => ({
    itemId: `it-${i}`, serviceId: 'svc-wash', garmentId: null,
    quantity: 1, weightKg: p.weightKg || 0, unitPrice: 100, lineAmount: p.lineAmount,
  }))
}

describe('perKgStrategy — per-line weight allocation', () => {
  it('allocates the total order weight across lines (sums to the whole weight)', () => {
    const priced = perKgStrategy.price(kgLines(), { totalWeightKg: 0.8 })
    expect(priced.map((p) => p.weightKg)).toEqual([0.2, 0.2, 0.2, 0.2])
    expect(priced.reduce((s, p) => s + (p.weightKg || 0), 0)).toBeCloseTo(0.8, 5)
    expect(priced.reduce((s, p) => s + p.lineAmount, 0)).toBeCloseTo(80, 5)
  })

  it('last line absorbs rounding for an uneven split (weight still sums exact)', () => {
    const priced = perKgStrategy.price(kgLines(1, 3), { totalWeightKg: 1 })
    expect(priced.reduce((s, p) => s + (p.weightKg || 0), 0)).toBeCloseTo(1, 5)
  })
})

describe('computeCoverage — KG allowance consumes the weighed order', () => {
  const svcRule = { serviceId: 'svc-wash', garmentId: null as string | null, mode: 'PER_KG' as const }

  it('fully covers a subscribed KG order → ₹0 billable, allowance drawn down', () => {
    const subs: SubForCoverage[] = [{ id: 'sub-1', remainingKg: 5, remainingPieces: 0, coverageUnit: 'PER_KG', rules: [svcRule] }]
    const res = computeCoverage(subs, toCoverLines())
    expect(res.coveredAmount).toBeCloseTo(80, 5) // whole bill covered
    expect(res.extraAmount).toBeCloseTo(0, 5)    // nothing owed
    expect(res.perSub['sub-1'].consumedKg).toBeCloseTo(0.8, 5)
  })

  it('splits the bill when the allowance runs out mid-order', () => {
    // 0.50kg left: covers two full lines (0.40) + half of a third (0.10) = ₹50.
    const subs: SubForCoverage[] = [{ id: 'sub-1', remainingKg: 0.5, remainingPieces: 0, coverageUnit: 'PER_KG', rules: [svcRule] }]
    const res = computeCoverage(subs, toCoverLines())
    expect(res.coveredAmount).toBeCloseTo(50, 5)
    expect(res.extraAmount).toBeCloseTo(30, 5)
    expect(res.perSub['sub-1'].consumedKg).toBeCloseTo(0.5, 5)
  })

  it('covers nothing when no garment/service is eligible (bills in full)', () => {
    const subs: SubForCoverage[] = [{ id: 'sub-1', remainingKg: 5, remainingPieces: 0, coverageUnit: 'PER_KG', rules: [{ serviceId: 'svc-other', garmentId: null, mode: 'PER_KG' }] }]
    const res = computeCoverage(subs, toCoverLines())
    expect(res.coveredAmount).toBeCloseTo(0, 5)
    expect(res.extraAmount).toBeCloseTo(80, 5)
  })
})

describe('computeCoverage — CLOTH (piece) plan covers per-KG-priced garments by count', () => {
  // The real-world case: a "70 cloths / cycle" plan whose eligible garments are
  // priced PER_KG. Each garment must consume ONE piece and bill ₹0; only once
  // the piece allowance is exhausted does the per-KG price apply. The pricing
  // matrix mode (PER_KG) is eligibility only — the plan's unit (pieces) drives
  // consumption.
  const svcRule = { serviceId: 'svc-wash', garmentId: null as string | null, mode: 'PER_KG' as const }

  it('covers every eligible per-KG garment for 1 piece each → ₹0 billable', () => {
    const subs: SubForCoverage[] = [{ id: 'sub-1', remainingKg: 0, remainingPieces: 70, coverageUnit: 'PER_PIECE', rules: [svcRule] }]
    const res = computeCoverage(subs, toCoverLines()) // 4 garments, per-KG @ ₹80 total
    expect(res.coveredAmount).toBeCloseTo(80, 5)
    expect(res.extraAmount).toBeCloseTo(0, 5)
    expect(res.perSub['sub-1'].consumedPieces).toBe(4)
    expect(res.perSub['sub-1'].consumedKg).toBe(0) // KG untouched — it's a cloth plan
  })

  it('once the cloth allowance runs out, the overflow bills at the per-KG price', () => {
    // Only 3 pieces left: 3 garments free (₹60), the 4th bills its per-KG line (₹20).
    const subs: SubForCoverage[] = [{ id: 'sub-1', remainingKg: 0, remainingPieces: 3, coverageUnit: 'PER_PIECE', rules: [svcRule] }]
    const res = computeCoverage(subs, toCoverLines())
    expect(res.coveredAmount).toBeCloseTo(60, 5)
    expect(res.extraAmount).toBeCloseTo(20, 5)
    expect(res.perSub['sub-1'].consumedPieces).toBe(3)
  })
})
