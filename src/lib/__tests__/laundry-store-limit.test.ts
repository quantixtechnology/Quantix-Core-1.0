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

import { ensureScalingLimitForNewBusiness, planStoreLimit, resolveEffectiveStoreLimit, parseResourceOverrides } from '@/lib/laundry-scaling-limits'
import { computeStoreUsage } from '@/lib/laundry-storage'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STORES_ROUTE = read('src/app/api/laundry/businesses/[id]/stores/route.ts')
const RESOLVE = read('src/lib/laundry-business.ts')
const UI = read('src/components/admin/laundry/laundry-stores-view.tsx')
const SCHEMA = read('prisma/schema.prisma')

const withPlan = (branchLimit: number, overrides?: Record<string, unknown>) => {
  mocks.businessFindUnique.mockResolvedValue({
    productCode: 'LAUNDRY', subscriptionPlanCode: 'PRO',
    settings: overrides ? JSON.stringify({ resourceOverrides: overrides }) : null,
  })
  mocks.planFindUnique.mockResolvedValue({ branchLimit })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.scalingFindUnique.mockResolvedValue(null)
  mocks.scalingCreate.mockResolvedValue({})
})

// ── The effective limit: override beats the plan default ───────────────────
describe('the business override is the real entitlement', () => {
  it('an explicit Stores/Branches override WINS over the plan default', async () => {
    // The exact case first missed: a STARTER business (plan default 1) that an
    // administrator explicitly granted 5 stores has 5, not 1.
    withPlan(1, { stores: 5 })
    const r = await resolveEffectiveStoreLimit('pb1')
    expect(r.planDefault).toBe(1)
    expect(r.override).toBe(5)
    expect(r.effective).toBe(5)
  })

  it('with no override the plan default applies', async () => {
    withPlan(1)
    const r = await resolveEffectiveStoreLimit('pb1')
    expect(r.override).toBeNull()
    expect(r.effective).toBe(1)
  })

  it('a blank / invalid / sub-1 override is NOT an override', async () => {
    // Same guard the Resource Allocation screen applies.
    for (const bad of [0, -3, null, undefined, 'five', NaN]) {
      withPlan(1, { stores: bad })
      const r = await resolveEffectiveStoreLimit('pb1')
      expect(r.override).toBeNull()
      expect(r.effective).toBe(1)
    }
  })

  it('an override still applies when the plan has no default', async () => {
    mocks.businessFindUnique.mockResolvedValue({
      productCode: null, subscriptionPlanCode: null,
      settings: JSON.stringify({ resourceOverrides: { stores: 4 } }),
    })
    const r = await resolveEffectiveStoreLimit('pb1')
    expect(r.planDefault).toBeNull()
    expect(r.effective).toBe(4)
  })

  it('malformed settings JSON falls back to the plan default', async () => {
    mocks.businessFindUnique.mockResolvedValue({ productCode: 'LAUNDRY', subscriptionPlanCode: 'PRO', settings: '{not json' })
    mocks.planFindUnique.mockResolvedValue({ branchLimit: 2 })
    const r = await resolveEffectiveStoreLimit('pb1')
    expect(r.effective).toBe(2)
  })

  it('the override is read from the EXISTING resourceOverrides field', () => {
    // Business.settings.resourceOverrides — what Resource Allocation writes.
    // No second override field is introduced.
    expect(parseResourceOverrides(JSON.stringify({ resourceOverrides: { stores: 5 } })).stores).toBe(5)
    expect(parseResourceOverrides(null)).toEqual({})
    const src = read('src/lib/laundry-scaling-limits.ts')
    expect(src).toContain('resourceOverrides')
    expect(src).not.toContain('storeLimitOverride')
  })

  it('storage is NOT touched by this resolver', () => {
    // storageGB has the same override bug; it is deliberately a separate task.
    const src = read('src/lib/laundry-scaling-limits.ts')
    expect(src).not.toContain('storageLimitMB')
    expect(src).not.toContain('storageQuotaMB')
  })
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

  it('a NEW business honours a configured override, not the plan default', async () => {
    withPlan(1, { stores: 5 })
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

  it('the backfill script uses the SAME resolver — one definition only', () => {
    const script = read('scripts/backfill-store-limits.ts')
    expect(script).toContain('resolveEffectiveStoreLimit')
    // It must not re-derive the limit from the plan on its own.
    expect(script).not.toContain('productPlan.findUnique')
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
