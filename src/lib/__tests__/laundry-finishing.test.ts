import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Container-based finishing workflow — scan modes + package lifecycle.
// ============================================================================

const mocks = vi.hoisted(() => ({
  orderFindUnique: vi.fn().mockResolvedValue({ status: 'PROCESSING' }),
  pkgFindFirst: vi.fn().mockResolvedValue(null),
  pkgFindMany: vi.fn().mockResolvedValue([]),
  pkgCreate: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
  pkgUpdate: vi.fn().mockResolvedValue({ id: 'pkg-1' }),
  itemFindMany: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findUnique: mocks.orderFindUnique },
    laundryProcessingPackage: { findFirst: mocks.pkgFindFirst, findMany: mocks.pkgFindMany, create: mocks.pkgCreate, update: mocks.pkgUpdate },
    laundryOrderItem: { findMany: mocks.itemFindMany },
  },
}))
vi.mock('@/lib/laundry-codes', () => ({
  generateProcessingPackageCode: vi.fn().mockResolvedValue('PKG-202608-000001'),
}))

import { finishingScanTarget, scanModeAcceptance, syncPackageLifecycle, isProcessingPackageCode, isBagCode } from '../laundry-finishing'

describe('finishingScanTarget (workspace scan mode → station label)', () => {
  it('Processing Package mode (GENERATE_NEW) targets the package QR only', () => {
    const t = finishingScanTarget('GENERATE_NEW')
    expect(t.label).toBe('Scan Processing Packet')
    expect(t.isPackage).toBe(true)
    expect(t.isBag).toBe(false)
    expect(t.hint).toBe('PKG-…')
  })

  it('Bag mode (REUSE_BAG) targets the bag QR only', () => {
    const t = finishingScanTarget('REUSE_BAG')
    expect(t.label).toBe('Scan Laundry Bag')
    expect(t.isPackage).toBe(false)
    expect(t.isBag).toBe(true)
    expect(t.hint).toBe('BAG-… / PB-…')
  })

  it('Both mode accepts either scan target', () => {
    const t = finishingScanTarget('BOTH')
    expect(t.label).toBe('Scan Laundry Bag / Processing Packet')
    expect(t.isPackage).toBe(true)
    expect(t.isBag).toBe(true)
    expect(t.hint).toBe('PKG-… / BAG-… / PB-…')
  })

  it('defaults unknown modes to Processing Packet', () => {
    expect(finishingScanTarget(null).isPackage).toBe(true)
    expect(finishingScanTarget('WEIRD').label).toBe('Scan Processing Packet')
  })
})

describe('code kind detection', () => {
  it('recognises PKG- as a Processing Package QR', () => {
    expect(isProcessingPackageCode('PKG-202608-000001')).toBe(true)
    expect(isProcessingPackageCode('pkG-202608-000001')).toBe(true)
  })

  it('recognises BAG- and PB- as bag QRs', () => {
    expect(isBagCode('BAG-000123')).toBe(true)
    expect(isBagCode('PB-202608-000001')).toBe(true)
    expect(isBagCode('bag-000123')).toBe(true)
  })
})

describe('scanModeAcceptance (per-workspace gate)', () => {
  it('Mode B (GENERATE_NEW): accepts the Processing Package QR only', () => {
    expect(scanModeAcceptance('PKG-202608-000001', 'GENERATE_NEW')).toBeNull()
    expect(scanModeAcceptance('BAG-000123', 'GENERATE_NEW')).toMatch(/Processing Packet/)
    expect(scanModeAcceptance('PB-202608-000001', 'GENERATE_NEW')).toMatch(/Processing Packet/)
  })

  it('Mode A (REUSE_BAG): accepts the bag QR only', () => {
    expect(scanModeAcceptance('BAG-000123', 'REUSE_BAG')).toBeNull()
    expect(scanModeAcceptance('PB-202608-000001', 'REUSE_BAG')).toBeNull()
    expect(scanModeAcceptance('PKG-202608-000001', 'REUSE_BAG')).toMatch(/the bag/)
  })

  it('Mode C (BOTH): accepts either scan target', () => {
    expect(scanModeAcceptance('PKG-202608-000001', 'BOTH')).toBeNull()
    expect(scanModeAcceptance('BAG-000123', 'BOTH')).toBeNull()
    expect(scanModeAcceptance('PB-202608-000001', 'BOTH')).toBeNull()
  })

  it('treats unknown codes as neutral (resolved downstream)', () => {
    expect(scanModeAcceptance('ORD-STR-2026', 'GENERATE_NEW')).toBeNull()
  })
})

describe('syncPackageLifecycle (forward-only container lifecycle)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const pkg = (status: string) => [{ id: 'pkg-1', status }]

  async function run(orderStatus: string, stages: { stage: string | null; status: string }[], pkgStatuses = ['CREATED']) {
    mocks.orderFindUnique.mockResolvedValue({ status: orderStatus })
    mocks.pkgFindFirst.mockResolvedValue({ id: 'pkg-1' }) // a package already exists → no auto-create
    mocks.pkgFindMany.mockResolvedValue(pkg(pkgStatuses[0]))
    mocks.itemFindMany.mockResolvedValue(stages.map((s, i) => ({ id: `it-${i}`, processingStage: s.stage, processingStatus: s.status })))
  }

  it('CREATED → PROCESSING once a garment starts being worked', async () => {
    await run('PROCESSING', [{ stage: 'WASH', status: 'IN_PROGRESS' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PROCESSING' } }))
  })

  it('→ READY_FOR_FINISHING once EVERY garment has passed QC', async () => {
    await run('PROCESSING', [
      { stage: 'IRON', status: 'WAITING' },
      { stage: 'FOLD', status: 'WAITING' },
    ])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'READY_FOR_FINISHING' } }))
  })

  it('→ READY once finishing is complete (none left at Iron/Fold)', async () => {
    await run('PROCESSING', [{ stage: 'PACKED', status: 'WAITING' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'READY' } }))
  })

  it('→ PACKED once every garment is packed & done', async () => {
    await run('PROCESSING', [{ stage: 'PACKED', status: 'DONE' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PACKED' } }))
  })

  it('→ RELEASED when the order returns to the store / is ready for delivery', async () => {
    await run('RETURN_IN_TRANSIT', [{ stage: 'PACKED', status: 'DONE' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'RELEASED' } }))
    vi.clearAllMocks()
    await run('READY_FOR_DELIVERY', [{ stage: 'PACKED', status: 'DONE' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'RELEASED' } }))
  })

  it('→ CLOSED on delivery or cancellation', async () => {
    await run('DELIVERED', [{ stage: 'PACKED', status: 'DONE' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CLOSED' } }))
    vi.clearAllMocks()
    await run('CANCELLED', [{ stage: 'PACKED', status: 'DONE' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CLOSED' } }))
  })

  it('never regresses a package (reworked garment does not downgrade READY_FOR_FINISHING)', async () => {
    mocks.orderFindUnique.mockResolvedValue({ status: 'PROCESSING' })
    mocks.pkgFindFirst.mockResolvedValue({ id: 'pkg-1' })
    mocks.pkgFindMany.mockResolvedValue(pkg('READY_FOR_FINISHING'))
    mocks.itemFindMany.mockResolvedValue([{ id: 'it-1', processingStage: 'WASH', processingStatus: 'WAITING' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgUpdate).not.toHaveBeenCalled()
  })

  it('does not touch an already-current status', async () => {
    await run('DELIVERED', [{ stage: 'PACKED', status: 'DONE' }], ['CLOSED'])
    expect(mocks.pkgUpdate).not.toHaveBeenCalled()
  })

  it('auto-creates a container when none exists (no orphan / no migration needed)', async () => {
    mocks.orderFindUnique.mockResolvedValue({ status: 'PROCESSING', orderNumber: 'ORD-1', _count: { items: 2 } })
    mocks.pkgFindFirst.mockResolvedValue(null) // no package yet → ensure creates one
    mocks.pkgFindMany.mockResolvedValue(pkg('CREATED'))
    mocks.itemFindMany.mockResolvedValue([{ id: 'it-1', processingStage: 'WASH', processingStatus: 'IN_PROGRESS' }])
    await syncPackageLifecycle('ord-1', 'biz-1')
    expect(mocks.pkgCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'CREATED' }) }))
    expect(mocks.pkgUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PROCESSING' } }))
  })
})
