import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Order-Based Finishing Bag — one finishing bag per order, assigned once when
// the last garment passes QC; retires garment barcodes; blocks bag sharing.
// ============================================================================

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn().mockResolvedValue({ orderNumber: 'ORD-0001', status: 'PROCESSING' }),
  itemFindMany: vi.fn().mockResolvedValue([{ id: 'it-1', processingStage: 'IRON', processingStatus: 'WAITING' }]),
  pkgFindFirst: vi.fn().mockResolvedValue(null),
  pkgFindMany: vi.fn().mockResolvedValue([{ id: 'pkg-1', code: 'PKG-202608-000001', qrValue: 'PKG-202608-000001', serviceId: null, status: 'READY_FOR_FINISHING' }]),
  pkgUpdate: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
  itemUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
  orderEventCreate: vi.fn().mockResolvedValue({ id: 'evt-1' }),
  bagFindFirst: vi.fn().mockResolvedValue(null),
  pickupBagFindFirst: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findUnique: mocks.orderFindUnique },
    laundryOrderItem: { findMany: mocks.itemFindMany, updateMany: mocks.itemUpdateMany },
    laundryProcessingPackage: { findFirst: mocks.pkgFindFirst, findMany: mocks.pkgFindMany, update: mocks.pkgUpdate },
    laundryOrderEvent: { create: mocks.orderEventCreate },
    laundryBag: { findFirst: mocks.bagFindFirst },
    laundryPickupBag: { findFirst: mocks.pickupBagFindFirst },
  },
}))

import { assignFinishingBag, awaitingFinishingBagAssignment, finishingBagTarget, finishingBagAssigned } from '../laundry-finishing'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.orderFindUnique.mockResolvedValue({ orderNumber: 'ORD-0001', status: 'PROCESSING' })
  mocks.itemFindMany.mockResolvedValue([{ id: 'it-1', processingStage: 'IRON', processingStatus: 'WAITING' }])
  mocks.pkgFindMany.mockResolvedValue([{ id: 'pkg-1', code: 'PKG-202607-000001', qrValue: 'PKG-202607-000001', serviceId: null, status: 'READY_FOR_FINISHING' }])
  mocks.pkgFindFirst.mockResolvedValue(null)
  mocks.bagFindFirst.mockResolvedValue(null)
  mocks.pickupBagFindFirst.mockResolvedValue(null)
})

describe('finishingBagTarget', () => {
  it('labels per the workspace scan mode (never hardcoded)', () => {
    expect(finishingBagTarget('GENERATE_NEW').label).toBe('Scan Processing Package QR')
    expect(finishingBagTarget('REUSE_BAG').label).toBe('Scan Bag QR')
    expect(finishingBagTarget('BOTH').label).toBe('Scan Bag or Processing Package QR')
  })
})

describe('awaitingFinishingBagAssignment (eligible/not-unassigned)', () => {
  it('returns the package once EVERY garment has passed QC and none is assigned', async () => {
    mocks.pkgFindMany.mockResolvedValue([{ id: 'pkg-1', code: 'PKG-202607-000001', status: 'READY_FOR_FINISHING' }])
    const r = await awaitingFinishingBagAssignment('ord-1', 'biz-1')
    expect(r?.orderId).toBe('ord-1')
    expect(r?.code).toBe('PKG-202607-000001')
  })

  it('returns null while a garment is still at a pre-QC stage', async () => {
    mocks.itemFindMany.mockResolvedValue([{ id: 'it-1', processingStage: 'DRY', processingStatus: 'WAITING' }])
    const r = await awaitingFinishingBagAssignment('ord-1', 'biz-1')
    expect(r).toBeNull()
  })

  it('returns null once the bag is already assigned', async () => {
    mocks.pkgFindMany.mockResolvedValue([])
    const r = await awaitingFinishingBagAssignment('ord-1', 'biz-1')
    expect(r).toBeNull()
  })
})

describe('assignFinishingBag', () => {
  const opts = { orderId: 'ord-1', businessId: 'biz-1', code: 'PKG-202607-000001', mode: 'GENERATE_NEW' }

  it('binds the order container and retires all garment barcodes once', async () => {
    const r = await assignFinishingBag(opts)
    if (!r.ok) throw new Error('expected ok')
    expect(r.retired).toBe(1)
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pkg-1' }, data: expect.objectContaining({ bagAssigned: true, bagCode: 'PKG-202607-000001' }),
    }))
    expect(mocks.itemUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orderId: 'ord-1' }, data: { barcodeRetired: true } }))
    expect(mocks.orderEventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FINISHING_BAG_ASSIGNED' }) }))
  })

  it('rejects a second assignment for the same order', async () => {
    mocks.pkgFindFirst.mockResolvedValue({ id: 'pkg-1', code: 'PKG-202607-000001' })
    const r = await assignFinishingBag(opts)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('ALREADY_ASSIGNED')
  })

  it('rejects when not every garment has passed QC', async () => {
    mocks.itemFindMany.mockResolvedValue([{ id: 'it-1', processingStage: 'DRY', processingStatus: 'WAITING' }])
    const r = await assignFinishingBag(opts)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('NOT_ELIGIBLE')
  })

  it('rejects a bag QR in a Processing-Package workspace (scan-mode gate)', async () => {
    const r = await assignFinishingBag({ ...opts, code: 'BAG-000123' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('INVALID')
  })

  it('REUSE_BAG: binds a bag linked to THIS order, rejects a bag on another order', async () => {
    mocks.bagFindFirst.mockResolvedValue({ id: 'bag-1', bagNumber: 'BAG-000123', currentOrderId: 'ord-1' })
    const ok = await assignFinishingBag({ ...opts, code: 'BAG-000123', mode: 'REUSE_BAG' })
    expect(ok.ok).toBe(true)

    vi.clearAllMocks()
    mocks.bagFindFirst.mockResolvedValue({ id: 'bag-2', bagNumber: 'BAG-000456', currentOrderId: 'ord-X' })
    const bad = await assignFinishingBag({ ...opts, code: 'BAG-000456', mode: 'REUSE_BAG' })
    expect(bad.ok).toBe(false)
    expect(bad.code).toBe('WRONG_ORDER')
  })

  it('BOTH mode accepts either kind for the same order', async () => {
    mocks.bagFindFirst.mockResolvedValue({ id: 'bag-1', bagNumber: 'BAG-000123', currentOrderId: 'ord-1' })
    const r = await assignFinishingBag({ ...opts, code: 'BAG-000123', mode: 'BOTH' })
    expect(r.ok).toBe(true)
  })
})

describe('finishingBagAssigned (server-side barcode-retirement signal)', () => {
  it('is true once a finishing bag exists for the order', async () => {
    mocks.pkgFindFirst.mockResolvedValue({ id: 'pkg-1', bagAssigned: true })
    expect(await finishingBagAssigned('ord-1')).toBe(true)
  })

  it('is false before the bag is assigned', async () => {
    mocks.pkgFindFirst.mockResolvedValue(null)
    expect(await finishingBagAssigned('ord-1')).toBe(false)
  })
})