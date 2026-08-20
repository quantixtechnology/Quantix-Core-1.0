import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Every business-owned file must reach the ledger.
//
// The audit found the quota resolving correctly against a ledger that was
// empty. Five write paths put bytes on disk and recorded nothing, so Storage
// Usage read 0 B for a business with a visible logo:
//
//   /api/business/logo/upload            logo + favicon      unmetered
//   /api/core/businesses/[id]/categories category artwork    unmetered
//   /api/admin/billing/proof-upload      payment proofs      unmetered
//   persistRecording()                   CRM recordings      unmetered
//   /api/core/upload                     everything else     laundry-only
//
// FileUpload.businessId is ALWAYS the platform Business id. CRM recordings key
// their directory on a LaundryBusiness id, so writing that id into the ledger
// would file the bytes under a tenant that does not exist.
// ============================================================================

const mocks = vi.hoisted(() => ({
  fileUploadCreate: vi.fn(),
  fileUploadDeleteMany: vi.fn(),
  fileUploadFindMany: vi.fn(),
  fileUploadAggregate: vi.fn(),
  laundryFindFirst: vi.fn(),
  businessFindUnique: vi.fn(),
  businessFindMany: vi.fn(),
  laundryFindMany: vi.fn(),
  planFindUnique: vi.fn(),
  scalingFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    fileUpload: {
      create: mocks.fileUploadCreate,
      deleteMany: mocks.fileUploadDeleteMany,
      findMany: mocks.fileUploadFindMany,
      aggregate: mocks.fileUploadAggregate,
    },
    laundryBusiness: { findFirst: mocks.laundryFindFirst, findMany: mocks.laundryFindMany },
    business: { findUnique: mocks.businessFindUnique, findMany: mocks.businessFindMany },
    productPlan: { findUnique: mocks.planFindUnique },
    laundryScalingLimit: { findUnique: mocks.scalingFindUnique },
  },
}))

import { recordUpload, forgetUpload, resolveMeteringTarget, checkStorageAllowance } from '@/lib/storage-guard'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const GB = 1024 ** 3
const STARTER_QUOTA = 10737418 // KB convention → 10 GB in the plan UI

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fileUploadCreate.mockResolvedValue({})
  mocks.fileUploadDeleteMany.mockResolvedValue({ count: 1 })
  mocks.fileUploadAggregate.mockResolvedValue({ _sum: { size: 0 } })
  mocks.laundryFindFirst.mockResolvedValue(null)
  mocks.businessFindUnique.mockResolvedValue(null)
  mocks.scalingFindUnique.mockResolvedValue(null)
})

// ── Tenant resolution ──────────────────────────────────────────────────────
describe('the ledger is always keyed on the platform business', () => {
  it('a LaundryBusiness id resolves to its platform id', async () => {
    mocks.laundryFindFirst.mockResolvedValue({ id: 'lb1', platformBusinessId: 'pb1' })
    const t = await resolveMeteringTarget('lb1')
    expect(t).toEqual({ platformBusinessId: 'pb1', laundryBusinessId: 'lb1' })
  })

  it('a platform id resolves to itself', async () => {
    mocks.laundryFindFirst.mockResolvedValue({ id: 'lb1', platformBusinessId: 'pb1' })
    const t = await resolveMeteringTarget('pb1')
    expect(t!.platformBusinessId).toBe('pb1')
  })

  it('a Commerce business with no laundry workspace still resolves', async () => {
    // This is the case that used to be skipped entirely.
    mocks.laundryFindFirst.mockResolvedValue(null)
    mocks.businessFindUnique.mockResolvedValue({ id: 'pb-commerce' })
    const t = await resolveMeteringTarget('pb-commerce')
    expect(t).toEqual({ platformBusinessId: 'pb-commerce', laundryBusinessId: null })
  })

  it('an unknown id is charged to nobody', async () => {
    expect(await resolveMeteringTarget('nope')).toBeNull()
    expect(await resolveMeteringTarget(null)).toBeNull()
    expect(await resolveMeteringTarget(undefined)).toBeNull()
  })
})

// ── One row per upload ─────────────────────────────────────────────────────
describe('each upload writes exactly one ledger row', () => {
  const rowFor = () => mocks.fileUploadCreate.mock.calls[0][0].data

  it('writes one row, keyed on the platform business, marked COMPLETED', async () => {
    await recordUpload({
      platformBusinessId: 'pb1', originalName: 'logo.png', filename: 'x.png',
      size: 263494, mimeType: 'image/png', uploadPath: '/uploads/branding/pb1/x.png', folder: 'branding',
    })
    expect(mocks.fileUploadCreate).toHaveBeenCalledTimes(1)
    const row = rowFor()
    expect(row.businessId).toBe('pb1')
    expect(row.size).toBe(263494)
    expect(row.status).toBe('COMPLETED')
    expect(row.uploadPath).toBe('/uploads/branding/pb1/x.png')
  })

  it('an explicit category beats the directory it landed in', async () => {
    // A logo written to /uploads/products must not be filed as a garment.
    await recordUpload({
      platformBusinessId: 'pb1', originalName: 'logo.png', filename: 'x.png',
      size: 10, mimeType: 'image/png', uploadPath: '/uploads/products/pb1/x.png',
      folder: 'products', category: 'branding',
    })
    expect(rowFor().category).toBe('branding')
  })

  it('an invented category is ignored in favour of the folder', async () => {
    await recordUpload({
      platformBusinessId: 'pb1', originalName: 'a.png', filename: 'a.png',
      size: 10, mimeType: 'image/png', uploadPath: '/uploads/audit/pb1/a.png',
      folder: 'audit', category: 'not-a-real-category',
    })
    expect(rowFor().category).toBe('audit')
  })

  it('a ledger failure never throws — the file is already saved', async () => {
    mocks.fileUploadCreate.mockRejectedValue(new Error('db down'))
    await expect(recordUpload({
      platformBusinessId: 'pb1', originalName: 'a.png', filename: 'a.png',
      size: 1, mimeType: 'image/png', uploadPath: '/uploads/x/pb1/a.png',
    })).resolves.toBeUndefined()
  })
})

// ── Deletion ───────────────────────────────────────────────────────────────
describe('deleted files stop consuming the quota', () => {
  it('forgetUpload removes the row for that exact path', async () => {
    await forgetUpload('/uploads/crm-recordings/lb1/rec-1.mp3')
    expect(mocks.fileUploadDeleteMany).toHaveBeenCalledWith({
      where: { uploadPath: '/uploads/crm-recordings/lb1/rec-1.mp3' },
    })
  })

  it('deleting a recording forgets it in the same call', () => {
    const src = read('src/lib/laundry-crm-comms.ts')
    const del = src.slice(src.indexOf('export async function deleteRecordingFile'))
    expect(del).toContain('forgetUpload(recordingUploadPath(')
  })

  it('a failed ledger delete never blocks the deletion', async () => {
    mocks.fileUploadDeleteMany.mockRejectedValue(new Error('db down'))
    await expect(forgetUpload('/uploads/x/y.png')).resolves.toBeUndefined()
  })
})

// ── Enforcement uses the same quota the dashboard shows ────────────────────
describe('the guard enforces the effective quota', () => {
  const onStarter = (overrides?: Record<string, unknown>) => {
    mocks.businessFindUnique.mockResolvedValue({
      productCode: 'LAUNDRY', subscriptionPlanCode: 'STARTER',
      settings: overrides ? JSON.stringify({ resourceOverrides: overrides }) : '{}',
    })
    mocks.planFindUnique.mockResolvedValue({ storageQuotaMB: STARTER_QUOTA })
  }

  it('blocks when used + incoming exceeds the override', async () => {
    onStarter({ storageGB: 15 })
    mocks.fileUploadAggregate.mockResolvedValue({ _sum: { size: 15 * GB - 100 } })
    const r = await checkStorageAllowance({ laundryBusinessId: 'lb1', platformBusinessId: 'pb1', incomingBytes: 500 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.limitBytes).toBe(15 * GB)
      expect(r.code).toBe('STORAGE_LIMIT')
    }
  })

  it('allows when it fits', async () => {
    onStarter({ storageGB: 15 })
    mocks.fileUploadAggregate.mockResolvedValue({ _sum: { size: 1 * GB } })
    expect((await checkStorageAllowance({ laundryBusinessId: 'lb1', platformBusinessId: 'pb1', incomingBytes: 500 })).ok).toBe(true)
  })

  it('a lower override is enforced as the real ceiling', async () => {
    // 5 GB override on a 10 GB plan: 6 GB used is over, not under.
    onStarter({ storageGB: 5 })
    mocks.fileUploadAggregate.mockResolvedValue({ _sum: { size: 6 * GB } })
    const r = await checkStorageAllowance({ laundryBusinessId: 'lb1', platformBusinessId: 'pb1', incomingBytes: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.limitBytes).toBe(5 * GB)
  })

  it('a Commerce tenant is quota\'d too, not waved through', async () => {
    // Previously: no LaundryBusiness → no limit lookup → unlimited uploads.
    onStarter({ storageGB: 5 })
    mocks.fileUploadAggregate.mockResolvedValue({ _sum: { size: 5 * GB } })
    const r = await checkStorageAllowance({ platformBusinessId: 'pb-commerce', incomingBytes: 1 })
    expect(r.ok).toBe(false)
  })

  it('the used figure counts only this tenant', async () => {
    onStarter({ storageGB: 15 })
    await checkStorageAllowance({ laundryBusinessId: 'lb1', platformBusinessId: 'pb-current', incomingBytes: 1 })
    expect(mocks.fileUploadAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'pb-current', status: 'COMPLETED' } }),
    )
  })
})

// ── Every write path is wired ──────────────────────────────────────────────
describe('no write path escapes the ledger', () => {
  const paths: [string, string][] = [
    ['business logo', 'src/app/api/business/logo/upload/route.ts'],
    ['category image', 'src/app/api/core/businesses/[businessId]/categories/route.ts'],
    ['billing proof', 'src/app/api/admin/billing/proof-upload/route.ts'],
    ['CRM recording', 'src/lib/laundry-crm-comms.ts'],
    ['core upload', 'src/app/api/core/upload/route.ts'],
  ]

  for (const [label, file] of paths) {
    it(`${label} records the upload`, () => {
      const src = read(file)
      expect(src).toContain('recordUpload(')
      expect(src).toContain('resolveMeteringTarget(')
      expect(src).toContain('platformBusinessId: target.platformBusinessId')
    })
  }

  it('the logo is filed as a brand asset, never a garment', () => {
    expect(read('src/app/api/business/logo/upload/route.ts')).toContain("category: 'branding'")
  })

  it('the branding uploader names its folder', () => {
    // Without it the endpoint defaults to "products" → Garment Images.
    expect(read('src/components/laundry/views/laundry-branding-settings.tsx')).toContain('fd.append("folder", "branding")')
  })

  it('core upload no longer gates metering on being a laundry business', () => {
    const src = read('src/app/api/core/upload/route.ts')
    expect(src).not.toContain('if (laundryBusinessId) {')
    expect(src).toContain('resolveMeteringTarget(businessId)')
  })

  it('the recording ledger path never stores a LaundryBusiness id as the tenant', () => {
    const src = read('src/lib/laundry-crm-comms.ts')
    expect(src).toContain('resolveMeteringTarget(businessId)')
    expect(src).toContain('platformBusinessId: target.platformBusinessId')
  })
})

// ── The panel says what it measures ────────────────────────────────────────
describe('the dashboard names what it counts', () => {
  const widget = () => read('src/components/laundry/views/laundry-storage-widget.tsx')

  it('it is titled File Storage Usage', () => {
    expect(widget()).toContain('File Storage Usage')
  })

  it('it says database records are excluded', () => {
    const w = widget()
    expect(w).toContain('Measures uploaded files stored for this business')
    expect(w).toContain('customers, orders and garments are not included')
  })
})
