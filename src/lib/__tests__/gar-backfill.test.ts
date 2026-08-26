import { describe, it, expect, vi, beforeEach } from 'vitest'

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
