import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the cancel endpoint's AUDIT IMMUTABILITY guard: a completed
// pickup/delivery leg is permanent history — cancel must never wipe the
// completion timestamp or the permanent executive record. Active legs keep
// full cancel behaviour.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn().mockResolvedValue({ id: 'b1', platformBusinessId: 'p1' }),
}))

vi.mock('@/lib/laundry-rbac', () => ({
  requireLaundryPermission: vi.fn().mockResolvedValue({ ok: true, ctx: { userId: 'u1', userName: 'Sup' } }),
}))

vi.mock('@/lib/laundry-field-ops', () => ({
  logFieldEvent: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const mockFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockUpdate = prisma.laundryOrder.update as ReturnType<typeof vi.fn>

const post = async (payload: Record<string, unknown>) =>
  POST(new Request('http://test/api/laundry/dispatch/cancel', { method: 'POST', body: JSON.stringify(payload) }))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dispatch/cancel POST — immutability after completion', () => {
  it('rejects cancelling a completed PICKUP', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupCompletedAt: new Date(), deliveryCompletedAt: null, status: 'IN_TRANSIT_TO_STORE' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'pickup', reason: 'oops' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects cancelling a completed DELIVERY (deliveryCompletedAt)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupCompletedAt: null, deliveryCompletedAt: new Date(), status: 'DELIVERED' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', reason: 'oops' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects cancelling a DELIVERED order even without a deliveryCompletedAt', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'DELIVERED' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', reason: 'oops' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('still allows cancelling a pending pickup', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'AWAITING_PICKUP_ASSIGNMENT' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'pickup', reason: 'customer called it off' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('still allows cancelling a pending delivery', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'READY_FOR_DELIVERY' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', reason: 'customer unavailable' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
