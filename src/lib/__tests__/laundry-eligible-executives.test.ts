import { describe, it, expect } from 'vitest'
import {
  isExecutiveEligible,
  filterEligibleExecutives,
  filterEligibleForStores,
  eligibleExecutiveWhere,
  NO_EXECUTIVES_FOR_STORE,
} from '@/lib/laundry-eligible-executives'

// ============================================================================
// One rule decides who may be assigned an order, on every dispatch surface:
//   assigned to the order's store  OR  assigned to All Stores (storeId = null)
// plus active, not archived, not off-duty.
// ============================================================================

const exec = (name: string, storeId: string | null, over: Record<string, unknown> = {}) =>
  ({ name, storeId, isActive: true, availability: 'AVAILABLE', archivedAt: null, ...over })

const STORE_A = 'store-a'
const STORE_B = 'store-b'
const STORE_C = 'store-c'

describe('store scoping', () => {
  it('keeps an executive assigned to the order store', () => {
    expect(isExecutiveEligible(exec('Rahul', STORE_A), STORE_A)).toBe(true)
  })

  it('rejects an executive from another store', () => {
    expect(isExecutiveEligible(exec('Rahul', STORE_A), STORE_B)).toBe(false)
  })

  it('keeps an All-Stores executive (storeId null) for every store', () => {
    const floating = exec('Floating', null)
    expect(isExecutiveEligible(floating, STORE_A)).toBe(true)
    expect(isExecutiveEligible(floating, STORE_B)).toBe(true)
    expect(isExecutiveEligible(floating, STORE_C)).toBe(true)
  })

  // The reported bug: an order from one store offered the whole business.
  it('shows a Store B order only Store B executives, plus All Stores', () => {
    const all = [
      ...Array.from({ length: 10 }, (_, i) => exec(`A${i}`, STORE_A)),
      ...Array.from({ length: 10 }, (_, i) => exec(`B${i}`, STORE_B)),
      ...Array.from({ length: 5 }, (_, i) => exec(`C${i}`, STORE_C)),
      exec('Floater', null),
    ]
    const got = filterEligibleExecutives(all, STORE_B).map((e) => e.name)
    expect(got).toHaveLength(11)
    expect(got).toContain('B0')
    expect(got).toContain('Floater')
    expect(got.some((n) => n.startsWith('A'))).toBe(false)
    expect(got.some((n) => n.startsWith('C'))).toBe(false)
  })

  it('returns an empty list when the store has nobody — the caller shows the notice', () => {
    expect(filterEligibleExecutives([exec('A0', STORE_A)], STORE_B)).toEqual([])
    expect(NO_EXECUTIVES_FOR_STORE).toMatch(/no delivery executives assigned to this store/i)
  })
})

describe('status', () => {
  it('drops an inactive executive', () => {
    expect(isExecutiveEligible(exec('X', STORE_A, { isActive: false }), STORE_A)).toBe(false)
  })

  it('drops an archived executive even while still flagged active', () => {
    expect(isExecutiveEligible(exec('X', STORE_A, { archivedAt: '2026-01-01' }), STORE_A)).toBe(false)
  })

  it('drops an off-duty executive', () => {
    expect(isExecutiveEligible(exec('X', STORE_A, { availability: 'OFF' }), STORE_A)).toBe(false)
  })

  // A rider mid-round is exactly who the next drop is queued onto; hiding BUSY
  // would empty the dropdown during the busiest part of the day.
  it('keeps a BUSY executive assignable', () => {
    expect(isExecutiveEligible(exec('X', STORE_A, { availability: 'BUSY' }), STORE_A)).toBe(true)
  })

  it('keeps an executive whose availability is not tracked', () => {
    expect(isExecutiveEligible(exec('X', STORE_A, { availability: null }), STORE_A)).toBe(true)
  })
})

describe('bulk assignment across stores', () => {
  const pool = [exec('A0', STORE_A), exec('B0', STORE_B), exec('Floater', null)]

  it('offers that store’s executives when every selected job shares a store', () => {
    expect(filterEligibleForStores(pool, [STORE_A, STORE_A]).map((e) => e.name)).toEqual(['A0', 'Floater'])
  })

  it('offers only All-Stores executives when the selection spans stores', () => {
    expect(filterEligibleForStores(pool, [STORE_A, STORE_B]).map((e) => e.name)).toEqual(['Floater'])
  })

  it('never offers a store-bound executive for a store they do not serve', () => {
    expect(filterEligibleForStores(pool, [STORE_A, STORE_C]).map((e) => e.name)).toEqual(['Floater'])
  })
})

describe('the Prisma filter mirrors the predicate', () => {
  it('scopes to the business, excludes inactive/archived/off-duty, and ORs All Stores', () => {
    const where = eligibleExecutiveWhere('biz-1', STORE_A)
    expect(where.businessId).toBe('biz-1')
    expect(where.isActive).toBe(true)
    expect(where.archivedAt).toBeNull()
    expect(where.availability).toEqual({ notIn: ['OFF'] })
    expect(where.OR).toEqual([{ storeId: STORE_A }, { storeId: null }])
  })

  // A caller that cannot resolve the order's store gets a usable list rather
  // than a silently empty dropdown.
  it('does not narrow by store when no store is given', () => {
    expect(eligibleExecutiveWhere('biz-1', null).OR).toBeUndefined()
  })
})
