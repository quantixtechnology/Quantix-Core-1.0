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
    laundryOrderEvent: { create: vi.fn().mockResolvedValue({}) },
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

function setupOrder(overrides: Partial<Record<string, unknown>> = {}) {
  mockFindFirst.mockResolvedValue({
    id: 'o1', orderNumber: 'ORD-1', status: 'READY_FOR_DELIVERY', orderType: 'HOME_PICKUP',
    balanceDue: 0, paymentStatus: 'PAID', deliveryRequired: true,
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
})
