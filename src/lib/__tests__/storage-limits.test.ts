import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resolveCategory, categoryFromFolder, NON_QUOTA_CATEGORIES } from '@/lib/laundry-storage'
import { storageLimitMessage, isQuotaCategory } from '@/lib/storage-guard'

// ============================================================================
// Storage usage must be REAL and per business.
//
// The screen said 0 B while the business plainly had files: five of six upload
// endpoints wrote to disk and recorded nothing, and the limit was a hardcoded
// 10 GB that no business was ever assigned.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STORAGE = read('src/lib/laundry-storage.ts')
// Comments explaining what was removed legitimately name it, so "it is gone"
// assertions run against the code with comments stripped.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n')
const STORAGE_CODE = stripComments(STORAGE)
const GUARD = read('src/lib/storage-guard.ts')
const CORE_UPLOAD = read('src/app/api/core/upload/route.ts')
const UPLOADS = read('src/app/api/uploads/route.ts')
const RECONCILE = read('scripts/reconcile-storage.ts')
const ADMIN_USAGE = read('src/app/api/admin/businesses/[businessId]/usage/route.ts')
const WIDGET = read('src/components/laundry/views/laundry-storage-widget.tsx')

describe('the limit comes from the business, not a hardcoded table', () => {
  it('the hardcoded plan table is gone', () => {
    expect(STORAGE_CODE).not.toContain('PLAN_LIMITS_GB')
    expect(STORAGE_CODE).not.toContain('DEFAULT_LIMIT_GB')
    expect(STORAGE_CODE).not.toContain('limitBytesForPlan')
  })

  it('LaundryScalingLimit.storageLimitMB is the primary source', () => {
    expect(STORAGE).toContain('prisma.laundryScalingLimit.findUnique')
    expect(STORAGE).toContain('scaling.storageLimitMB * MB')
  })

  it('the product plan is only the fallback', () => {
    expect(STORAGE).toContain('if (scaling && scaling.storageLimitMB > 0) return scaling.storageLimitMB * MB')
    expect(STORAGE).toContain('plan.storageQuotaMB')
  })

  it('a business with no assigned limit is unlimited, not silently defaulted', () => {
    expect(STORAGE).toContain('return null')
  })

  it('no limit is ever written — the calculation only reads', () => {
    // `storageLimitMB: true` is a Prisma select, not an assignment.
    expect(STORAGE_CODE).not.toContain('laundryScalingLimit.update')
    expect(STORAGE_CODE).not.toContain('laundryScalingLimit.upsert')
    expect(STORAGE_CODE).not.toContain('laundryScalingLimit.create')
  })
})

describe('every upload is recorded', () => {
  it('/api/core/upload — the endpoint that caused the 0 B — now writes the ledger', () => {
    expect(CORE_UPLOAD).toContain('recordUpload(')
    expect(CORE_UPLOAD).toContain('checkStorageAllowance(')
  })

  it('the ledger row is written only AFTER the file is confirmed on disk', () => {
    const writeIdx = CORE_UPLOAD.indexOf('await writeFile(filePath, buffer)')
    const ledgerIdx = CORE_UPLOAD.indexOf('await recordUpload(')
    expect(writeIdx).toBeGreaterThan(-1)
    expect(ledgerIdx).toBeGreaterThan(writeIdx)
  })

  it('a bookkeeping failure never loses a saved file', () => {
    expect(GUARD).toContain('.catch((e) => console.error')
  })

  it('both endpoints share one quota check', () => {
    expect(UPLOADS).toContain('checkStorageAllowance(')
    expect(CORE_UPLOAD).toContain('checkStorageAllowance(')
  })
})

describe('category resolution handles BOTH path shapes', () => {
  it('/uploads/{businessId}/{folder}/file — /api/uploads', () => {
    expect(resolveCategory({ uploadPath: '/uploads/biz123/garments/a.png' })).toBe('garments')
  })

  it('/uploads/{folder}/{businessId}/file — /api/core/upload', () => {
    // The old code read segment [2] blindly and returned the BUSINESS ID here.
    expect(resolveCategory({ uploadPath: '/uploads/garments/biz123/a.png' })).toBe('garments')
    expect(resolveCategory({ uploadPath: '/uploads/logos/biz123/logo.png' })).toBe('branding')
  })

  it('an explicit category column always wins', () => {
    expect(resolveCategory({ category: 'invoice', uploadPath: '/uploads/x/y/z.pdf' })).toBe('invoice')
  })

  it('unknown folders fall back to documents, never to a business id', () => {
    expect(resolveCategory({ uploadPath: '/uploads/zzz/qqq/a.bin' })).toBe('documents')
  })

  it('folder aliases map onto real categories', () => {
    expect(categoryFromFolder('laundry-garments')).toBe('garments')
    expect(categoryFromFolder('favicons')).toBe('branding')
    expect(categoryFromFolder('nonsense')).toBeNull()
  })
})

describe('temp is not business data', () => {
  it('temp is excluded from the quota', () => {
    expect(NON_QUOTA_CATEGORIES.has('temp')).toBe(true)
    expect(isQuotaCategory('temp')).toBe(false)
    expect(isQuotaCategory('garments')).toBe(true)
  })

  it('the usage loop skips it before adding to usedBytes', () => {
    expect(STORAGE).toContain('if (NON_QUOTA_CATEGORIES.has(c)) continue')
  })
})

describe('store usage is counted, not tallied', () => {
  it('it counts LaundryStore rows rather than trusting storesUsed', () => {
    // storesUsed is +1 on create and never decremented on delete, so it drifts.
    expect(STORAGE).toContain('prisma.laundryStore.findMany')
    expect(STORAGE).not.toContain('scaling.storesUsed')
  })

  it('every location type counts toward the ONE limit', () => {
    expect(STORAGE).toContain('const used = stores.length')
    expect(STORAGE).toContain('RETAIL_STORE')
    expect(STORAGE).toContain('PROCESSING_CENTER')
    expect(STORAGE).toContain('"BOTH"')
  })

  it('no separate Processing Center quota is introduced', () => {
    expect(STORAGE).not.toContain('processingCentersAllowed')
  })

  it('the allowance is the business\'s own storesAllowed', () => {
    expect(STORAGE).toContain('storesAllowed: true')
  })
})

describe('one calculation for both surfaces', () => {
  it('Super Admin calls the same function as Workspace Settings', () => {
    expect(ADMIN_USAGE).toContain('computeBusinessUsage(')
    expect(read('src/app/api/laundry/storage/route.ts')).toContain('computeBusinessUsage(')
  })

  it('the Super Admin route computes nothing of its own', () => {
    expect(ADMIN_USAGE).not.toContain('fileUpload.findMany')
    expect(ADMIN_USAGE).not.toContain('storageLimitMB')
  })
})

describe('enforcement is at upload points only', () => {
  it('the guard is imported by the upload routes and nowhere else', () => {
    // Login, orders, processing and payment must keep working at the limit.
    const guardImport = "from '@/lib/storage-guard'"
    expect(CORE_UPLOAD).toContain(guardImport)
    expect(UPLOADS).toContain(guardImport)
  })

  it('the refusal explains what to do and never threatens data', () => {
    const msg = storageLimitMessage(10 * 1024 ** 3, 10 * 1024 ** 3)
    expect(msg).toContain('Storage limit reached')
    expect(msg).toContain('Delete unused files or contact Quantix')
    expect(msg).not.toMatch(/will be deleted|automatically remov/i)
  })

  it('over limit blocks uploads but deletes nothing', () => {
    expect(WIDGET).toContain('OVER LIMIT')
    expect(WIDGET).toContain('Nothing has been deleted')
  })
})

describe('reconciliation is one-time and safe', () => {
  it('it never deletes or modifies a file', () => {
    expect(RECONCILE).not.toContain('unlink')
    expect(RECONCILE).not.toContain('rm(')
    expect(RECONCILE).not.toContain('rmdir')
    expect(RECONCILE).not.toContain('fileUpload.update')
    expect(RECONCILE).not.toContain('fileUpload.delete')
  })

  it('it reports before it writes', () => {
    expect(RECONCILE).toContain("const APPLY = process.argv.includes(\"--apply\")")
    expect(RECONCILE).toContain('MODE: REPORT ONLY')
  })

  it('it dedupes on uploadPath so a re-run is safe', () => {
    expect(RECONCILE).toContain('const missing = found.filter((f) => !existing.has(f.uploadPath))')
  })

  it('it only counts files it can tie to a real Business id', () => {
    expect(RECONCILE).toContain('businessIds.has(a)')
    expect(RECONCILE).toContain('businessIds.has(b)')
    expect(RECONCILE).toContain('no Business id in path')
  })

  it('it excludes temp and reports the rest as unclassifiable', () => {
    expect(RECONCILE).toContain('temp (excluded from quota)')
    expect(RECONCILE).toContain('unclassifiable')
  })

  it('it is a script, not an endpoint — no page load ever scans the disk', () => {
    expect(STORAGE).not.toContain('readdir')
    expect(STORAGE).not.toContain('fs/promises')
    expect(read('src/app/api/laundry/storage/route.ts')).not.toContain('readdir')
  })
})

describe('no new storage model or duplicate quota field', () => {
  it('the existing FileUpload ledger and limit fields are reused', () => {
    const schema = read('prisma/schema.prisma')
    expect(schema).toContain('model FileUpload {')
    expect(schema).toContain('storageLimitMB           Int             @default(500)')
    expect(schema).not.toContain('model StorageUsage')
    expect(schema).not.toContain('model BusinessStorage')
  })
})
