import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the executive respond endpoint's AUDIT IMMUTABILITY guard: once a
// pickup/delivery leg is completed, the executive can no longer accept/reject
// (which would clear the permanent executive record). Pending assignments keep
// full accept/reject behaviour.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    laundryDeliveryExecutive: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/laundry-executive-auth', () => ({
  resolveExecutive: vi.fn().mockResolvedValue({ executiveId: 'e1', userId: 'u1', businessId: 'b1', storeId: null }),
  bearerToken: vi.fn(() => 'token'),
}))

vi.mock('@/lib/laundry-field-ops', () => ({
  logFieldEvent: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const mockFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockUpdate = prisma.laundryOrder.update as ReturnType<typeof vi.fn>

const post = async (payload: Record<string, unknown>) =>
  POST(new Request('http://test/api/laundry/executive/jobs/o1/respond', { method: 'POST', body: JSON.stringify(payload) }), { params: Promise.resolve({ id: 'o1' }) })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executive respond POST — immutability after completion', () => {
  it('rejects REJECTING a completed pickup (would clear the permanent record)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupExecutiveId: 'e1', deliveryExecutiveId: null, pickupCompletedAt: new Date(), deliveryCompletedAt: null, status: 'IN_TRANSIT_TO_STORE' })
    const r = await post({ action: 'reject', type: 'pickup' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects ACCEPTING a completed pickup too', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupExecutiveId: 'e1', deliveryExecutiveId: null, pickupCompletedAt: new Date(), deliveryCompletedAt: null, status: 'IN_TRANSIT_TO_STORE' })
    const r = await post({ action: 'accept', type: 'pickup' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects responding on a completed DELIVERY', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupExecutiveId: null, deliveryExecutiveId: 'e1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'DELIVERED' })
    const r = await post({ action: 'reject', type: 'delivery' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('still allows rejecting a pending pickup', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupExecutiveId: 'e1', deliveryExecutiveId: null, pickupCompletedAt: null, deliveryCompletedAt: null, status: 'AWAITING_PICKUP_ASSIGNMENT' })
    ;(prisma.laundryDeliveryExecutive.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ canReject: true })
    const r = await post({ action: 'reject', type: 'pickup' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('still allows accepting a pending delivery', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', pickupExecutiveId: null, deliveryExecutiveId: 'e1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'READY_FOR_DELIVERY' })
    const r = await post({ action: 'accept', type: 'delivery' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
