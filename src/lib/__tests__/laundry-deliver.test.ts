import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the shared DELIVERED engine — data consistency of delivery
// completion. A finished delivery must always record deliveryCompletedAt for
// ACTUAL home deliveries (deliveryRequired), so the Delivery panel, Dispatch
// and History agree in every path (executive PWA OR store/counter completion).
// WALK_IN / STORE_DROP are customer-pickup handovers — no delivery fields.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), updateMany: vi.fn() },
    laundryOrderItem: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    // loadOrderEvidence (the shared state guard) reads the timeline for the
    // historical processing proof.
    laundryOrderEvent: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/laundry-bag-assign', () => ({
  getBagReleaseStage: vi.fn().mockResolvedValue('STORE_RECEIVE'),
  releaseBagsForOrder: vi.fn().mockResolvedValue(0),
}))

vi.mock('@/lib/laundry-notify', () => ({
  notifyDeliveryCompleted: vi.fn().mockResolvedValue(undefined),
}))

import { markOrderDelivered } from '../laundry-deliver'
import { prisma } from '@/lib/prisma'

const mockFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockUpdateMany = prisma.laundryOrder.updateMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// Four garments, all inspected at Store Audit and all through processing — the
// evidence the state guard requires before an order may become DELIVERED.
const processedItems = () =>
  Array.from({ length: 4 }, () => ({ inspectedAt: new Date(), processingStage: 'DISPATCHED', processingStatus: 'DONE' }))

function setupOrder(overrides: Partial<Record<string, unknown>> = {}) {
  mockFindFirst.mockResolvedValue({
    id: 'o1', orderNumber: 'ORD-1', businessId: 'b1', status: 'READY_FOR_DELIVERY', orderType: 'HOME_PICKUP',
    balanceDue: 0, paymentStatus: 'PAID', deliveryRequired: true,
    pickupRequired: true, pickupCompletedAt: new Date(), deliveredAt: null, deliveryCompletedAt: null,
    items: processedItems(),
    ...overrides,
  })
}

describe('markOrderDelivered — delivery completion consistency', () => {
  it('records deliveryCompletedAt for a completed HOME delivery (deliveryRequired)', async () => {
    setupOrder()
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1', deliveredBy: 'Store Staff' })
    expect(r).toMatchObject({ ok: true })
    const data = mockUpdateMany.mock.calls[0][0].data
    expect(data.status).toBe('DELIVERED')
    expect(data.deliveredAt).toBeInstanceOf(Date)
    expect(data.deliveryCompletedAt).toBeInstanceOf(Date)
    expect(data.deliveredBy).toBe('Store Staff')
  })

  it('keeps deliveryCompletedAt null for WALK_IN / STORE_DROP counter handovers', async () => {
    setupOrder({ orderType: 'WALK_IN', deliveryRequired: false })
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1', deliveredBy: 'Counter' })
    expect(r).toMatchObject({ ok: true })
    const data = mockUpdateMany.mock.calls[0][0].data
    expect(data.status).toBe('DELIVERED')
    expect(data.deliveryCompletedAt).toBeUndefined()
    expect(data.deliveredBy).toBe('Counter')
  })

  it('still records deliveredBy/recipient for every completed order', async () => {
    setupOrder()
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1', deliveredBy: 'Ravi', recipientName: 'Anita' })
    expect(r.ok).toBe(true)
    const data = mockUpdateMany.mock.calls[0][0].data
    expect(data.deliveredBy).toBe('Ravi')
    expect(data.recipientName).toBe('Anita')
  })

  it('rejects when the order is not READY_FOR_DELIVERY', async () => {
    setupOrder({ status: 'DELIVERED' })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1' })
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('rejects when there is an outstanding balance (payment gate unchanged)', async () => {
    setupOrder({ balanceDue: 120, paymentStatus: 'UNPAID' })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1' })
    expect(r).toMatchObject({ ok: false, status: 402, code: 'BALANCE_DUE' })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  // ── The workflow gate: status alone is not permission to deliver ──────────
  it('refuses to deliver an order whose garments never entered processing', async () => {
    setupOrder({ items: Array.from({ length: 3 }, () => ({ inspectedAt: new Date(), processingStage: null, processingStatus: null })) })
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1' })
    expect(r).toMatchObject({ ok: false, code: 'PROCESSING_NOT_COMPLETE' })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('refuses to deliver an order with no garments at all', async () => {
    setupOrder({ items: [] })
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1' })
    expect(r).toMatchObject({ ok: false, code: 'GARMENTS_NOT_IDENTIFIED' })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('accepts an order processed before per-garment tracking (timeline proof)', async () => {
    setupOrder({ items: Array.from({ length: 2 }, () => ({ inspectedAt: new Date(), processingStage: null, processingStatus: null })) })
    ;(prisma.laundryOrderEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ action: 'RECEIVE_AT_STORE' }])
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const r = await markOrderDelivered({ lbId: 'b1', orderId: 'o1' })
    expect(r).toMatchObject({ ok: true })
  })
})
