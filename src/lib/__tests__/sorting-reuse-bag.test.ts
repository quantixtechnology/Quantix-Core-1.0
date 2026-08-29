import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Sorting → reusable laundry bag (REUSE_BAG).
//
// THE BUG: assignFinishingBag() demanded an unassigned LaundryProcessingPackage
// row BEFORE it would even look at the scanned bag, and bailed with "No
// finishing container is available for this order" when there was none. That
// row is internal bookkeeping created lazily by syncPackageLifecycle(), which
// the workstation endpoint (/api/laundry/processing) never calls — so an order
// processed entirely through the workstations reached Sorting with zero package
// rows and could never have its bag assigned.
//
// THE RULE: in REUSE_BAG the scanned bag IS the finishing container. Resolve
// and validate the bag first; open the internal row afterwards.
//
// Modelled on the real case: ORD-STR-BUS-202608-0008-002-000002, 8 garments,
// bag V8BAG002.
// ============================================================================

const ORDER_ID = 'ord-vs-2'
const ORDER_NO = 'ORD-STR-BUS-202608-0008-002-000002'
const BIZ = 'lb_vastrasudha'
const BAG = 'V8BAG002'

const H = vi.hoisted(() => {
  const state = {
    packages: [] as { id: string; code: string; qrValue: string | null; serviceId: string | null; orderId: string; bagAssigned: boolean; bagCode: string | null }[],
    bag: null as null | { id: string; bagNumber: string; currentOrderId: string | null; status: string },
    linkedOrderStatus: 'PROCESSING' as string,
    items: [] as { id: string; processingStage: string }[],
    retired: 0,
    createdPackages: 0,
    assignBagCalls: [] as { code: string; orderId: string; purpose?: string }[],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = {
    laundryOrder: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: vi.fn(async (a: any) => {
        if (a.where.id === ORDER_ID) return { orderNumber: ORDER_NO, status: 'PROCESSING', _count: { items: state.items.length } }
        return { status: state.linkedOrderStatus } // the bag's currently-linked order
      }),
    },
    laundryOrderItem: {
      findMany: vi.fn(async () => state.items.map((i) => ({ ...i }))),
      updateMany: vi.fn(async () => { state.retired = state.items.length; return { count: state.items.length } }),
      count: vi.fn(async () => state.retired),
    },
    laundryProcessingPackage: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        const want = a.where.bagAssigned
        const hit = state.packages.find((x) => x.orderId === a.where.orderId && (want === undefined || x.bagAssigned === want))
        return hit ? { ...hit } : null
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: vi.fn(async (a: any) =>
        state.packages.filter((x) => x.orderId === a.where.orderId && (a.where.bagAssigned === undefined || x.bagAssigned === a.where.bagAssigned)).map((x) => ({ ...x }))),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async (a: any) => {
        state.createdPackages++
        const row = { id: `pkg-${state.createdPackages}`, code: a.data.code, qrValue: a.data.qrValue, serviceId: null, orderId: a.data.orderId, bagAssigned: false, bagCode: null }
        state.packages.push(row)
        return { ...row }
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (a: any) => {
        const row = state.packages.find((x) => x.id === a.where.id)
        if (row) Object.assign(row, a.data)
        return row ? { ...row } : null
      }),
    },
    laundryOrderEvent: { create: vi.fn(async () => ({})) },
    laundryBag: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        if (!state.bag) return null
        const codes = a.where.OR.flatMap((o: Record<string, string>) => Object.values(o))
        return codes.includes(state.bag.bagNumber) ? { ...state.bag } : null
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    laundryPickupBag: { findFirst: vi.fn(async () => null) },
  }
  return { state, prisma: p }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-codes', () => ({
  generateProcessingPackageCode: vi.fn(async () => 'PKG-202608-000123'),
}))
vi.mock('@/lib/laundry-bag-assign', () => ({
  // The real module's role constants — the finishing binder imports them to say
  // the bag it binds is a SORTING bag, so the mock has to carry them too.
  BAG_PURPOSE: { PICKUP: 'PICKUP', SORTING: 'SORTING', DELIVERY: 'DELIVERY' },
  assignBagToOrder: vi.fn(async (a: { code: string; orderId: string; purpose?: string }) => {
    H.state.assignBagCalls.push({ code: a.code, orderId: a.orderId, purpose: a.purpose })
    if (H.state.bag) { H.state.bag.currentOrderId = a.orderId; H.state.bag.status = 'PROCESSING' }
    return { ok: true }
  }),
}))

import { assignFinishingBag, finishingBagTarget, scanModeAcceptance } from '../laundry-finishing'

const { state } = H
const eightGarments = () => Array.from({ length: 8 }, (_, i) => ({ id: `it-${i + 1}`, processingStage: 'SORTING' }))
const availableBag = () => ({ id: 'bag-1', bagNumber: BAG, currentOrderId: null, status: 'AVAILABLE' })
const run = (over: Partial<{ code: string; mode: string }> = {}) =>
  assignFinishingBag({ orderId: ORDER_ID, businessId: BIZ, code: BAG, mode: 'REUSE_BAG', actorName: 'Op', ...over })

beforeEach(() => {
  state.packages = []
  state.bag = availableBag()
  state.linkedOrderStatus = 'PROCESSING'
  state.items = eightGarments()
  state.retired = 0
  state.createdPackages = 0
  state.assignBagCalls = []
  vi.clearAllMocks()
})

describe('REUSE_BAG — the reported production failure', () => {
  // 1 + 2 + 6: this is the exact case that used to fail.
  it('1,2,6 · assigns an AVAILABLE bag with NO ProcessingPackage row present', async () => {
    expect(state.packages).toHaveLength(0) // the order has never had one
    const r = await run()
    if (!r.ok) throw new Error(`expected success, got: ${r.error}`)
    expect(r.bagCode).toBe(BAG)
    // The internal row was opened automatically, AFTER the bag validated.
    expect(state.createdPackages).toBe(1)
    expect(state.packages[0].bagAssigned).toBe(true)
    expect(state.packages[0].bagCode).toBe(BAG)
  })

  it('2 · the container row is created only once the bag is valid', async () => {
    state.bag = null // scanned code resolves to nothing
    const r = await run()
    expect(r.ok).toBe(false)
    // A bad scan must not leave a package row behind.
    expect(state.createdPackages).toBe(0)
  })

  // 3
  it('3 · all 8 garments are bound and their barcodes retired', async () => {
    const r = await run()
    if (!r.ok) throw new Error('expected success')
    expect(r.retired).toBe(8)
    // …once, and filed as a SORTING bag — the role the panel needs to tell this
    // bag apart from the order's pickup and delivery bags.
    expect(state.assignBagCalls).toEqual([{ code: BAG, orderId: ORDER_ID, purpose: 'SORTING' }])
  })

  // 4
  it('4 · rejects when a garment has not reached Sorting', async () => {
    state.items[3].processingStage = 'DRY' // still pre-QC
    const r = await run()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.code).toBe('NOT_ELIGIBLE')
    expect(state.createdPackages).toBe(0)
  })

  // 5
  it('5 · rejects a bag held by another LIVE order', async () => {
    state.bag = { id: 'bag-1', bagNumber: BAG, currentOrderId: 'ord-other', status: 'PROCESSING' }
    state.linkedOrderStatus = 'PROCESSING'
    const r = await run()
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.code).toBe('WRONG_ORDER')
    expect(r.error).toContain(BAG)
  })

  it('5b · a pointer left by a DELIVERED order is stale, not occupancy', async () => {
    state.bag = { id: 'bag-1', bagNumber: BAG, currentOrderId: 'ord-old', status: 'PROCESSING' }
    state.linkedOrderStatus = 'DELIVERED'
    const r = await run()
    expect(r.ok).toBe(true)
  })

  // 7
  it('7 · re-scanning the SAME bag returns the standing assignment', async () => {
    const first = await run()
    if (!first.ok) throw new Error('expected success')
    vi.clearAllMocks()

    const second = await run()
    if (!second.ok) throw new Error('expected idempotent success')
    expect(second.alreadyAssigned).toBe(true)
    expect(second.bagCode).toBe(BAG)
    expect(state.createdPackages).toBe(1)      // no second container
    expect(H.prisma.laundryProcessingPackage.update).not.toHaveBeenCalled()
  })

  it('7b · a DIFFERENT bag after assignment is refused', async () => {
    await run()
    const r = await run({ code: 'V8BAG009' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.code).toBe('ALREADY_ASSIGNED')
  })
})

describe('other scan modes are unchanged', () => {
  // 8
  it('8 · GENERATE_NEW still binds an existing Processing Package', async () => {
    state.packages = [{ id: 'pkg-1', code: 'PKG-202608-000001', qrValue: 'PKG-202608-000001', serviceId: null, orderId: ORDER_ID, bagAssigned: false, bagCode: null }]
    const r = await run({ code: 'PKG-202608-000001', mode: 'GENERATE_NEW' })
    if (!r.ok) throw new Error('expected success')
    expect(r.code).toBe('PKG-202608-000001')
    expect(state.createdPackages).toBe(0) // used the existing row
  })

  it('8b · GENERATE_NEW refuses a bag scan with operator guidance', async () => {
    const r = await run({ mode: 'GENERATE_NEW' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Processing Packet')
  })

  // 9
  it('9 · BOTH accepts a bag', async () => {
    expect((await run({ mode: 'BOTH' })).ok).toBe(true)
  })

  it('9b · BOTH accepts a package', async () => {
    state.packages = [{ id: 'pkg-1', code: 'PKG-202608-000001', qrValue: 'PKG-202608-000001', serviceId: null, orderId: ORDER_ID, bagAssigned: false, bagCode: null }]
    expect((await run({ code: 'PKG-202608-000001', mode: 'BOTH' })).ok).toBe(true)
  })

  it('REUSE_BAG refuses a packet scan with operator guidance', async () => {
    const r = await run({ code: 'PKG-202608-000001' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('laundry bag')
  })
})

describe('downstream + UI contract', () => {
  // 10
  it('10 · Iron/Fold/Transit resolve the bag as the active container', async () => {
    await run()
    // The container row now carries the BAG as its scan value, so the finishing
    // stations resolve V8BAG002 rather than a PKG code.
    expect(state.packages[0].bagCode).toBe(BAG)
    expect(state.packages[0].qrValue).toBe(BAG)
    expect(scanModeAcceptance(BAG, 'REUSE_BAG')).toBeNull()
  })

  // 11
  it('11 · REUSE_BAG never asks the operator for a package QR', () => {
    const t = finishingBagTarget('REUSE_BAG')
    expect(t.label).toBe('Scan Laundry Bag')
    expect(t.isPackage).toBe(false)
    expect(t.isBag).toBe(true)
    // …while GENERATE_NEW keeps the packet wording.
    expect(finishingBagTarget('GENERATE_NEW').label).toBe('Scan Processing Packet')
  })
})
