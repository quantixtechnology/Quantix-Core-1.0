import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// A SUCCESSFUL SORTING COMPLETION IS ONE FACT, WRITTEN ONCE.
//
// Advancing the garments out of SORTING and recording the SORTING_COMPLETE
// event are the same fact. The event used to be written after the advance loop
// with `.catch(() => null)`, so a failure there left an order that had LEFT
// Sorting with nothing on the record saying it completed:
//
//   • invisible to History (which keys on that event), and
//   • unrecoverable — a retry finds nothing at SORTING left to advance, so the
//     event is never written on a second attempt either.
//
// They are now in one prisma.$transaction: both, or neither.
//
// The bag BINDING stays outside, deliberately — it goes through the shared
// single bag writer, which opens its own transaction. A binding that succeeds
// while this transaction rolls back leaves the order NOT completed and still at
// Sorting: a valid, retryable state, and the same one /finishing-bag produces.
// ============================================================================

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  itemFindMany: vi.fn(),
  itemUpdateMany: vi.fn(),
  itemEventCreate: vi.fn(),
  orderEventFindFirst: vi.fn(),
  orderEventCreate: vi.fn(),
  orderFindFirst: vi.fn(),
  packageFindFirst: vi.fn(),
  itemCount: vi.fn(),
  bizFindUnique: vi.fn(),
  assignFinishingBag: vi.fn(),
  syncPackageLifecycle: vi.fn(),
  scannedEvents: vi.fn(),
  requireLaundryPermission: vi.fn(),
}))

/** The tx client the route sees — the same spies, so writes are observable. */
const txClient = {
  laundryOrderItem: { findMany: mocks.itemFindMany, updateMany: mocks.itemUpdateMany },
  laundryItemEvent: { create: mocks.itemEventCreate },
  laundryOrderEvent: { findFirst: mocks.orderEventFindFirst, create: mocks.orderEventCreate },
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    laundryOrder: { findFirst: mocks.orderFindFirst, findMany: vi.fn(async () => []) },
    laundryOrderItem: { findMany: mocks.itemFindMany, count: mocks.itemCount, updateMany: mocks.itemUpdateMany, findFirst: vi.fn(async () => null) },
    laundryProcessingPackage: { findFirst: mocks.packageFindFirst, findMany: vi.fn(async () => []) },
    laundryBusiness: { findUnique: mocks.bizFindUnique },
    laundryOrderEvent: { findMany: vi.fn(async () => []), findFirst: mocks.orderEventFindFirst, create: mocks.orderEventCreate },
    laundryItemEvent: {
      create: mocks.itemEventCreate,
      findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), count: vi.fn(async () => 0),
    },
    laundryBagAssignment: { findMany: vi.fn(async () => []) },
    customer: { findMany: vi.fn(async () => []) },
  },
}))
vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1', businessCode: 'BUS-1' })),
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))
vi.mock('@/lib/laundry-finishing', () => ({
  assignFinishingBag: mocks.assignFinishingBag,
  syncPackageLifecycle: mocks.syncPackageLifecycle,
}))
vi.mock('@/lib/laundry-scan-events', () => ({ scannedEvents: mocks.scannedEvents, recordScan: vi.fn() }))

import { POST } from '@/app/api/laundry/processing/sorting/route'

const complete = () =>
  POST(new Request('http://t/api/laundry/processing/sorting', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId: 'pb1', action: 'assign_bag', code: 'VBBAG001', orderId: 'ord1', scanned: ['i1', 'i2'], actorName: 'raju' }),
  }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireLaundryPermission.mockResolvedValue({ ok: true })
  mocks.bizFindUnique.mockResolvedValue({ processingPackageQrMode: 'GENERATE_NEW' })
  mocks.orderFindFirst.mockResolvedValue({ id: 'ord1', orderNumber: 'ORD-1', status: 'IN_PROCESSING', _count: { items: 2 } })
  mocks.packageFindFirst.mockResolvedValue(null)                 // no standing completion
  mocks.itemFindMany.mockResolvedValue([
    { id: 'i1', processFlow: null, processingStage: 'SORTING' },
    { id: 'i2', processFlow: null, processingStage: 'SORTING' },
  ])
  mocks.scannedEvents.mockResolvedValue([{ itemId: 'i1', orderId: 'ord1' }, { itemId: 'i2', orderId: 'ord1' }])
  mocks.assignFinishingBag.mockResolvedValue({ ok: true, packageId: 'pkg1', code: 'PKG-1', bagCode: 'VBBAG001', retired: 2 })
  mocks.itemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.itemEventCreate.mockResolvedValue({})
  mocks.orderEventFindFirst.mockResolvedValue(null)
  mocks.orderEventCreate.mockResolvedValue({})
  mocks.syncPackageLifecycle.mockResolvedValue(null)
  // A faithful stand-in: run the callback, and let a throw propagate so the
  // caller sees exactly what a rolled-back transaction looks like.
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient))
})

const sortingCompleteCalls = () =>
  mocks.orderEventCreate.mock.calls.filter((c) => c[0]?.data?.action === 'SORTING_COMPLETE')

describe('A · a successful completion writes everything, together', () => {
  it('advances the garments and records SORTING_COMPLETE', async () => {
    const res = await complete()
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(j.success).toBe(true)
    expect(j.data.advanced).toBe(2)
    expect(mocks.itemUpdateMany).toHaveBeenCalledTimes(2)
    expect(sortingCompleteCalls()).toHaveLength(1)
  })

  it('both writes happen inside ONE transaction, on the tx client', async () => {
    await complete()
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    // Nothing was written before the transaction opened.
    const order = mocks.transaction.mock.invocationCallOrder[0]
    for (const spy of [mocks.itemUpdateMany, mocks.orderEventCreate]) {
      for (const call of spy.mock.invocationCallOrder) expect(call).toBeGreaterThan(order)
    }
  })

  it('the completion note records the bag and the garments moved', async () => {
    await complete()
    expect(sortingCompleteCalls()[0][0].data.note).toContain('VBBAG001')
    expect(sortingCompleteCalls()[0][0].data.orderId).toBe('ord1')
  })
})

describe('B · the bag binding fails → nothing at all happens', () => {
  it('no advance, no event, no transaction', async () => {
    mocks.assignFinishingBag.mockResolvedValue({ ok: false, error: 'Bag belongs to another order.', code: 'WRONG_ORDER' })
    const res = await complete()
    expect(res.status).toBe(409)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled()
    expect(sortingCompleteCalls()).toHaveLength(0)
  })
})

describe('C · the garment advance fails → the completion rolls back', () => {
  it('the request fails and SORTING_COMPLETE is never reached', async () => {
    mocks.itemUpdateMany.mockRejectedValue(new Error('db write failed'))
    const res = await complete()
    expect(res.status).toBe(500)
    expect(sortingCompleteCalls()).toHaveLength(0)
  })

  it('a failed per-garment audit event also aborts it — nothing is swallowed', async () => {
    mocks.itemEventCreate.mockRejectedValue(new Error('event write failed'))
    const res = await complete()
    expect(res.status).toBe(500)
    expect(sortingCompleteCalls()).toHaveLength(0)
  })
})

describe('D · the SORTING_COMPLETE write fails → the completion is NOT successful', () => {
  it('the advance is rolled back with it and the caller is told', async () => {
    mocks.orderEventCreate.mockRejectedValue(new Error('event write failed'))
    const res = await complete()
    // The old code answered 200 here, having advanced the garments and
    // swallowed the failure — an order out of Sorting with no completion.
    expect(res.status).toBe(500)
    const j = await res.json()
    expect(j.success).toBeUndefined()
  })

  it('the throw propagates out of the transaction rather than being caught inside', async () => {
    mocks.orderEventCreate.mockRejectedValue(new Error('boom'))
    await complete()
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    await expect(mocks.transaction.mock.results[0].value).rejects.toThrow('boom')
  })
})

describe('E · a retry cannot produce a second completion', () => {
  it('a standing SORTING_COMPLETE stops another being written', async () => {
    mocks.orderEventFindFirst.mockResolvedValue({ id: 'evt-1' })
    const res = await complete()
    expect(res.status).toBe(200)
    expect(sortingCompleteCalls()).toHaveLength(0)
  })

  it('the guard is read on the tx client, so it cannot race', async () => {
    await complete()
    expect(mocks.orderEventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ orderId: 'ord1', action: 'SORTING_COMPLETE' }),
    }))
  })

  it('an already-completed order short-circuits before the transaction', async () => {
    mocks.packageFindFirst.mockResolvedValue({ id: 'pkg1', code: 'VBBAG001', bagCode: 'VBBAG001' })
    mocks.itemCount.mockResolvedValue(2)
    const res = await complete()
    expect(res.status).toBe(200)
    expect((await res.json()).data.alreadyAssigned).toBe(true)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe('F · an extra bag is not a completion', () => {
  it('attaching a second bag writes no SORTING_COMPLETE', async () => {
    mocks.assignFinishingBag.mockResolvedValue({ ok: true, packageId: 'pkg1', code: 'PKG-1', bagCode: 'VBBAG001', retired: 2, addedBag: 'VBBAG002', totalBags: 2 })
    const res = await complete()
    const j = await res.json()
    expect(res.status).toBe(200)
    expect(j.data.addedBag).toBe('VBBAG002')
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(sortingCompleteCalls()).toHaveLength(0)
  })
})

describe('the existing completion gates are untouched', () => {
  it('a garment not yet at Sorting still blocks completion', async () => {
    mocks.itemFindMany.mockResolvedValue([{ id: 'i1', processFlow: null, processingStage: 'SORTING' }])
    const res = await complete()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('every garment in the order has reached Sorting')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('an unscanned garment still blocks completion', async () => {
    mocks.scannedEvents.mockResolvedValue([])
    const res = await POST(new Request('http://t/api/laundry/processing/sorting', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: 'pb1', action: 'assign_bag', code: 'VBBAG001', orderId: 'ord1', scanned: ['i1'], actorName: 'raju' }),
    }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('have not been scanned at Sorting yet')
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})
