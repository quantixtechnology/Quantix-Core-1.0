import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Storage Usage must show the business's OWN effective allocation.
//
// ROOT CAUSE. resolveStorageLimitBytes() read LaundryScalingLimit.storageLimitMB
// FIRST. That column has a schema default of 500 and is seeded from nothing —
// ensureScalingLimitForNewBusiness() writes only storesAllowed — so every
// laundry workspace carried a defaulted 500 MB that shadowed BOTH the plan
// default and the per-business Resource Allocation override. A business on a
// plan worth 10 GB, explicitly raised to 15 GB by Super Admin, still read
// "500 MB" on Laundry → Workspace Settings → Storage Usage.
//
// The chain is now: businessId → settings.resourceOverrides.storageGB →
// effective quota → UI, falling back to the plan default, and only then to the
// workspace's own row.
// ============================================================================

const mocks = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  planFindUnique: vi.fn(),
  scalingFindUnique: vi.fn(),
  fileUploadFindMany: vi.fn(),
  storeFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findUnique: mocks.businessFindUnique },
    productPlan: { findUnique: mocks.planFindUnique },
    laundryScalingLimit: { findUnique: mocks.scalingFindUnique },
    fileUpload: { findMany: mocks.fileUploadFindMany },
    laundryStore: { findMany: mocks.storeFindMany },
  },
}))

import { resolveStorageLimit, resolveStorageLimitBytes, computeStorageUsage, computeBusinessUsage } from '@/lib/laundry-storage'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const GB = 1024 ** 3
const MB = 1024 * 1024

// The real LAUNDRY STARTER row: storageQuotaMB is KB by convention, so this is
// the 10 GB the plan selector shows.
const STARTER_QUOTA = 10737418
const STARTER_BYTES = STARTER_QUOTA * 1024

/** A platform business on a plan, optionally with Resource Allocation overrides. */
const business = (overrides?: Record<string, unknown>, planned = true) => {
  mocks.businessFindUnique.mockResolvedValue({
    productCode: planned ? 'LAUNDRY' : null,
    subscriptionPlanCode: planned ? 'STARTER' : null,
    settings: overrides ? JSON.stringify({ resourceOverrides: overrides }) : '{}',
  })
  mocks.planFindUnique.mockResolvedValue(planned ? { storageQuotaMB: STARTER_QUOTA } : null)
}

beforeEach(() => {
  vi.clearAllMocks()
  // Every laundry workspace has one of these, sitting at the schema default —
  // the value that used to win.
  mocks.scalingFindUnique.mockResolvedValue({ storageLimitMB: 500 })
})

// ── The reported bug ────────────────────────────────────────────────────────
describe('the Super Admin override is the effective quota', () => {
  it('Storage raised from the 10 GB plan default to 15 GB shows 15 GB', async () => {
    business({ storageGB: 15 })
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.planDefaultBytes).toBe(STARTER_BYTES)
    expect(r.overrideBytes).toBe(15 * GB)
    expect(r.effectiveBytes).toBe(15 * GB)
    expect(r.source).toBe('override')
  })

  it('the defaulted 500 MB workspace row can no longer shadow it', async () => {
    business({ storageGB: 15 })
    expect(await resolveStorageLimitBytes('lb1', 'pb1')).not.toBe(500 * MB)
    expect(await resolveStorageLimitBytes('lb1', 'pb1')).toBe(15 * GB)
  })

  it('nor shadow the plan default when there is no override', async () => {
    business()
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.overrideBytes).toBeNull()
    expect(r.effectiveBytes).toBe(STARTER_BYTES)
    expect(r.source).toBe('plan')
  })

  it('500 MB appears only when 500 MB is genuinely the allocation', async () => {
    // As a plan default…
    mocks.businessFindUnique.mockResolvedValue({ productCode: 'LAUNDRY', subscriptionPlanCode: 'TINY', settings: '{}' })
    mocks.planFindUnique.mockResolvedValue({ storageQuotaMB: 512 * 1024 }) // KB convention
    expect((await resolveStorageLimit('lb1', 'pb1')).effectiveBytes).toBe(512 * MB)
    // …and never as an unrelated fallback under a real allocation.
    business({ storageGB: 15 })
    expect((await resolveStorageLimit('lb1', 'pb1')).effectiveBytes).toBe(15 * GB)
  })
})

// ── An override is an ALLOCATION, not a ceiling raise ──────────────────────
// Quantix Super Admin may set any valid figure — below the plan default as
// readily as above it. Nothing here may compare the two.
describe('the override may be lower OR higher than the plan default', () => {
  const cases: { override: number | null; expected: number; source: string; label: string }[] = [
    { override: null, expected: STARTER_BYTES, source: 'plan', label: 'none → the 10 GB STARTER default' },
    { override: 2, expected: 2 * GB, source: 'override', label: '2 GB → 2 GB (far below the plan)' },
    { override: 5, expected: 5 * GB, source: 'override', label: '5 GB → 5 GB (below the plan)' },
    { override: 15, expected: 15 * GB, source: 'override', label: '15 GB → 15 GB (above the plan)' },
    { override: 25, expected: 25 * GB, source: 'override', label: '25 GB → 25 GB (far above the plan)' },
  ]

  for (const c of cases) {
    it(c.label, async () => {
      business(c.override == null ? undefined : { storageGB: c.override })
      const r = await resolveStorageLimit('lb1', 'pb1')
      // The plan default is always reported alongside, whichever side it falls.
      expect(r.planDefaultBytes).toBe(STARTER_BYTES)
      expect(r.effectiveBytes).toBe(c.expected)
      expect(r.source).toBe(c.source)
      // And the guard enforces exactly what the dashboard displays.
      expect(await resolveStorageLimitBytes('lb1', 'pb1')).toBe(c.expected)
    })
  }

  it('a downward override is honoured even below the workspace row', async () => {
    // 2 GB < the 500 MB row is not the point — the point is that no floor,
    // ceiling or comparison against the plan is applied anywhere.
    business({ storageGB: 2 })
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.effectiveBytes).toBe(2 * GB)
    expect(r.effectiveBytes).toBeLessThan(r.planDefaultBytes!)
  })

  it('the resolver never compares the override with the plan default', () => {
    // A "must exceed the plan" rule would silently discard a downgrade.
    const src = read('src/lib/laundry-storage.ts')
    const fn = src.slice(src.indexOf('export async function resolveStorageLimit('), src.indexOf('/** The effective limit in bytes'))
    expect(fn).toContain('overrideBytes ?? planDefaultBytes')
    expect(fn).not.toMatch(/overrideBytes\s*[<>]/)
    expect(fn).not.toMatch(/Math\.(max|min)\(/)
  })
})

// ── Override parsing — the same guard Resource Allocation applies ───────────
describe('what counts as an override', () => {
  it('a blank / invalid / sub-1 value is NOT an override', async () => {
    for (const bad of [0, -3, null, undefined, 'fifteen', NaN]) {
      business({ storageGB: bad })
      const r = await resolveStorageLimit('lb1', 'pb1')
      expect(r.overrideBytes).toBeNull()
      expect(r.effectiveBytes).toBe(STARTER_BYTES)
    }
  })

  it('malformed settings JSON falls back to the plan default, not to 500 MB', async () => {
    mocks.businessFindUnique.mockResolvedValue({ productCode: 'LAUNDRY', subscriptionPlanCode: 'STARTER', settings: '{not json' })
    mocks.planFindUnique.mockResolvedValue({ storageQuotaMB: STARTER_QUOTA })
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.effectiveBytes).toBe(STARTER_BYTES)
    expect(r.source).toBe('plan')
  })

  it('an override still applies when the plan carries no quota', async () => {
    business({ storageGB: 15 }, false)
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.planDefaultBytes).toBeNull()
    expect(r.effectiveBytes).toBe(15 * GB)
    expect(r.source).toBe('override')
  })

  it('it reads the EXISTING resourceOverrides field — no second override store', () => {
    const src = read('src/lib/laundry-storage.ts')
    expect(src).toContain('parseResourceOverrides')
    expect(src).not.toContain('storageOverride')
    expect(src).not.toContain('storageLimitOverride')
  })
})

// ── The laundry-local row is a last resort, never a shadow ─────────────────
describe('the workspace row only speaks when nothing else has', () => {
  it('a laundry-only workspace with no platform business still gets its number', async () => {
    const r = await resolveStorageLimit('lb1', null)
    expect(r.effectiveBytes).toBe(500 * MB)
    expect(r.source).toBe('workspace')
  })

  it('a business with neither plan nor override falls back to it', async () => {
    business(undefined, false)
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.source).toBe('workspace')
    expect(r.effectiveBytes).toBe(500 * MB)
  })

  it('nothing allocated anywhere is unlimited, not silently defaulted', async () => {
    business(undefined, false)
    mocks.scalingFindUnique.mockResolvedValue(null)
    const r = await resolveStorageLimit('lb1', 'pb1')
    expect(r.effectiveBytes).toBeNull()
    expect(r.source).toBe('none')
    expect(await resolveStorageLimitBytes('lb1', 'pb1')).toBeNull()
  })

  it('it is not even read when a real allocation exists', async () => {
    business({ storageGB: 15 })
    await resolveStorageLimit('lb1', 'pb1')
    expect(mocks.scalingFindUnique).not.toHaveBeenCalled()
  })
})

// ── Tenant scoping ─────────────────────────────────────────────────────────
describe('quota and usage are scoped to the current business', () => {
  it('the override is read from THIS business id, not a global setting', async () => {
    business({ storageGB: 15 })
    await resolveStorageLimit('lb1', 'pb-current')
    expect(mocks.businessFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pb-current' } }),
    )
  })

  it('the workspace fallback is read from THIS laundry business id', async () => {
    business(undefined, false)
    await resolveStorageLimit('lb-current', 'pb1')
    expect(mocks.scalingFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'lb-current' } }),
    )
  })

  it('consumption counts only this tenant\'s files', async () => {
    mocks.fileUploadFindMany.mockResolvedValue([])
    await computeStorageUsage('pb-current', 15 * GB)
    expect(mocks.fileUploadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'pb-current', status: 'COMPLETED' } }),
    )
  })

  it('Business A\'s files never appear in Business B\'s usage', async () => {
    const file = (businessId: string, size: number) => ({
      businessId, size, category: 'garments',
      uploadPath: `/uploads/${businessId}/garments/a.png`, mimeType: 'image/png', createdAt: new Date(0),
    })
    const LEDGER = [file('pb-A', 4 * GB), file('pb-B', 1 * GB)]
    // The ledger is filtered in the query, exactly as Prisma would.
    mocks.fileUploadFindMany.mockImplementation(async ({ where }: { where: { businessId: string } }) =>
      LEDGER.filter((f) => f.businessId === where.businessId))

    const a = await computeStorageUsage('pb-A', 15 * GB)
    const b = await computeStorageUsage('pb-B', 15 * GB)
    expect(a.usedBytes).toBe(4 * GB)
    expect(b.usedBytes).toBe(1 * GB)
    // Never the platform-wide 5 GB total.
    expect(a.usedBytes + b.usedBytes).toBe(5 * GB)
    expect(a.usedBytes).not.toBe(5 * GB)
    expect(b.usedBytes).not.toBe(5 * GB)
  })

  it('two businesses on the same plan can hold different allocations', async () => {
    business({ storageGB: 15 })
    const a = await resolveStorageLimit('lb-A', 'pb-A')
    business() // same STARTER plan, no override
    const b = await resolveStorageLimit('lb-B', 'pb-B')
    expect(a.effectiveBytes).toBe(15 * GB)
    expect(b.effectiveBytes).toBe(STARTER_BYTES)
  })

  it('percent and remaining are computed against the effective limit', async () => {
    mocks.fileUploadFindMany.mockResolvedValue([
      { size: 3 * GB, category: 'garments', uploadPath: '/uploads/pb1/garments/a.png', mimeType: 'image/png', createdAt: new Date(0) },
    ])
    const u = await computeStorageUsage('pb1', 15 * GB)
    expect(u.limitBytes).toBe(15 * GB)
    expect(u.limitGB).toBe(15)
    expect(u.remainingBytes).toBe(12 * GB)
    expect(u.percentUsed).toBe(20)
    expect(u.exceeded).toBe(false)
  })
})

// ── One resolver for display AND enforcement ───────────────────────────────
describe('display and enforcement cannot disagree', () => {
  it('the upload guard resolves the limit through the same function', () => {
    const guard = read('src/lib/storage-guard.ts')
    expect(guard).toContain('resolveStorageLimitBytes')
    expect(guard).not.toContain('storageLimitMB')
    expect(guard).not.toContain('storageQuotaMB')
  })

  it('the widget renders the limit the server resolved, computing none of its own', () => {
    const widget = read('src/components/laundry/views/laundry-storage-widget.tsx')
    expect(widget).toContain('usage.limitBytes')
    expect(widget).not.toContain('storageQuotaMB')
    expect(widget).not.toContain('storageLimitMB')
  })

  it('the widget says which allocation it is showing', () => {
    const widget = read('src/components/laundry/views/laundry-storage-widget.tsx')
    expect(widget).toContain('Custom allocation for this business')
    expect(widget).toContain('plan default')
  })

  it('both surfaces carry the resolution, so Quantix and the tenant see one number', () => {
    expect(read('src/lib/laundry-storage.ts')).toContain('return { storage, stores, limit, calculatedAt')
    expect(read('src/app/api/laundry/storage/route.ts')).toContain('limit,')
  })
})

// ── What the dashboard will actually read ──────────────────────────────────
// The exact payload Workspace Settings → Storage Usage renders, for the
// business in the report: STARTER (10 GB) raised to 15 GB.
describe('the Storage Usage payload', () => {
  beforeEach(() => {
    mocks.fileUploadFindMany.mockResolvedValue([]) // no files uploaded yet
    mocks.storeFindMany.mockResolvedValue([])
  })

  it('a 15 GB override renders "0 B / 15 GB" as a custom allocation', async () => {
    business({ storageGB: 15 })
    const { storage, limit } = await computeBusinessUsage('lb1', 'pb1')
    expect(storage!.usedBytes).toBe(0)
    expect(storage!.limitBytes).toBe(15 * GB)
    expect(storage!.limitGB).toBe(15)
    expect(limit.source).toBe('override') // → "Custom allocation for this business"
    expect(limit.planCode).toBe('STARTER')
  })

  it('removing the override returns it to the STARTER plan default', async () => {
    business()
    const { storage, limit } = await computeBusinessUsage('lb1', 'pb1')
    expect(storage!.limitBytes).toBe(STARTER_BYTES)
    expect(limit.source).toBe('plan') // → "STARTER plan default"
    expect(limit.planCode).toBe('STARTER')
  })

  it('the caption the widget derives covers every source it can be sent', () => {
    const widget = read('src/components/laundry/views/laundry-storage-widget.tsx')
    for (const source of ['override', 'plan', 'workspace']) expect(widget).toContain(`"${source}"`)
  })
})
