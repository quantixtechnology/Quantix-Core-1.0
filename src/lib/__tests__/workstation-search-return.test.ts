import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Level, actionToLevel } from '@/lib/laundry-rbac-registry'
import { SYSTEM_ROLES } from '@/lib/laundry-rbac-catalog'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const API = 'src/app/api/laundry/processing/route.ts'
const PROC = 'src/app/api/laundry/items/[id]/process/route.ts'
const WS = 'src/components/laundry/views/laundry-workstation.tsx'
const QC = 'src/components/laundry/views/laundry-drying-qc-workstation.tsx'
const FIN = 'src/components/laundry/views/laundry-finishing-workstation.tsx'

// ============================================================================
// BUG 1 — find a garment by its GAR number
// ============================================================================
describe('BUG 1 · GAR search', () => {
  const src = code(API)

  it('searches GAR, ITM, barcode, garment name AND order number', () => {
    for (const field of ['garmentScanCode', 'itemNumber', 'barcode', 'garmentName']) {
      expect(src, `search must cover ${field}`).toContain(`{ ${field}: { contains: search } }`)
    }
    expect(src).toContain('{ order: { orderNumber: { contains: search } } }')
  })

  it('the search is composed under AND, so a bucket OR cannot replace it', () => {
    // Spreading an OR into a where that already has one silently dropped the
    // search for that bucket.
    expect(src).toContain('const baseWhere = searchFilter ? { ...queueWhere, AND: [searchFilter] } : queueWhere')
    expect(src).not.toContain('...codeOr')
  })

  it('BOTH the waiting and the in-progress buckets are searched', () => {
    // Each bucket derives from baseWhere, which carries the search.
    expect(src).toContain('{ ...baseWhere, processingStatus: "WAITING" }')
    expect(src).toContain('{ ...baseWhere, processingStatus: { in: ACTIVE_STATUSES } }')
  })

  it('a garment IN_PROGRESS is returned in the active bucket, so it renders under In Progress', () => {
    // The client splits on the same statuses it always has.
    expect(code(WS)).toContain('i.processingStatus === "IN_PROGRESS" || i.processingStatus === "PAUSED"')
    expect(code(WS)).toContain('i.processingStatus === "WAITING"')
  })

  it('the workload counts are NOT narrowed by the search', () => {
    // Counts come from queueWhere (no search); rows come from baseWhere (search).
    expect(src).toContain('const queueWhere = { order: { businessId: biz.id }, processingStage: stage }')
    const grouped = src.slice(src.indexOf('groupBy({'), src.indexOf('queueCounts = {'))
    expect(grouped).toContain('where: queueWhere')
    expect(grouped).not.toContain('where: baseWhere')
  })

  // Garment search moved OFF this endpoint into the global, race-safe
  // /processing/find (see garment-search.test.ts). The queue endpoint keeps its
  // own trimmed filter for any caller that still passes one.
  it('the queue endpoint still trims its search parameter', () => {
    expect(src).toContain('const search = (sp.get("search") || "").trim()')
  })

  it('the workstation no longer sends search to the queue endpoint at all', () => {
    expect(code(WS)).not.toContain('p.set("search"')
    expect(code(WS)).toContain('useGarmentSearch')
  })

  it('clearing the search restores the queue — no search means no filter', () => {
    expect(src).toContain(': null')
    expect(src).toContain('searchFilter ? { ...queueWhere, AND: [searchFilter] } : queueWhere')
  })

  it('searching is a READ — it writes nothing', () => {
    expect(src).not.toContain('laundryOrderItem.update')
    expect(src).not.toContain('laundryItemEvent.create')
    expect(src).not.toContain('laundryOrder.update')
  })

  it('the fix is not "raise the cap"', () => {
    // The caps are unchanged; the search is what narrows the set.
    expect((src.match(/take: 200/g) ?? []).length).toBe(3)
  })
})

// ============================================================================
// BUG 2 — Accountant could not return a garment to the queue
// ============================================================================
describe('BUG 2 · Return to Queue permission', () => {
  it('the phantom action is gone from every guard and check', () => {
    for (const f of [PROC, WS, QC, FIN]) {
      expect(code(f), `${f} still references return_queue`).not.toContain('return_queue')
    }
  })

  it('return_queue was never a real action — it resolved to VIEW and guarded nothing', () => {
    expect(actionToLevel('return_queue')).toBe(Level.VIEW)
    // whereas the action it now uses is a genuine write level
    expect(actionToLevel('process')).toBe(Level.CREATE)
  })

  it('the server guards RETURN with the workstation permission', () => {
    expect(code(PROC)).toContain('else if (action === "RETURN") permAction = "process"')
    expect(code(PROC)).toContain('`processing.${screen}.${permAction}`')
  })

  it('every workstation derives the button from that same screen level', () => {
    expect(code(WS)).toContain('const hasReturnPerm = level(screenKey) >= Level.CREATE')
    expect(code(QC)).toContain('level("processing.quality_check") >= Level.CREATE')
    expect(code(FIN)).toContain('>= Level.CREATE')
  })

  it('no workstation hand-rolls an rbac fetch any more', () => {
    for (const f of [WS, QC, FIN]) {
      expect(code(f), `${f} must use the shared hook`).not.toContain('rbac/me')
      expect(code(f)).toContain('useLaundryPermissions')
    }
  })

  it('the old check could only ever pass for an owner', () => {
    // /api/laundry/rbac/me returns levels — it has never returned `permissions`,
    // so `j.data.permissions?.includes(key)` was always undefined.
    const me = read('src/app/api/laundry/rbac/me/route.ts')
    expect(me).toContain('levels: levelsObj')
    expect(me).not.toContain('permissions:')
  })

  // The actual acceptance case.
  it('ACCOUNTANT holds EDIT on every processing screen, so it now qualifies', () => {
    const acct = SYSTEM_ROLES.find((r) => r.code === 'ACCOUNTANT')
    expect(acct).toBeDefined()
    const screens = acct!.screens()
    const processing = screens.filter((s) => s.screenKey.startsWith('processing.'))
    expect(processing.length).toBeGreaterThan(0)
    for (const s of processing) {
      expect(s.level, `${s.screenKey}`).toBe(Level.EDIT)
      expect(s.level >= Level.CREATE).toBe(true) // → Return to Queue allowed
    }
  })

  it('Accountant is full-access by role code, not by ownership', () => {
    const acct = SYSTEM_ROLES.find((r) => r.code === 'ACCOUNTANT')!
    expect(acct.isOwner).toBeFalsy()
  })

  it('a VIEW-only role still cannot return a garment', () => {
    expect(Level.VIEW >= Level.CREATE).toBe(false)
  })
})

describe('the processing flow itself was not touched', () => {
  it('START / COMPLETE / PAUSE / RESUME / QC keep their own permissions', () => {
    const src = code(PROC)
    expect(src).toContain('if (action === "QC_FAIL" || action === "REJECT") permAction = "override"')
    expect(src).toContain('else permAction = "process"')
  })

  it('RETURN still only moves IN_PROGRESS back to WAITING, at the same stage', () => {
    const src = read(PROC)
    const ret = src.slice(src.indexOf('case "RETURN":'), src.indexOf('case "REJECT":'))
    // guarded to in-progress, and the ONLY thing it sets is the status
    expect(ret).toContain('if (curStatus !== "IN_PROGRESS")')
    expect(ret).toContain('status = "WAITING"')
    for (const forbidden of ['processingStage =', 'orderId', 'serviceId', 'weightKg', 'delete']) {
      expect(ret, `RETURN must not touch ${forbidden}`).not.toContain(forbidden)
    }
    // and it keeps its audit event
    expect(src).toContain('laundryItemEvent.create')
  })
})
