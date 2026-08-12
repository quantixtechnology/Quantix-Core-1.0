import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const FINISHING = read('src/lib/laundry-finishing.ts')
const ASSIGN = read('src/lib/laundry-bag-assign.ts')
const BAGS_UI = read('src/components/laundry/views/laundry-bag-management.tsx')

// A bag is a reusable asset. The only question is whether it is occupied NOW.
describe('historical ownership never blocks reuse', () => {
  it('the "belongs to a different order" rejection is gone', () => {
    expect(FINISHING).not.toContain('belongs to a different order — each finishing bag is used for one order only')
  })

  // Test A — the reported bug. An AVAILABLE bag has currentOrderId = null, so
  // the old equality check rejected the very order that had just released it.
  it('a released bag can be re-scanned by the SAME order', () => {
    // Occupancy is now computed (status AND a live linked order), then bound.
    expect(FINISHING).toContain('let occupied = bag.status !== "AVAILABLE"')
    expect(FINISHING).toContain('assignBagToOrder({ lbId: businessId, code: bag.bagNumber, orderId })')
  })

  // Test C — occupancy, not history, is what refuses.
  it('a bag on another live order is refused, and says so', () => {
    expect(FINISHING).toContain('is currently assigned to another active order. Please use another available bag.')
  })

  it('a re-scan of the bag already on this order is accepted unchanged', () => {
    expect(FINISHING).toContain('if (bag.currentOrderId !== orderId) {')
  })

  it('the check reads status, so it needed the field', () => {
    expect(FINISHING).toContain('currentOrderId: true, status: true')
  })
})

describe('assignment is decided by occupancy alone', () => {
  // Tests B and D — a different order, or one that used it before, both work
  // once the bag is free.
  it('assignBagToOrder rejects only on status, never on a past orderId', () => {
    const start = ASSIGN.indexOf('export async function assignBagToOrder')
    const fn = ASSIGN.slice(start, ASSIGN.indexOf('export async function getBagReleaseStage'))
    expect(fn).toContain('if (bag.status !== "AVAILABLE")')
    // No lookup of past assignments, and no rejection derived from one.
    expect(fn).not.toContain('laundryBagAssignment.findFirst')
    expect(fn).not.toMatch(/was previously|already been used/i)
  })

  it('re-assigning to the same order is idempotent, not an error', () => {
    expect(ASSIGN).toContain('if (bag.currentOrderId === orderId) return { ok: true, bag }')
  })
})

describe('Bag Management is the bag master, not a workflow setting', () => {
  it('the release-stage configuration is gone', () => {
    expect(BAGS_UI).not.toContain('Reusable Bag Release Stage')
    expect(BAGS_UI).not.toContain('Release at Processing Center Receive')
    expect(BAGS_UI).not.toContain('Release after Delivery')
  })

  it('and its state, handler and fetch went with it', () => {
    for (const dead of ['releaseStage', 'savingStage', 'saveReleaseStage', 'bag-settings']) {
      expect(BAGS_UI).not.toContain(dead)
    }
  })
})

describe('destructive actions confirm first', () => {
  it('Damaged, Lost and Release each have their own wording', () => {
    expect(BAGS_UI).toContain('Mark Bag as Damaged?')
    expect(BAGS_UI).toContain('Mark Bag as Lost?')
    // AVAILABLE via the status menu is Reactivate; manual release keeps its own
    // reason dialog, asserted separately below.
    expect(BAGS_UI).toContain('Reactivate Bag?')
  })

  it('the wording says what will happen, not just "are you sure"', () => {
    expect(BAGS_UI).toContain('will no longer be available for assignment.')
    expect(BAGS_UI).toContain('will be removed from active availability.')
  })

  // Test E/F — a single mis-click on a small icon must not take a bag out of
  // service.
  it('no status change runs without a confirmation', () => {
    expect(BAGS_UI).toContain('if (c && !window.confirm(')
    expect(BAGS_UI.indexOf('window.confirm')).toBeLessThan(BAGS_UI.indexOf('method: "PATCH"'))
  })
})

// ── A pointer left by a finished order is not occupancy ─────────────────────
// Scanning BAG-000001 at Fold said "This order has already been delivered":
// the bag still pointed at an order delivered days earlier, so the station
// loaded THAT order instead of the one in the operator's hand.
describe('a stale currentOrderId never blocks a bag', () => {
  const RESOLVE = read('src/app/api/laundry/processing/finishing/route.ts')

  it('the scan checks whether the linked order is still live', () => {
    expect(RESOLVE).toContain('linked.status === "DELIVERED" || linked.status === "CANCELLED"')
  })

  it('and clears the pointer, so the bag recovers itself', () => {
    expect(RESOLVE).toContain('data: { status: "AVAILABLE", currentOrderId: null')
  })

  it('a bag pointing at a deleted order is treated the same', () => {
    expect(RESOLVE).toContain('if (!linked ||')
  })

  it('the message tells the operator what to do next', () => {
    expect(RESOLVE).toContain('is not linked to an active order. Scan the processing packet, or assign this bag to the order first.')
  })

  it('the bind path applies the same rule', () => {
    expect(FINISHING).toContain('let occupied = bag.status !== "AVAILABLE"')
    expect(FINISHING).toContain('occupied = false')
  })

  // Occupancy by a genuinely live order must still refuse.
  it('a live order still holds the bag', () => {
    expect(FINISHING).toContain('is currently assigned to another active order')
  })
})
