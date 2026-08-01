import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the delivery-scheduling endpoint's AUDIT IMMUTABILITY guard: a
// completed delivery leg is permanent history — no rescheduling/reassigning
// afterwards (deliveryCompletedAt OR status DELIVERED). Pending deliveries keep
// full scheduling behaviour.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    laundryDeliveryExecutive: { findFirst: vi.fn() },
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

vi.mock('@/lib/laundry-slot-capacity', () => ({
  assertDeliverySlotAvailable: vi.fn().mockResolvedValue({ ok: true }),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const mockFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockUpdate = prisma.laundryOrder.update as ReturnType<typeof vi.fn>
const mockExecFind = prisma.laundryDeliveryExecutive.findFirst as ReturnType<typeof vi.fn>

const post = async (payload: Record<string, unknown>) =>
  POST(new Request('http://test/api/laundry/dispatch/delivery', { method: 'POST', body: JSON.stringify(payload) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockExecFind.mockResolvedValue({ id: 'e1', name: 'Rahul', storeId: null })
})

describe('dispatch/delivery POST — immutability after completion', () => {
  it('rejects scheduling a delivery whose deliveryCompletedAt is set', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', status: 'DELIVERED', deliveryRequired: true, deliveryExecutiveId: null, deliveryCompletedAt: new Date(), storeId: 's1' })
    const r = await post({ businessId: 'b1', orderId: 'o1', executiveId: 'e1', deliveryDate: '2026-08-08', deliveryTimeSlot: '10:00 AM' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects scheduling a DELIVERED order even without a deliveryCompletedAt', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', status: 'DELIVERED', deliveryRequired: true, deliveryExecutiveId: null, deliveryCompletedAt: null, storeId: 's1' })
    const r = await post({ businessId: 'b1', orderId: 'o1', executiveId: 'e1' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('still allows scheduling a pending delivery', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', status: 'READY_FOR_DELIVERY', deliveryRequired: true, deliveryExecutiveId: null, deliveryCompletedAt: null, storeId: 's1' })
    const r = await post({ businessId: 'b1', orderId: 'o1', executiveId: 'e1', deliveryDate: '2026-08-08', deliveryTimeSlot: '10:00 AM' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})
