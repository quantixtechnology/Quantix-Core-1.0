import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GAR repair — behavioural regression tests.
//
// These run the REAL backfill and the REAL GENERATE_ALL handler against an
// in-memory Prisma, because the invariants worth protecting are about what
// gets WRITTEN, not about what the source text says:
//
//   • an existing GAR is never renumbered, re-minted or overwritten
//   • a NULL garmentScanCode gets exactly one GAR
//   • a legacy ITM barcode is repointed at the row's GAR
//   • GENERATE_ALL heals items that were ALREADY printed with an ITM barcode
//     (the bug: it only looked at !barcodeGenerated, so those were stranded)
//   • one tenant's repair never touches another's rows
// ============================================================================

interface ItemRow {
  id: string
  orderId: string
  itemNumber: string | null
  garmentScanCode: string | null
  barcode: string | null
  barcodeGenerated: boolean
  barcodePrintedAt: Date | null
  serviceId: string | null
  serviceName: string | null
  garmentName: string | null
  processingStage: string | null
  processFlow: string | null
}

// vi.mock is hoisted above every import, so the in-memory Prisma has to be
// hoisted with it — otherwise the factory closes over an uninitialised binding.
const H = vi.hoisted(() => {
  const state = {
    items: [] as ItemRow[],
    orders: [] as { id: string; businessId: string; paymentStatus: string }[],
    counter: null as { id: string; next: number } | null,
    events: [] as { itemId: string; action: string }[],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = (v: any) => JSON.parse(JSON.stringify(v))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function matches(row: ItemRow, where: any): boolean {
    if (!where) return true
    if (where.id?.in && !where.id.in.includes(row.id)) return false
    if (typeof where.id === 'string' && row.id !== where.id) return false
    if (where.orderId && row.orderId !== where.orderId) return false
    if (where.order?.businessId) {
      const o = state.orders.find((x) => x.id === row.orderId)
      if (!o || o.businessId !== where.order.businessId) return false
    }
    if (where.garmentScanCode !== undefined) {
      const g = where.garmentScanCode
      if (g === null && row.garmentScanCode !== null) return false
      if (g && typeof g === 'object' && 'not' in g && g.not === null && row.garmentScanCode === null) return false
    }
    return true
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function query(args: any): ItemRow[] {
    let out = state.items.filter((r) => matches(r, args?.where))
    if (args?.orderBy?.id === 'asc') out = [...out].sort((a, b) => a.id.localeCompare(b.id))
    if (args?.orderBy?.garmentScanCode === 'desc') {
      out = [...out].sort((a, b) => String(b.garmentScanCode ?? '').localeCompare(String(a.garmentScanCode ?? '')))
    }
    if (args?.cursor?.id) {
      const i = out.findIndex((r) => r.id === args.cursor.id)
      out = i >= 0 ? out.slice(i + (args.skip ?? 0)) : []
    }
    if (args?.take) out = out.slice(0, args.take)
    return out
  }

  const prismaMock = {
    laundryOrderItem: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (args: any) => query(args).map(clone)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (args: any) => { const r = query(args)[0]; return r ? clone(r) : null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (args: any) => { const r = state.items.find((x) => x.id === args.where.id); return r ? clone(r) : null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (args: any) => {
        const r = state.items.find((x) => x.id === args.where.id)
        if (!r) throw new Error(`no item ${args.where.id}`)
        Object.assign(r, args.data)
        return clone(r)
      }),
    },
    laundryGarSequenceCounter: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert: vi.fn(async (args: any) => {
        if (!state.counter) state.counter = { ...args.create }
        else if (args.update?.next?.increment) state.counter.next += args.update.next.increment
        return clone(state.counter)
      }),
      findUnique: vi.fn(async () => (state.counter ? clone(state.counter) : null)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async (args: any) => { state.counter = { ...args.data }; return clone(state.counter) }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (args: any) => { state.counter = { ...(state.counter as { id: string; next: number }), ...args.data }; return clone(state.counter) }),
    },
    laundryOrder: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (args: any) => {
        const o = state.orders.find((x) => x.id === args.where.id)
        if (!o) return null
        return { ...o, items: state.items.filter((i) => i.orderId === o.id).map(clone) }
      }),
    },
    laundryItemEvent: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async (args: any) => { state.events.push({ itemId: args.data.itemId, action: args.data.action }); return args.data }),
    },
    laundryBusiness: { findUnique: vi.fn(async () => ({ paymentPolicy: 'BEFORE_DELIVERY' })) },
  }
  return { state, prismaMock }
})

const { state, prismaMock } = H
const events = state.events

function item(p: Partial<ItemRow> & { id: string; orderId: string }): ItemRow {
  return {
    itemNumber: null, garmentScanCode: null, barcode: null, barcodeGenerated: false,
    barcodePrintedAt: null, serviceId: 's1', serviceName: 'Wash', garmentName: 'Shirt',
    processingStage: 'RECEIVED', processFlow: null, ...p,
  }
}

/** Replace the in-memory item table (the array identity is kept stable). */
const seed = (rows: ItemRow[]) => { state.items.length = 0; state.items.push(...rows) }
const rows = () => state.items

// Reference the hoisted container directly — the destructured aliases below
// are declared after vi.mock is lifted to the top of the module.
vi.mock('@/lib/prisma', () => ({ prisma: H.prismaMock }))
vi.mock('@/lib/laundry-rbac', () => ({
  requireLaundryPermission: vi.fn(async () => ({ ok: true })),
  requireLaundryMember: vi.fn(async () => ({ ok: true })),
}))

import { auditGarScanCodes, backfillGarScanCodes, isGarScanCode, isLegacyItmBarcode } from '@/lib/laundry-codes'
import { POST as BARCODES } from '@/app/api/laundry/orders/[id]/barcodes/route'

const ITM = 'ITM-ORD-STR-BUS-202608-0008-002-000002-0001'
const GAR_A = 'GAR000000000086'

const post = (orderId: string, body: Record<string, unknown>) =>
  BARCODES(
    new Request('http://t/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: orderId }) },
  )

beforeEach(() => {
  seed([])
  state.orders.length = 0
  state.orders.push({ id: 'o1', businessId: 'lb1', paymentStatus: 'PAID' })
  state.counter = null
  events.length = 0
  vi.clearAllMocks()
})

// ── shape helpers ──────────────────────────────────────────────────────────

describe('GAR / ITM shape recognition', () => {
  it('recognises a GAR and rejects everything else', () => {
    expect(isGarScanCode('GAR000000000086')).toBe(true)
    expect(isGarScanCode('GAR0000000000860')).toBe(true) // counter past 12 digits
    expect(isGarScanCode(null)).toBe(false)
    expect(isGarScanCode('GAR12')).toBe(false)
    expect(isGarScanCode(ITM)).toBe(false)
    expect(isGarScanCode('V8BAG001')).toBe(false) // a bag is not a garment
  })

  it('recognises the legacy ITM barcode', () => {
    expect(isLegacyItmBarcode(ITM)).toBe(true)
    expect(isLegacyItmBarcode(GAR_A)).toBe(false)
    expect(isLegacyItmBarcode(null)).toBe(false)
  })
})

// ── backfill ───────────────────────────────────────────────────────────────

describe('backfillGarScanCodes', () => {
  it('mints a GAR for a NULL garmentScanCode and points the barcode at it', async () => {
    seed([item({ id: 'i1', orderId: 'o1', itemNumber: ITM, barcode: ITM })])
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(r.filled).toBe(1)
    expect(isGarScanCode(rows()[0].garmentScanCode)).toBe(true)
    expect(rows()[0].barcode).toBe(rows()[0].garmentScanCode)
    // The legacy identity is preserved — old labels must keep scanning.
    expect(rows()[0].itemNumber).toBe(ITM)
  })

  it('NEVER changes an existing valid GAR', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: GAR_A, barcode: GAR_A })])
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(r.filled).toBe(0)
    expect(r.barcodesRewritten).toBe(0)
    expect(rows()[0].garmentScanCode).toBe(GAR_A)
  })

  it('migrates a legacy ITM barcode onto the EXISTING GAR without minting a new one', async () => {
    seed([item({ id: 'i1', orderId: 'o1', itemNumber: ITM, garmentScanCode: GAR_A, barcode: ITM })])
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(r.filled).toBe(0)              // no new GAR
    expect(r.barcodesRewritten).toBe(1)
    expect(rows()[0].garmentScanCode).toBe(GAR_A) // unchanged
    expect(rows()[0].barcode).toBe(GAR_A)
    expect(prismaMock.laundryGarSequenceCounter.upsert).not.toHaveBeenCalled() // nothing was allocated
  })

  it('leaves an unrecognised garmentScanCode alone and reports it', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: 'LEGACY-XYZ', barcode: ITM })])
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(r.invalidGarSkipped).toBe(1)
    expect(rows()[0].garmentScanCode).toBe('LEGACY-XYZ')
    expect(rows()[0].barcode).toBe(ITM)
  })

  it('does not overwrite a barcode that is neither empty nor ITM-shaped', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: GAR_A, barcode: 'SOMETHING-ELSE' })])
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(r.foreignBarcodeSkipped).toBe(1)
    expect(rows()[0].barcode).toBe('SOMETHING-ELSE')
  })

  it('never touches another tenant', async () => {
    state.orders.push({ id: 'o2', businessId: 'lb2', paymentStatus: 'PAID' })
    seed([
      item({ id: 'i1', orderId: 'o1', barcode: ITM }),
      item({ id: 'i2', orderId: 'o2', barcode: ITM }),
    ])
    await backfillGarScanCodes({ scope: { businessId: 'lb1' } })
    expect(isGarScanCode(rows()[0].garmentScanCode)).toBe(true)
    expect(rows()[1].garmentScanCode).toBeNull() // other tenant untouched
    expect(rows()[1].barcode).toBe(ITM)
  })

  it('is idempotent — a second run writes nothing', async () => {
    seed([
      item({ id: 'i1', orderId: 'o1', barcode: ITM }),
      item({ id: 'i2', orderId: 'o1', garmentScanCode: GAR_A, barcode: ITM }),
    ])
    const first = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(first.filled + first.barcodesRewritten).toBe(2)
    const gars = rows().map((i) => i.garmentScanCode)

    const second = await backfillGarScanCodes({ scope: { orderId: 'o1' } })
    expect(second.filled).toBe(0)
    expect(second.barcodesRewritten).toBe(0)
    expect(rows().map((i) => i.garmentScanCode)).toEqual(gars) // nothing renumbered
  })

  it('assigns distinct GARs across a chunk boundary', async () => {
    seed(Array.from({ length: 7 }, (_, i) => item({ id: `i${i}`, orderId: 'o1', barcode: ITM })))
    await backfillGarScanCodes({ scope: { orderId: 'o1' }, chunkSize: 2 })
    const gars = rows().map((i) => i.garmentScanCode)
    expect(gars.every(isGarScanCode)).toBe(true)
    expect(new Set(gars).size).toBe(7)
  })

  it('terminates even when every row is skipped (cursor, not re-query)', async () => {
    seed(Array.from({ length: 5 }, (_, i) => item({ id: `i${i}`, orderId: 'o1', garmentScanCode: 'BAD', barcode: ITM })))
    const r = await backfillGarScanCodes({ scope: { orderId: 'o1' }, chunkSize: 2 })
    expect(r.invalidGarSkipped).toBe(5)
    expect(r.scanned).toBe(5)
  })
})

// ── audit ──────────────────────────────────────────────────────────────────

describe('auditGarScanCodes', () => {
  it('reports the population before and proves the invariant after', async () => {
    seed([
      item({ id: 'i1', orderId: 'o1', barcode: ITM }),                              // NULL GAR + ITM
      item({ id: 'i2', orderId: 'o1', garmentScanCode: GAR_A, barcode: ITM }),      // GAR + ITM
      item({ id: 'i3', orderId: 'o1', garmentScanCode: 'GAR000000000087', barcode: 'GAR000000000087' }), // correct
    ])
    const before = await auditGarScanCodes({ orderId: 'o1' })
    expect(before).toMatchObject({
      total: 3, nullGar: 1, invalidGar: 0, existingGar: 2, itmBarcode: 2, alreadyCorrect: 1, needsWork: 2,
    })

    await backfillGarScanCodes({ scope: { orderId: 'o1' } })

    const after = await auditGarScanCodes({ orderId: 'o1' })
    expect(after.nullGar).toBe(0)          // no NULL GAR remains
    expect(after.itmBarcode).toBe(0)       // no ITM barcode remains
    expect(after.alreadyCorrect).toBe(3)
    expect(after.needsWork).toBe(0)
    expect(rows()[1].garmentScanCode).toBe(GAR_A)                 // unchanged
    expect(rows()[2].garmentScanCode).toBe('GAR000000000087')     // unchanged
  })

  it('is read-only', async () => {
    seed([item({ id: 'i1', orderId: 'o1', barcode: ITM })])
    await auditGarScanCodes({ orderId: 'o1' })
    expect(rows()[0].garmentScanCode).toBeNull()
    expect(prismaMock.laundryOrderItem.update).not.toHaveBeenCalled()
  })
})

// ── GENERATE_ALL ───────────────────────────────────────────────────────────

describe('GENERATE_ALL heals legacy garments', () => {
  it('gives a GAR to an item that was ALREADY printed with an ITM barcode', async () => {
    // This is the exact stranded row: barcodeGenerated = true, GAR = NULL.
    // The old code filtered on !barcodeGenerated and skipped it forever.
    seed([item({ id: 'i1', orderId: 'o1', itemNumber: ITM, barcode: ITM, barcodeGenerated: true })])
    const res = await post('o1', { action: 'GENERATE_ALL' })
    const j = await res.json()

    expect(j.success).toBe(true)
    expect(j.data.healed).toBe(1)
    expect(j.data.generated).toBe(0) // it was already labelled — not re-counted
    expect(isGarScanCode(rows()[0].garmentScanCode)).toBe(true)
    expect(rows()[0].barcode).toBe(rows()[0].garmentScanCode)
  })

  it('does NOT mint a second GAR for an item that already has one', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: GAR_A, barcode: GAR_A, barcodeGenerated: true })])
    const res = await post('o1', { action: 'GENERATE_ALL' })
    const j = await res.json()

    expect(j.data.healed).toBe(0)
    expect(rows()[0].garmentScanCode).toBe(GAR_A)
    expect(prismaMock.laundryGarSequenceCounter.upsert).not.toHaveBeenCalled() // no allocation at all
  })

  it('preserves an existing GAR while repointing its legacy barcode', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: GAR_A, barcode: ITM, barcodeGenerated: true })])
    await post('o1', { action: 'GENERATE_ALL' })
    expect(rows()[0].garmentScanCode).toBe(GAR_A)
    expect(rows()[0].barcode).toBe(GAR_A)
    expect(prismaMock.laundryGarSequenceCounter.upsert).not.toHaveBeenCalled()
  })

  it('leaves a mixed order fully on GAR, with no duplicates', async () => {
    seed([
      item({ id: 'i1', orderId: 'o1', barcode: ITM, barcodeGenerated: true }),   // legacy, printed
      item({ id: 'i2', orderId: 'o1', barcode: ITM, barcodeGenerated: true }),   // legacy, printed
      item({ id: 'i3', orderId: 'o1', garmentScanCode: GAR_A, barcode: GAR_A, barcodeGenerated: true }),
      item({ id: 'i4', orderId: 'o1', barcode: ITM, barcodeGenerated: false }),  // pending
    ])
    const res = await post('o1', { action: 'GENERATE_ALL' })
    const j = await res.json()

    expect(j.data.generated).toBe(1) // only the pending one is newly labelled
    expect(j.data.healed).toBe(3)
    const gars = rows().map((i) => i.garmentScanCode)
    expect(gars.every(isGarScanCode)).toBe(true)
    expect(new Set(gars).size).toBe(4)          // every GAR distinct
    expect(gars).toContain(GAR_A)               // the existing one survived
    expect(rows().every((i) => i.barcode === i.garmentScanCode)).toBe(true)
    expect(rows().every((i) => i.barcodeGenerated)).toBe(true)
  })

  it('still records a BARCODE_GENERATED event only for newly-labelled garments', async () => {
    seed([
      item({ id: 'i1', orderId: 'o1', barcode: ITM, barcodeGenerated: true }),
      item({ id: 'i2', orderId: 'o1', barcode: ITM, barcodeGenerated: false }),
    ])
    await post('o1', { action: 'GENERATE_ALL' })
    expect(events.filter((e) => e.action === 'BARCODE_GENERATED').map((e) => e.itemId)).toEqual(['i2'])
  })

  it('does not overwrite an unrecognised garmentScanCode', async () => {
    seed([item({ id: 'i1', orderId: 'o1', garmentScanCode: 'LEGACY-XYZ', barcode: ITM, barcodeGenerated: true })])
    const res = await post('o1', { action: 'GENERATE_ALL' })
    const j = await res.json()
    expect(j.data.healed).toBe(0)
    expect(rows()[0].garmentScanCode).toBe('LEGACY-XYZ')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// BARCODE GENERATION UX — bulk generate, and the scroll that used to jump.
//
// The screen refreshed by flipping `loading`, which swapped the whole table for
// a spinner. Unmounting the list and remounting it puts the browser back at the
// top, so on a 20-garment order every Generate threw the operator back to
// garment 1. The fix is a SILENT refresh — the same mounted table, new rows —
// so the scroll position is never lost in the first place.
//
// The bulk button calls the EXISTING approved handler. No allocator, no format
// and no numbering lives in the UI.
// ═══════════════════════════════════════════════════════════════════════════

describe('Barcode Generation screen', () => {
  const SCREEN = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-audit-barcode.tsx'), 'utf8')

  // 8, 9, 10 — scroll preservation
  it('8,9,10 · refreshes silently after Generate, Reprint and Generate All', () => {
    expect(SCREEN).toContain('const load = useCallback(async (silent = false) => {')
    expect(SCREEN).toContain('if (!silent) setLoading(true)')
    expect(SCREEN).toContain('if (!silent) setLoading(false)')
    // Every post-action refresh is the silent one. genOne serves both Generate
    // and Reprint, so all three paths are covered.
    const handlers = SCREEN.slice(SCREEN.indexOf('const genOne'), SCREEN.indexOf('const printAll'))
    expect(handlers).not.toMatch(/await load\(\)/)
    expect((handlers.match(/await load\(true\)/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the DOM rather than saving and restoring an offset', () => {
    // Code only — the comments above the fix naturally name what it avoids.
    const code = SCREEN.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n')
    for (const banned of ['scrollTo', 'scrollIntoView', 'scrollTop', 'setTimeout', 'location.reload']) {
      expect(code, banned).not.toContain(banned)
    }
  })

  it('the spinner still covers the FIRST load, so nothing renders half-built', () => {
    expect(SCREEN).toContain('if (loading || !data) return')
    expect(SCREEN).toContain('useEffect(() => { void load() }, [load])') // no silent flag ⇒ spinner
  })

  // 6 — reuses the approved handler
  it('6 · bulk generate calls the existing GENERATE_ALL handler', () => {
    expect(SCREEN).toContain('action: "GENERATE_ALL"')
    expect(SCREEN).toContain('`/api/laundry/orders/${orderId}/barcodes`')
    // The UI mints nothing and knows no format.
    expect(SCREEN).not.toContain('nextGarScanCode')
    expect(SCREEN).not.toContain('GAR${')
    expect(SCREEN).not.toMatch(/padStart\(12/)
  })

  it('preserves the { generated, healed } response contract', () => {
    expect(SCREEN).toContain('j.data?.generated ?? 0')
    expect(SCREEN).toContain('j.data?.healed ?? 0')
    expect(SCREEN).toContain('Generated: ${generated} · Healed: ${healed}')
    expect(SCREEN).toContain('All garments already have GAR codes.')
  })

  // 7 — double-click
  it('7 · a double-click cannot trigger a second run', () => {
    expect(SCREEN).toContain('const runningRef = useRef(false)')
    expect(SCREEN).toContain('if (runningRef.current) return')
    expect(SCREEN).toContain('runningRef.current = true')
    expect(SCREEN).toContain('runningRef.current = false')
    expect(SCREEN).toContain('disabled={busy}')
  })

  it('shows Generating… while it runs', () => {
    expect(SCREEN).toContain('busy ? "Generating…" : "Generate All Pending"')
  })

  // 7 (error handling)
  it('an error does not reload the page or lose position', () => {
    expect(SCREEN).toContain('variant: "destructive"')
    // Even the failure path refreshes silently, so partial success is visible.
    const genAll = SCREEN.slice(SCREEN.indexOf('const genAll'), SCREEN.indexOf('const printAll'))
    expect(genAll).toContain('Could not generate')
    expect((genAll.match(/await load\(true\)/g) || []).length).toBe(2) // success + catch
  })

  // 11, 12 — nothing else moved
  it('11,12 · single Generate/Reprint and printing are untouched', () => {
    expect(SCREEN).toContain('action: reprint ? "REPRINT" : "GENERATE"')
    expect(SCREEN).toContain('`/api/laundry/items/${it.id}/barcode`')
    expect(SCREEN).toContain('printLabels([toLabel(it)], cfg, true)')   // print
    expect(SCREEN).toContain('printLabels([toLabel(it)], cfg, false)')  // preview
    expect(SCREEN).toContain('printLabels(data.items.map(toLabel), cfg, true)') // print all
    // Label config and scanner quality are read, never redefined here.
    expect(SCREEN).toContain('scannerQuality(cfg)')
  })

  it('the displayed value is still the approved GAR-first chain', () => {
    expect(SCREEN).toContain('it.garmentScanCode || it.barcode || it.itemNumber || ""')
  })
})

// ── 12 · ACCEPTANCE — 8 garments, 3 already coded ──────────────────────────
describe('12 · acceptance — Generate All on a part-coded order', () => {
  it('codes 4-8, leaves 1-3 exactly as they were, and is idempotent', async () => {
    const kept = ['GAR000000000011', 'GAR000000000012', 'GAR000000000013']
    seed([
      ...kept.map((g, i) => item({ id: `i${i + 1}`, orderId: 'o1', garmentScanCode: g, barcode: g, barcodeGenerated: true })),
      ...Array.from({ length: 5 }, (_, i) => item({ id: `i${i + 4}`, orderId: 'o1', itemNumber: ITM, barcode: ITM })),
    ])

    const first = await (await post('o1', { action: 'GENERATE_ALL' })).json()
    expect(first.success).toBe(true)
    expect(first.data.healed).toBe(5)     // only the five without a GAR
    expect(first.data.generated).toBe(5)  // …which were also the five unlabelled

    const gars = rows().map((r) => r.garmentScanCode)
    expect(gars.every(isGarScanCode)).toBe(true)
    expect(new Set(gars).size).toBe(8)                       // 8 distinct
    expect(gars.slice(0, 3)).toEqual(kept)                   // 1-3 untouched
    expect(rows().every((r) => r.barcode === r.garmentScanCode)).toBe(true)
    expect(rows().every((r) => r.barcodeGenerated)).toBe(true)

    // Second click — nothing new, nothing changed.
    vi.clearAllMocks()
    const second = await (await post('o1', { action: 'GENERATE_ALL' })).json()
    expect(second.data.generated).toBe(0)
    expect(second.data.healed).toBe(0)
    expect(rows().map((r) => r.garmentScanCode)).toEqual(gars)
    // The allocator was never asked for a code.
    expect(prismaMock.laundryGarSequenceCounter.upsert).not.toHaveBeenCalled()
  })
})
