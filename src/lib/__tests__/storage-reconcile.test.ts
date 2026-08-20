import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// Backfilling the pre-ledger files.
//
// Metering began on 2026-08-13. Anything uploaded before that — this tenant's
// logo (2026-08-10) and favicon (2026-07-04) — is real bytes on disk that the
// ledger has never seen, which is why a business with a visible logo reported
// 0 B across 0 files.
//
// The scan must find them, file them under the right tenant and the right
// category, and be safe to run twice.
// ============================================================================

const FILES: Record<string, { size: number }> = {
  // The two known legacy brand assets, in the directories they really live in.
  'products/pb-laundry/1786356288633-bmrj1x.png': { size: 263494 },
  'favicons/pb-laundry/1783143867227-69c2ib.png': { size: 122886 },
  // An ordinary audit photo, already recorded by the live ledger.
  'pb-laundry/audit/known.jpg': { size: 5000 },
  // A CRM recording — directory keyed on the LAUNDRY id, not the platform one.
  'crm-recordings/lb-laundry/rec-1.mp3': { size: 900 },
  // Scratch space and a platform asset: neither is tenant storage.
  'temp/pb-laundry/scratch.png': { size: 40 },
  'platform/brand/quantix-logo.svg': { size: 77 },
}

const mocks = vi.hoisted(() => ({
  businessFindMany: vi.fn(),
  laundryFindMany: vi.fn(),
  fileUploadFindMany: vi.fn(),
  fileUploadCreate: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    business: { findMany: mocks.businessFindMany },
    laundryBusiness: { findMany: mocks.laundryFindMany },
    fileUpload: { findMany: mocks.fileUploadFindMany, create: mocks.fileUploadCreate },
  },
}))

vi.mock('@/lib/upload-root', () => ({ UPLOAD_ROOT: '/var/www/uploads' }))

// A fake disk: readdir/stat answer from the FILES map above.
vi.mock('fs/promises', () => {
  const dirOf = (p: string) => p.replace(/^\/var\/www\/uploads\/?/, '').replace(/\/$/, '')
  const readdir = async (dir: string) => {
      const prefix = dirOf(dir)
      const seen = new Map<string, boolean>() // name → isDirectory
      for (const path of Object.keys(FILES)) {
        if (prefix && !path.startsWith(prefix + '/')) continue
        const rest = prefix ? path.slice(prefix.length + 1) : path
        const [head, ...tail] = rest.split('/')
        if (!head) continue
        seen.set(head, tail.length > 0)
      }
      return [...seen.entries()].map(([name, isDir]) => ({
        name, isDirectory: () => isDir, isFile: () => !isDir,
      }))
  }
  const stat = async (p: string) => {
    const f = FILES[dirOf(p)]
    if (!f) throw new Error('ENOENT')
    return { size: f.size }
  }
  // Other modules in the import graph reach for the default export.
  const api = { readdir, stat, writeFile: async () => {}, unlink: async () => {}, mkdir: async () => {}, access: async () => {} }
  return { ...api, default: api }
})

import { reconcileStorage } from '@/lib/storage-reconcile'

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.businessFindMany.mockResolvedValue([{
    id: 'pb-laundry',
    name: 'Laundry & Drycleaners',
    // Business.logo / .favicon point at the legacy files — that is how a brand
    // asset is recognised, not by its directory.
    logo: '/uploads/products/pb-laundry/1786356288633-bmrj1x.png',
    favicon: '/uploads/favicons/pb-laundry/1783143867227-69c2ib.png',
  }])
  mocks.laundryFindMany.mockResolvedValue([{ id: 'lb-laundry', platformBusinessId: 'pb-laundry' }])
  mocks.fileUploadFindMany.mockResolvedValue([{ uploadPath: '/uploads/pb-laundry/audit/known.jpg' }])
  mocks.fileUploadCreate.mockResolvedValue({})
})

// ── Discovery ──────────────────────────────────────────────────────────────
describe('the dry run finds what is really on disk', () => {
  it('reports every required figure without writing anything', async () => {
    const r = await reconcileStorage()
    expect(r.applied).toBe(false)
    expect(mocks.fileUploadCreate).not.toHaveBeenCalled()
    expect(r.filesDiscovered).toBe(6)
    expect(r.filesClassifiable).toBe(4)   // 2 brand assets + audit + recording
    expect(r.filesUnclassifiable).toBe(2) // temp + platform asset
    expect(r.alreadyInLedger).toBe(1)     // the audit photo
    expect(r.wouldInsert).toBe(3)
  })

  it('the known legacy logo and favicon are detected', async () => {
    const r = await reconcileStorage()
    const paths = r.byCategory.find((c) => c.category === 'branding')
    expect(paths).toBeTruthy()
    expect(paths!.files).toBe(2)
    expect(paths!.bytes).toBe(263494 + 122886) // 386,380
  })

  it('they are filed as brand assets even though one sits in /products/', async () => {
    // Directory says "products" → would resolve to garments. The Business.logo
    // pointer is what makes it branding.
    const r = await reconcileStorage()
    expect(r.byCategory.map((c) => c.category)).not.toContain('garments')
  })

  it('the per-file list names the tenant and category of each file', async () => {
    // The reviewable part of a dry run: totals alone cannot tell you whether
    // THIS business's logo was classified correctly.
    const r = await reconcileStorage()
    const logo = r.files.find((f) => f.path.endsWith('1786356288633-bmrj1x.png'))
    expect(logo).toBeTruthy()
    expect(logo!.category).toBe('branding')
    expect(logo!.businessId).toBe('pb-laundry')
    expect(logo!.size).toBe(263494)
    expect(logo!.inLedger).toBe(false)

    const known = r.files.find((f) => f.path.endsWith('known.jpg'))
    expect(known!.inLedger).toBe(true) // already recorded, will not insert again

    const rec = r.files.find((f) => f.path.includes('crm-recordings'))
    expect(rec!.viaLaundryId).toBe(true)
    expect(rec!.businessId).toBe('pb-laundry')
  })

  it('bytes are attributed to the owning business', async () => {
    const r = await reconcileStorage()
    expect(r.byBusiness).toHaveLength(1)
    expect(r.byBusiness[0].businessId).toBe('pb-laundry')
    expect(r.byBusiness[0].name).toBe('Laundry & Drycleaners')
    expect(r.byBusiness[0].bytes).toBe(263494 + 122886 + 900)
  })

  it('temp and platform assets are held back for review, never charged', async () => {
    const r = await reconcileStorage()
    const reasons = r.manualReview.map((m) => m.reason)
    expect(reasons).toContain('temp (excluded from quota)')
    expect(reasons).toContain('no tenant id in path')
    expect(r.manualReview.map((m) => m.path)).toContain('/uploads/platform/brand/quantix-logo.svg')
  })
})

// ── The CRM tenant mapping ─────────────────────────────────────────────────
describe('a recording is charged to the platform business', () => {
  it('a directory named with a LaundryBusiness id still resolves', async () => {
    const r = await reconcileStorage({ apply: true })
    const rec = mocks.fileUploadCreate.mock.calls
      .map((c) => c[0].data)
      .find((d) => d.uploadPath.includes('crm-recordings'))
    expect(rec).toBeTruthy()
    // NOT lb-laundry — that id belongs to no tenant in this table.
    expect(rec.businessId).toBe('pb-laundry')
  })

  it('without the mapping it would have been unclassifiable', async () => {
    mocks.laundryFindMany.mockResolvedValue([]) // no laundry → no mapping
    const r = await reconcileStorage()
    expect(r.manualReview.some((m) => m.path.includes('crm-recordings'))).toBe(true)
  })
})

// ── Idempotency ────────────────────────────────────────────────────────────
describe('running it twice cannot double-count', () => {
  it('the second run inserts nothing', async () => {
    const first = await reconcileStorage({ apply: true })
    expect(first.inserted).toBe(3)

    // The ledger now holds everything the first run wrote.
    const written = mocks.fileUploadCreate.mock.calls.map((c) => ({ uploadPath: c[0].data.uploadPath }))
    mocks.fileUploadFindMany.mockResolvedValue([
      { uploadPath: '/uploads/pb-laundry/audit/known.jpg' }, ...written,
    ])
    mocks.fileUploadCreate.mockClear()

    const second = await reconcileStorage({ apply: true })
    expect(second.wouldInsert).toBe(0)
    expect(second.inserted).toBe(0)
    expect(mocks.fileUploadCreate).not.toHaveBeenCalled()
  })

  it('dedupe is on uploadPath, which is unique per file', () => {
    expect(read('src/lib/storage-reconcile.ts')).toContain('existing.has(f.uploadPath)')
  })

  it('rows are inserted with status COMPLETED and a real category', async () => {
    await reconcileStorage({ apply: true })
    for (const call of mocks.fileUploadCreate.mock.calls) {
      const d = call[0].data
      expect(d.status).toBe('COMPLETED')
      expect(d.category).toBeTruthy()
      expect(d.category).not.toBe('temp')
      expect(d.size).toBeGreaterThan(0)
    }
  })
})

// ── Safety ─────────────────────────────────────────────────────────────────
describe('the reconciler only reads the disk', () => {
  const src = () => read('src/lib/storage-reconcile.ts')

  it('it never deletes or rewrites a file', () => {
    const s = src()
    expect(s).not.toContain('unlink')
    expect(s).not.toContain('writeFile')
    expect(s).not.toContain('rm(')
    expect(s).not.toContain('rename')
  })

  it('it never updates an existing ledger row', () => {
    const s = src()
    expect(s).not.toContain('fileUpload.update')
    expect(s).not.toContain('fileUpload.delete')
  })

  it('it writes nothing unless apply is explicitly true', () => {
    expect(src()).toContain('const apply = opts.apply === true')
  })

  it('the endpoint is Super Admin only and dry-runs by default', () => {
    const route = read('src/app/api/admin/storage/reconcile/route.ts')
    expect(route).toContain("requiredRoles: [\"QUANTIX_SUPER_ADMIN\"]")
    expect(route).toContain('apply = body?.apply === true')
    expect(route).not.toContain('export async function GET')
  })

  it('the CLI and the endpoint share one implementation', () => {
    expect(read('scripts/reconcile-storage.ts')).toContain('reconcileStorage')
    expect(read('scripts/reconcile-storage.ts')).not.toContain('readdir')
    expect(read('src/app/api/admin/storage/reconcile/route.ts')).toContain('reconcileStorage')
  })
})
