import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// One GAR system, every tenant.
//
// VASTRASUDHA and Laundry & Drycleaners do not have two implementations to
// reconcile — there is exactly ONE allocator (nextGarScanCode) drawing from
// ONE row (LaundryGarSequenceCounter id:"singleton"), and it takes no business,
// store, month or tenant argument at all. It CANNOT produce a per-tenant
// format, because there is nothing tenant-shaped for it to read.
//
// These tests run both tenants through the SAME real code — allocation,
// GENERATE_ALL, and the real label builder — and assert the printed output is
// identical in format. The difference in production was never code: it was
// VASTRASUDHA rows carrying garmentScanCode = NULL.
// ============================================================================

interface ItemRow {
  id: string; orderId: string; itemNumber: string | null
  garmentScanCode: string | null; barcode: string | null
  barcodeGenerated: boolean; barcodePrintedAt: Date | null
  serviceName: string | null; garmentName: string | null
}

const H = vi.hoisted(() => {
  const state = {
    items: [] as ItemRow[],
    orders: [] as { id: string; businessId: string; paymentStatus: string }[],
    counter: null as { id: string; next: number } | null,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clone = (v: any) => JSON.parse(JSON.stringify(v))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sel = (args: any) => {
    let out = state.items.filter((r) => !args?.where?.orderId || r.orderId === args.where.orderId)
    if (args?.where?.garmentScanCode?.not === null) out = out.filter((r) => r.garmentScanCode !== null)
    if (args?.orderBy?.garmentScanCode === 'desc') {
      out = [...out].sort((a, b) => String(b.garmentScanCode ?? '').localeCompare(String(a.garmentScanCode ?? '')))
    }
    return out
  }
  const prismaMock = {
    laundryOrderItem: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (a: any) => sel(a).map(clone)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => { const r = sel(a)[0]; return r ? clone(r) : null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (a: any) => { const r = state.items.find((x) => x.id === a.where.id); return r ? clone(r) : null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (a: any) => {
        const r = state.items.find((x) => x.id === a.where.id)
        if (!r) throw new Error('missing')
        Object.assign(r, a.data); return clone(r)
      }),
    },
    laundryGarSequenceCounter: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert: vi.fn(async (a: any) => {
        if (!state.counter) state.counter = { ...a.create }
        else if (a.update?.next?.increment) state.counter.next += a.update.next.increment
        return clone(state.counter)
      }),
      findUnique: vi.fn(async () => (state.counter ? clone(state.counter) : null)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async (a: any) => { state.counter = { ...a.data }; return clone(state.counter) }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (a: any) => { state.counter = { ...(state.counter as { id: string; next: number }), ...a.data }; return clone(state.counter) }),
    },
    laundryOrder: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (a: any) => {
        const o = state.orders.find((x) => x.id === a.where.id)
        return o ? { ...o, items: state.items.filter((i) => i.orderId === o.id).map(clone) } : null
      }),
    },
    laundryItemEvent: { create: vi.fn(async () => ({})) },
    laundryBusiness: { findUnique: vi.fn(async () => ({ paymentPolicy: 'BEFORE_DELIVERY' })) },
  }
  return { state, prismaMock }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prismaMock }))
vi.mock('@/lib/laundry-rbac', () => ({
  requireLaundryPermission: vi.fn(async () => ({ ok: true })),
  requireLaundryMember: vi.fn(async () => ({ ok: true })),
}))

import { nextGarScanCode, isGarScanCode } from '@/lib/laundry-codes'
import { buildHTML, DEFAULT_LABEL_CONFIG, type LabelData } from '@/lib/laundry-label'
import { POST as BARCODES } from '@/app/api/laundry/orders/[id]/barcodes/route'

const { state, prismaMock } = H

// The two real tenants, with their real order-number series.
const VS = { biz: 'lb_vastrasudha', order: 'ORD-STR-BUS-202608-0008-002-000002' }
const LD = { biz: 'lb_laundrydry', order: 'ORD-STR-BUS-202606-0005-001-000041' }

const mkItem = (id: string, orderId: string, itemNumber: string, over: Partial<ItemRow> = {}): ItemRow => ({
  id, orderId, itemNumber, garmentScanCode: null, barcode: itemNumber,
  barcodeGenerated: false, barcodePrintedAt: null, serviceName: 'Wash & Iron', garmentName: 'Shirt', ...over,
})

const post = (orderId: string) =>
  BARCODES(
    new Request('http://t/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'GENERATE_ALL' }) }),
    { params: Promise.resolve({ id: orderId }) },
  )

// Exactly what laundry-audit-barcode.tsx builds for the printer.
const toLabel = (r: ItemRow, orderNumber: string): LabelData => ({
  itemNumber: r.itemNumber || r.barcode || '',
  garment: r.garmentName || '', service: r.serviceName || '',
  garScanCode: r.garmentScanCode, orderNumber,
})

beforeEach(() => {
  state.items.length = 0
  state.orders.length = 0
  state.orders.push(
    { id: VS.order, businessId: VS.biz, paymentStatus: 'PENDING' },
    { id: LD.order, businessId: LD.biz, paymentStatus: 'PAID' },
  )
  state.counter = null
  vi.clearAllMocks()
})

describe('the allocator is tenant-blind by construction', () => {
  it('takes no arguments — there is nothing tenant-shaped to branch on', () => {
    expect(nextGarScanCode.length).toBe(0)
  })

  it('draws every code from the single platform-wide counter row', async () => {
    const a = await nextGarScanCode()
    const b = await nextGarScanCode()
    expect(a).toBe('GAR000000000001')
    expect(b).toBe('GAR000000000002')
    // One row, for the whole platform.
    expect(prismaMock.laundryGarSequenceCounter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'singleton' } }),
    )
  })

  it('interleaves two tenants on one strictly increasing sequence', async () => {
    const seq = [await nextGarScanCode(), await nextGarScanCode(), await nextGarScanCode(), await nextGarScanCode()]
    expect(seq).toEqual(['GAR000000000001', 'GAR000000000002', 'GAR000000000003', 'GAR000000000004'])
    expect(new Set(seq).size).toBe(4)
  })

  it('produces GAR + exactly 12 digits — the Laundry & Drycleaners format', async () => {
    state.counter = { id: 'singleton', next: 86 }
    expect(await nextGarScanCode()).toBe('GAR000000000086')
  })
})

describe('one VASTRASUDHA order, end to end', () => {
  // The real order from the Barcode Generation screen: 8 garments, the first
  // three already printed with an ITM barcode, five still pending.
  const seedVastrasudha = () => {
    for (let i = 1; i <= 8; i++) {
      const itm = `ITM-${VS.order}-${String(i).padStart(4, '0')}`
      state.items.push(mkItem(`vs${i}`, VS.order, itm, { barcodeGenerated: i <= 3, garmentName: i <= 3 ? 'Shirt' : 'T-Shirt' }))
    }
  }

  it('leaves the whole order GAR-based, with the legacy ITM gone from the barcode', async () => {
    seedVastrasudha()
    const j = await (await post(VS.order)).json()

    expect(j.success).toBe(true)
    expect(j.data.healed).toBe(8)     // all eight, including the three printed ones
    expect(j.data.generated).toBe(5)  // only the five pending are newly labelled

    const rows = state.items
    expect(rows.every((r) => isGarScanCode(r.garmentScanCode))).toBe(true)
    expect(rows.every((r) => r.barcode === r.garmentScanCode)).toBe(true)
    expect(new Set(rows.map((r) => r.garmentScanCode)).size).toBe(8)
    // No ITM value survives as a BARCODE…
    expect(rows.some((r) => String(r.barcode).startsWith('ITM-'))).toBe(false)
    // …but itemNumber is untouched, so old labels still resolve.
    expect(rows[0].itemNumber).toBe(`ITM-${VS.order}-0001`)
  })

  it('prints the GAR, not the ITM value', async () => {
    seedVastrasudha()
    await post(VS.order)

    const html = buildHTML(state.items.map((r) => toLabel(r, VS.order)), DEFAULT_LABEL_CONFIG)
    for (const r of state.items) expect(html).toContain(r.garmentScanCode as string)
    expect(html).not.toContain('ITM-ORD-STR-BUS-202608-0008')
    // The human-readable line under the bars is the GAR.
    expect(html).toMatch(/<div class="gar">GAR\d{12}<\/div>/)
  })

  it('reprinting the same garment prints the SAME GAR', async () => {
    seedVastrasudha()
    await post(VS.order)
    const first = state.items[0].garmentScanCode

    await post(VS.order) // run it again — idempotent
    expect(state.items[0].garmentScanCode).toBe(first)

    const html = buildHTML([toLabel(state.items[0], VS.order)], DEFAULT_LABEL_CONFIG)
    expect(html).toContain(first as string)
  })

  it('an already-valid GAR is preserved untouched', async () => {
    state.items.push(mkItem('vs1', VS.order, `ITM-${VS.order}-0001`, {
      garmentScanCode: 'GAR000000000086', barcode: 'GAR000000000086', barcodeGenerated: true,
    }))
    await post(VS.order)
    expect(state.items[0].garmentScanCode).toBe('GAR000000000086')
    expect(prismaMock.laundryGarSequenceCounter.upsert).not.toHaveBeenCalled()
  })
})

describe('VASTRASUDHA and Laundry & Drycleaners print identically', () => {
  it('same format, same length, same label markup — only the number differs', async () => {
    state.items.push(mkItem('vs1', VS.order, `ITM-${VS.order}-0001`))
    state.items.push(mkItem('ld1', LD.order, `ITM-${LD.order}-0001`))

    await post(VS.order)
    await post(LD.order)

    const vs = state.items.find((r) => r.id === 'vs1')!
    const ld = state.items.find((r) => r.id === 'ld1')!

    // Identical shape, both 15 characters, both from the shared sequence.
    for (const code of [vs.garmentScanCode, ld.garmentScanCode]) {
      expect(code).toMatch(/^GAR\d{12}$/)
      expect(code).toHaveLength(15)
      // Nothing tenant-specific ever leaks into the code.
      expect(code).not.toContain('BUS')
      expect(code).not.toContain('STR')
      expect(code).not.toContain('2026')
    }
    expect(vs.garmentScanCode).not.toBe(ld.garmentScanCode)

    // The printed labels differ only by the code itself.
    const vsHtml = buildHTML([toLabel(vs, VS.order)], DEFAULT_LABEL_CONFIG)
    const ldHtml = buildHTML([toLabel(ld, LD.order)], DEFAULT_LABEL_CONFIG)
    const normalise = (h: string, code: string) => h.split(code).join('<CODE>')
    expect(normalise(vsHtml, vs.garmentScanCode as string).length)
      .toBe(normalise(ldHtml, ld.garmentScanCode as string).length)
    expect(vsHtml).toMatch(/<div class="gar">GAR\d{12}<\/div>/)
    expect(ldHtml).toMatch(/<div class="gar">GAR\d{12}<\/div>/)
  })
})
