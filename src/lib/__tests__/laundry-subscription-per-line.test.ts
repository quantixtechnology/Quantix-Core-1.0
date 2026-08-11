import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeCoverage, type SubForCoverage, type CoverLine } from '@/lib/laundry-subscription-consumption'

// The reported scenario. Wash & Fold is subscription eligible and Shirt is an
// included garment; Dry Clean is not eligible, so nothing under it is covered.
const SHIRT = 'g-shirt', BLANKET = 'g-blanket'
const WASH_FOLD = 's-wf', DRY_CLEAN = 's-dc'

// 70-cloth plan. Rules come from subscriptionCoverageRules(): only eligible
// service × eligible garment pairs appear, so Dry Clean has no rule at all.
const sub = (pieces = 70): SubForCoverage => ({
  id: 'sub-1', remainingKg: 0, remainingPieces: pieces, coverageUnit: 'PER_PIECE',
  rules: [{ serviceId: WASH_FOLD, garmentId: SHIRT, mode: 'PER_PIECE' }],
})

const line = (itemId: string, serviceId: string, garmentId: string, lineAmount: number, quantity = 1): CoverLine =>
  ({ itemId, serviceId, garmentId, quantity, weightKg: 0, lineAmount })

describe('Case 1 — Shirt + Wash & Fold is covered', () => {
  const r = computeCoverage([sub()], [line('i1', WASH_FOLD, SHIRT, 70)])
  it('covers the line in full', () => {
    expect(r.coveredAmount).toBe(70)
    expect(r.lines[0].extraAmount).toBe(0)
    expect(r.lines[0].coveredPieces).toBe(1)
  })
})

describe('Case 2 — Blanket + Dry Clean is billed normally', () => {
  const r = computeCoverage([sub()], [line('i1', DRY_CLEAN, BLANKET, 99)])
  it('covers nothing and leaves the full amount payable', () => {
    expect(r.coveredAmount).toBe(0)
    expect(r.lines[0].extraAmount).toBe(99)
    expect(r.lines[0].subscriptionId).toBeNull()
  })

  it('consumes no allowance', () => {
    expect(r.lines[0].coveredPieces).toBe(0)
  })
})

describe('Case 3 — a MIXED order settles each line on its own merits', () => {
  const r = computeCoverage([sub()], [
    line('i1', WASH_FOLD, SHIRT, 70),
    line('i2', DRY_CLEAN, BLANKET, 99),
  ])

  it('is not blocked, and does not go all-or-nothing', () => {
    expect(r.lines).toHaveLength(2)
    expect(r.coveredAmount).toBe(70)
  })

  it('the shirt is covered and the blanket is payable', () => {
    expect(r.lines[0].extraAmount).toBe(0)
    expect(r.lines[1].extraAmount).toBe(99)
  })

  // Case 6: only the eligible line draws down the allowance.
  it('consumes exactly ONE piece, not two', () => {
    const used = r.lines.reduce((n, l) => n + l.coveredPieces, 0)
    expect(used).toBe(1)
  })
})

describe('Case 4 — an audit service change removes the coverage', () => {
  // Booked as Blanket + Wash & Fold. Wash & Fold is eligible but the BLANKET is
  // not an included garment, so even the original line was never covered...
  it('a garment outside the plan is not covered even under an eligible service', () => {
    const r = computeCoverage([sub()], [line('i1', WASH_FOLD, BLANKET, 99)])
    expect(r.coveredAmount).toBe(0)
  })

  // ...and once audited to Dry Clean it is doubly ineligible.
  it('after the change to Dry Clean it stays payable', () => {
    const r = computeCoverage([sub()], [line('i1', DRY_CLEAN, BLANKET, 99)])
    expect(r.coveredAmount).toBe(0)
    expect(r.lines[0].extraAmount).toBe(99)
  })

  // The decisive one: coverage follows the AUDITED service, so a line that WAS
  // covered stops being covered when the service changes.
  it('a covered shirt loses cover when moved to an ineligible service', () => {
    const before = computeCoverage([sub()], [line('i1', WASH_FOLD, SHIRT, 70)])
    const after = computeCoverage([sub()], [line('i1', DRY_CLEAN, SHIRT, 70)])
    expect(before.coveredAmount).toBe(70)
    expect(after.coveredAmount).toBe(0)
    expect(after.lines[0].extraAmount).toBe(70)
  })
})

describe('Case 6 — allowance reflects only what qualified', () => {
  it('70 pieces less one covered shirt leaves 69', () => {
    const r = computeCoverage([sub(70)], [
      line('i1', WASH_FOLD, SHIRT, 70),
      line('i2', DRY_CLEAN, BLANKET, 99),
    ])
    const used = r.lines.reduce((n, l) => n + l.coveredPieces, 0)
    expect(70 - used).toBe(69)
  })

  it('an exhausted allowance leaves the line payable rather than going negative', () => {
    const r = computeCoverage([sub(0)], [line('i1', WASH_FOLD, SHIRT, 70)])
    expect(r.coveredAmount).toBe(0)
    expect(r.lines[0].extraAmount).toBe(70)
  })
})

// Case 5 + the actual defect: the snapshot was never refreshed after an edit.
describe('audit corrections re-evaluate coverage against the audited lines', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/items/[itemId]/route.ts'), 'utf8')

  it('re-applies through the existing engine, not a new one', () => {
    expect(API).toContain('applySubscriptionToOrder(orderId, { force: true')
    expect(API).toContain('from "@/lib/laundry-subscription-server"')
  })

  it('force is what releases the stale consumption before re-applying', () => {
    const ENGINE = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription-server.ts'), 'utf8')
    expect(ENGINE).toContain('await releaseSubscriptionFromOrder(orderId')
  })

  it('only touches orders that already had coverage', () => {
    expect(API).toContain('if ((beforeCoverage?.subscriptionCoveredAmount || 0) > 0)')
  })

  it('never leaves the order un-priced if the re-apply fails', () => {
    expect(API).toMatch(/catch \(e\) \{[\s\S]*?subscription re-apply/)
  })

  // Case 5: real payments are untouched; only the balance moves.
  it('writes no payment row', () => {
    expect(API).not.toContain('laundryPayment')
  })

  it('returns the refreshed coverage so the screen shows the stored figure', () => {
    expect(API).toContain('subscriptionCoveredAmount: r2(after?.subscriptionCoveredAmount ?? 0)')
  })
})
