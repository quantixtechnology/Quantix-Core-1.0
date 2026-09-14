import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// THE REAL BACKEND TRANSITION.
//
// Move by Order does not have a transition of its own — it drives the same
// POST /api/laundry/items/[id]/process the scan gun drives. So the thing worth
// testing is that endpoint's actual behaviour under the calls Move by Order
// makes, with the REAL stage logic (resolveFlow / nextStageOf / the guards)
// running and only the data layer mocked.
//
// This is what makes "the server is authoritative" a fact rather than a claim:
// the expectedStage guard and the optimistic lock are exercised here, not
// simulated by a stubbed fetch in a component test.
// ============================================================================

const mocks = vi.hoisted(() => ({
  itemFindUnique: vi.fn(),
  itemCount: vi.fn().mockResolvedValue(1),
  updateManyAndReturn: vi.fn(),
  itemEventCreate: vi.fn().mockResolvedValue({ id: 'ev1' }),
  orderEventFindFirst: vi.fn().mockResolvedValue(null),
  orderEventCreate: vi.fn().mockResolvedValue({ id: 'oe1' }),
  transaction: vi.fn(),
  requireLaundryPermission: vi.fn().mockResolvedValue({ ok: true }),
  finishingBagAssigned: vi.fn().mockResolvedValue(false),
  syncPackageLifecycle: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrderItem: {
      findUnique: mocks.itemFindUnique,
      count: mocks.itemCount,
      updateManyAndReturn: mocks.updateManyAndReturn,
    },
    laundryItemEvent: { create: mocks.itemEventCreate },
    laundryOrderEvent: { findFirst: mocks.orderEventFindFirst, create: mocks.orderEventCreate },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/laundry-rbac', () => ({ requireLaundryPermission: mocks.requireLaundryPermission }))
vi.mock('@/lib/laundry-finishing', () => ({
  finishingBagAssigned: mocks.finishingBagAssigned,
  syncPackageLifecycle: mocks.syncPackageLifecycle,
}))

import { POST } from '@/app/api/laundry/items/[id]/process/route'

const WASH_FLOW = JSON.stringify(['WASH', 'DRY', 'IRON', 'QC', 'PACKED'])
const DC_FLOW = JSON.stringify(['DRYCLEAN', 'IRON', 'QC', 'PACKED'])

const garment = (over: Record<string, unknown> = {}) => ({
  id: 'i1', orderId: 'o1', serviceName: 'Wash & Fold',
  processingStage: 'WASH', processingStatus: 'WAITING', processFlow: WASH_FLOW,
  qcFailCount: 0, order: { businessId: 'b1', status: 'PROCESSING' },
  ...over,
})

const call = (body: Record<string, unknown>, id = 'i1') =>
  POST(new Request('http://t/api/laundry/items/i1/process', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireLaundryPermission.mockResolvedValue({ ok: true })
  mocks.finishingBagAssigned.mockResolvedValue(false)
  mocks.itemCount.mockResolvedValue(1)
  mocks.itemEventCreate.mockResolvedValue({ id: 'ev1' })
  // The route runs [update, event] in one transaction; return both results.
  mocks.transaction.mockImplementation(async () => [[{ id: 'i1' }], { id: 'ev1' }])
})

describe('the two calls Move by Order makes, against the real endpoint', () => {
  it('START moves a waiting garment to IN_PROGRESS at the same stage', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'WAITING' }))
    const res = await call({ action: 'START', expectedStage: 'WASH', note: 'Moved by order ORD-1' })
    expect(res.status).toBe(200)
    const args = mocks.updateManyAndReturn.mock.calls[0][0]
    expect(args.where).toEqual({ id: 'i1', processingStatus: 'WAITING' })
    expect(args.data.processingStatus).toBe('IN_PROGRESS')
    expect(args.data.processingStage).toBe('WASH')
  })

  it('COMPLETE advances to the NEXT stage of the garment’s own snapshotted flow', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'IN_PROGRESS' }))
    const res = await call({ action: 'COMPLETE', expectedStage: 'WASH' })
    expect(res.status).toBe(200)
    const args = mocks.updateManyAndReturn.mock.calls[0][0]
    // WASH -> DRY comes from the REAL nextStageOf over the real flow.
    expect(args.data.processingStage).toBe('DRY')
    expect(args.data.processingStatus).toBe('WAITING')
  })

  it('a Dry Cleaning garment advances along ITS route, not the Washing one', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'DRYCLEAN', processingStatus: 'IN_PROGRESS', processFlow: DC_FLOW, serviceName: 'Dry Clean',
    }))
    const res = await call({ action: 'COMPLETE', expectedStage: 'DRYCLEAN' })
    expect(res.status).toBe(200)
    expect(mocks.updateManyAndReturn.mock.calls[0][0].data.processingStage).toBe('IRON')
  })

  it('COMPLETE is refused unless the garment was started — hence START first', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'WAITING' }))
    const res = await call({ action: 'COMPLETE', expectedStage: 'WASH' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/start it before completing/i)
    expect(mocks.updateManyAndReturn).not.toHaveBeenCalled()
  })
})

describe('the server refuses what the client must not decide', () => {
  it('expectedStage mismatch is rejected — a Washing push cannot move a DRYCLEAN garment', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStage: 'DRYCLEAN', processFlow: DC_FLOW }))
    const res = await call({ action: 'START', expectedStage: 'WASH' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/not ready for/i)
    expect(mocks.updateManyAndReturn).not.toHaveBeenCalled()
  })

  it('and the reverse — a Dry Cleaning push cannot move a WASH garment', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStage: 'WASH' }))
    const res = await call({ action: 'START', expectedStage: 'DRYCLEAN' })
    expect(res.status).toBe(409)
    expect(mocks.updateManyAndReturn).not.toHaveBeenCalled()
  })

  it('a garment that no longer exists is a 404, not a silent skip', async () => {
    mocks.itemFindUnique.mockResolvedValue(null)
    const res = await call({ action: 'START', expectedStage: 'WASH' })
    expect(res.status).toBe(404)
  })

  it('16 · a garment raced by another operator loses the optimistic lock (409)', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'IN_PROGRESS' }))
    // updateMany matched zero rows: someone moved it between read and write.
    mocks.transaction.mockImplementation(async () => [[], { id: 'ev1' }])
    const res = await call({ action: 'COMPLETE', expectedStage: 'WASH' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already moved by another operator/i)
  })

  it('permission is still required — Move by Order is not a way around RBAC', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment())
    mocks.requireLaundryPermission.mockResolvedValue({
      ok: false, res: new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
    })
    const res = await call({ action: 'START', expectedStage: 'WASH' })
    expect(res.status).toBe(403)
    expect(mocks.updateManyAndReturn).not.toHaveBeenCalled()
  })

  it('a retired garment barcode (finishing bag assigned) is still blocked', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'IN_PROGRESS' }))
    mocks.finishingBagAssigned.mockResolvedValue(true)
    const res = await call({ action: 'COMPLETE', expectedStage: 'WASH' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/finishing bag is assigned/i)
  })
})

describe('the audit trail records the truth', () => {
  it('writes the real transition action, never a fabricated SCAN', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({ processingStatus: 'IN_PROGRESS' }))
    await call({ action: 'COMPLETE', expectedStage: 'WASH', actorName: 'Asha', note: 'Moved by order ORD-1 — operator confirmed all garments present (Asha)' })
    const ev = mocks.itemEventCreate.mock.calls[0][0].data
    expect(ev.action).toBe('COMPLETE')
    expect(ev.action).not.toBe('SCAN')
    expect(ev.fromStage).toBe('WASH')
    expect(ev.toStage).toBe('DRY')
    expect(ev.actorName).toBe('Asha')
    expect(ev.note).toMatch(/operator confirmed all garments present/)
    expect(ev.note).not.toMatch(/scanned/i)
  })
})

// ── Dry & Quality Check: the two-stage fast track ──────────────────────────
const DRY_FLOW = JSON.stringify(['DRY', 'QC', 'SORTING', 'PACKED'])

describe('DQC — DRY garment advances to QC via COMPLETE', () => {
  it('COMPLETE at DRY stage moves the garment to QC', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'DRY', processingStatus: 'IN_PROGRESS', processFlow: DRY_FLOW, serviceName: 'Wash & Fold',
    }))
    const res = await call({ action: 'COMPLETE', expectedStage: 'DRY' })
    expect(res.status).toBe(200)
    const args = mocks.updateManyAndReturn.mock.calls[0][0]
    expect(args.data.processingStage).toBe('QC')
    expect(args.data.processingStatus).toBe('WAITING')
  })

  it('START at DRY moves from WAITING to IN_PROGRESS', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'DRY', processingStatus: 'WAITING', processFlow: DRY_FLOW,
    }))
    const res = await call({ action: 'START', expectedStage: 'DRY' })
    expect(res.status).toBe(200)
    const args = mocks.updateManyAndReturn.mock.calls[0][0]
    expect(args.data.processingStage).toBe('DRY')
    expect(args.data.processingStatus).toBe('IN_PROGRESS')
  })
})

describe('DQC — QC garment advances to SORTING via QC_PASS', () => {
  it('QC_PASS at QC stage moves the garment to SORTING', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'QC', processingStatus: 'IN_PROGRESS', processFlow: DRY_FLOW, serviceName: 'Wash & Fold',
    }))
    const res = await call({ action: 'QC_PASS', expectedStage: 'QC' })
    expect(res.status).toBe(200)
    const args = mocks.updateManyAndReturn.mock.calls[0][0]
    expect(args.data.processingStage).toBe('SORTING')
    expect(args.data.processingStatus).toBe('WAITING')
  })

  it('QC_PASS is refused at DRY stage (only valid at QC)', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'DRY', processingStatus: 'IN_PROGRESS', processFlow: DRY_FLOW,
    }))
    const res = await call({ action: 'QC_PASS', expectedStage: 'DRY' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/only valid at Quality Check/i)
  })
})

describe('DQC — expectedStage guard for mixed-stage order', () => {
  it('a DRY garment rejects expectedStage QC', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'DRY', processFlow: DRY_FLOW,
    }))
    const res = await call({ action: 'START', expectedStage: 'QC' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/not ready for/i)
  })

  it('a QC garment rejects expectedStage DRY', async () => {
    mocks.itemFindUnique.mockResolvedValue(garment({
      processingStage: 'QC', processFlow: DRY_FLOW,
    }))
    const res = await call({ action: 'START', expectedStage: 'DRY' })
    expect(res.status).toBe(409)
  })
})
