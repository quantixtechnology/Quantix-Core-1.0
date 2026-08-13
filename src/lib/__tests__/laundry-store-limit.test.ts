import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// The Store Limit chosen at Business Creation must actually be persisted and
// enforced.
//
// ROOT CAUSE. The plan selector showed "Branches: 5" and the number was then
// written nowhere. Two creation paths, two failures:
//   • Super Admin → Provisioning materialises the LaundryBusiness lazily in
//     resolveLaundryBusiness(), which created ONLY that row — no
//     LaundryScalingLimit at all, so storesAllowed was null and the check
//     `if (limits && …)` never fired. The limit was unenforced.
//   • POST /api/laundry/businesses created the row bare, so storesAllowed fell
//     to the schema default of 1 whatever plan was sold.
// ============================================================================

const mocks = vi.hoisted(() => ({
  scalingFindUnique: vi.fn(),
  scalingCreate: vi.fn(),
  businessFindUnique: vi.fn(),
  planFindUnique: vi.fn(),
  storeFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryScalingLimit: { findUnique: mocks.scalingFindUnique, create: mocks.scalingCreate },
    business: { findUnique: mocks.businessFindUnique },
    productPlan: { findUnique: mocks.planFindUnique },
    laundryStore: { findMany: mocks.storeFindMany },
  },
}))

import { ensureScalingLimitForNewBusiness, planStoreLimit } from '@/lib/laundry-scaling-limits'
import { computeStoreUsage } from '@/lib/laundry-storage'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STORES_ROUTE = read('src/app/api/laundry/businesses/[id]/stores/route.ts')
const RESOLVE = read('src/lib/laundry-business.ts')
const UI = read('src/components/admin/laundry/laundry-stores-view.tsx')
const SCHEMA = read('prisma/schema.prisma')

const withPlan = (branchLimit: number) => {
  mocks.businessFindUnique.mockResolvedValue({ productCode: 'LAUNDRY', subscriptionPlanCode: 'PRO' })
  mocks.planFindUnique.mockResolvedValue({ branchLimit })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.scalingFindUnique.mockResolvedValue(null)
  mocks.scalingCreate.mockResolvedValue({})
})

// ── Persistence at creation ────────────────────────────────────────────────
describe('the plan\'s Store Limit is persisted at creation', () => {
  it('Business created with Store Limit = 1 → storesAllowed 1', async () => {
    withPlan(1)
    await ensureScalingLimitForNewBusiness('lb1', 'pb1')
    expect(mocks.scalingCreate).toHaveBeenCalledWith({ data: { businessId: 'lb1', storesAllowed: 1 } })
  })

  it('Business created with Store Limit = 5 → storesAllowed 5', async () => {
    withPlan(5)
    await ensureScalingLimitForNewBusiness('lb1', 'pb1')
    expect(mocks.scalingCreate).toHaveBeenCalledWith({ data: { businessId: 'lb1', storesAllowed: 5 } })
  })

  it('an unknown plan leaves the schema default rather than inventing a number', async () => {
    mocks.businessFindUnique.mockResolvedValue({ productCode: null, subscriptionPlanCode: null })
    await ensureScalingLimitForNewBusiness('lb1', 'pb1')
    expect(mocks.scalingCreate).toHaveBeenCalledWith({ data: { businessId: 'lb1' } })
    expect(await planStoreLimit('pb1')).toBeNull()
  })

  it('EXISTING businesses are never modified', async () => {
    // The whole point: a business whose limits an administrator already tuned
    // must survive untouched.
    mocks.scalingFindUnique.mockResolvedValue({ id: 'row1' })
    await ensureScalingLimitForNewBusiness('lb1', 'pb1')
    expect(mocks.scalingCreate).not.toHaveBeenCalled()
  })

  it('it never updates or deletes a limits row', () => {
    const src = read('src/lib/laundry-scaling-limits.ts')
    expect(src).not.toContain('laundryScalingLimit.update')
    expect(src).not.toContain('laundryScalingLimit.upsert')
    expect(src).not.toContain('laundryScalingLimit.delete')
  })

  it('both creation paths seed it', () => {
    expect(RESOLVE).toContain('ensureScalingLimitForNewBusiness(created.id, created.platformBusinessId)')
    expect(read('src/app/api/laundry/businesses/route.ts')).toContain('ensureScalingLimitForNewBusiness(business.id, business.platformBusinessId)')
  })

  it('the resolve path seeds only on CREATE, not on every request', () => {
    // resolveLaundryBusiness runs on every laundry API call; the seed sits
    // inside the create block and the helper early-returns when a row exists.
    const createBlock = RESOLVE.slice(RESOLVE.indexOf('Step 4 — Create new LaundryBusiness'))
    expect(createBlock).toContain('ensureScalingLimitForNewBusiness')
  })
})

// ── Counting ───────────────────────────────────────────────────────────────
describe('usage counts real rows — every type is one slot', () => {
  const usageWith = async (types: string[], allowed: number | null) => {
    mocks.storeFindMany.mockResolvedValue(types.map((storeType) => ({ storeType })))
    mocks.scalingFindUnique.mockResolvedValue(allowed == null ? null : { storesAllowed: allowed })
    return computeStoreUsage('lb1')
  }

  it('a Retail Store counts as 1', async () => {
    const u = await usageWith(['RETAIL_STORE'], 5)
    expect(u.used).toBe(1); expect(u.retail).toBe(1)
  })

  it('a Processing Center counts as 1', async () => {
    const u = await usageWith(['PROCESSING_CENTER'], 5)
    expect(u.used).toBe(1); expect(u.processingCenters).toBe(1)
  })

  it('a Both location counts as 1 — once, not twice', async () => {
    const u = await usageWith(['BOTH'], 5)
    expect(u.used).toBe(1); expect(u.both).toBe(1)
  })

  it('all three share the ONE limit', async () => {
    const u = await usageWith(['RETAIL_STORE', 'PROCESSING_CENTER', 'BOTH'], 5)
    expect(u.used).toBe(3)
    expect(u.remaining).toBe(2)
    expect(u.exceeded).toBe(false)
  })

  it('the limit blocks the next store when reached', async () => {
    const u = await usageWith(['RETAIL_STORE', 'PROCESSING_CENTER'], 2)
    expect(u.exceeded).toBe(true)
    expect(u.remaining).toBe(0)
  })

  it('no assigned limit means unlimited, not zero', async () => {
    const u = await usageWith(['RETAIL_STORE'], null)
    expect(u.allowed).toBeNull()
    expect(u.exceeded).toBe(false)
  })
})

// ── Enforcement ────────────────────────────────────────────────────────────
describe('the create endpoint enforces it', () => {
  it('it counts rows instead of the drifting storesUsed counter', () => {
    expect(STORES_ROUTE).toContain('const usage = await computeStoreUsage(laundryBusinessId)')
    expect(STORES_ROUTE).toContain('if (usage.allowed != null && usage.used >= usage.allowed)')
    expect(STORES_ROUTE).not.toContain('limits.storesUsed >= limits.storesAllowed')
  })

  it('it refuses with the plan wording and a code', () => {
    expect(STORES_ROUTE).toContain('STORE_LIMIT_REACHED')
    expect(STORES_ROUTE).toContain('are currently in use')
  })

  it('nothing is deleted or deactivated at the limit', () => {
    const createBlock = STORES_ROUTE.slice(0, STORES_ROUTE.indexOf('export async function PUT'))
    expect(createBlock).not.toContain('laundryStore.delete')
    expect(createBlock).not.toContain('isActive: false')
  })
})

// ── UI ─────────────────────────────────────────────────────────────────────
describe('the Add Store screen', () => {
  it('shows "used / allowed"', () => {
    expect(UI).toContain('{storeUsage.used} / {storeUsage.allowed} used')
  })

  it('disables Add Store at the limit', () => {
    expect(UI).toContain('disabled={!!storeUsage?.exceeded}')
    expect(UI).toContain('Store limit reached')
  })

  it('reads the same count the server enforces', () => {
    expect(UI).toContain('stores?withUsage=1')
    expect(STORES_ROUTE).toContain('computeStoreUsage(resolved.id)')
  })

  it('the bare-array contract is unchanged for other consumers', () => {
    // Five other screens consume this endpoint; the envelope is opt-in.
    expect(STORES_ROUTE).toContain('searchParams.get("withUsage") === "1"')
    expect(STORES_ROUTE).toContain('return NextResponse.json(stores)')
  })
})

describe('no new quota concept', () => {
  it('the existing LaundryScalingLimit.storesAllowed is what is written', () => {
    expect(SCHEMA).toContain('storesAllowed            Int             @default(1)')
    expect(SCHEMA).not.toContain('model StoreQuota')
  })

  it('no separate Processing Center quota is used or introduced', () => {
    const src = read('src/lib/laundry-scaling-limits.ts')
    expect(src).not.toContain('processingCentersAllowed')
    expect(STORES_ROUTE).not.toContain('processingCentersAllowed')
  })
})
