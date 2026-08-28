import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the assignment IMMUTABILITY guard: once a pickup or delivery is
// completed, the assigned executive is permanent history. Single assign/reassign
// is rejected with 409; bulk operations skip completed legs so they are never
// modified. Pending orders keep full assign/reassign behaviour.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
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
  FIELD_STATUS: { ASSIGNED: 'ASSIGNED', PICKUP_STARTED: 'PICKUP_STARTED' },
}))

vi.mock('@/lib/laundry-notify', () => ({
  notifyCustomerForOrder: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/laundry-dispatch', () => ({
  PICKUP_QUEUE_STATUSES: [],
  dispatchBucketOf: vi.fn(),
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'
import { resolveLaundryBusiness } from '@/lib/laundry-business'

const mockFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockFindMany = prisma.laundryOrder.findMany as ReturnType<typeof vi.fn>
const mockUpdate = prisma.laundryOrder.update as ReturnType<typeof vi.fn>
const mockUpdateMany = prisma.laundryOrder.updateMany as ReturnType<typeof vi.fn>
const mockResolve = resolveLaundryBusiness as ReturnType<typeof vi.fn>

const post = async (payload: Record<string, unknown>) =>
  POST(new Request('http://test/api/laundry/pickup-scheduler', { method: 'POST', body: JSON.stringify(payload) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockResolve.mockResolvedValue({ id: 'b1', platformBusinessId: 'p1' })
  ;(prisma.laundryDeliveryExecutive.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'e1', name: 'Rahul', storeId: 's1' })
})

describe('pickup-scheduler POST — assignment immutability after completion', () => {
  it('rejects re/assigning a DELIVERED order (delivery completed)', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', storeId: 's1', pickupCompletedAt: null, deliveryCompletedAt: new Date(), status: 'DELIVERED' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', executiveId: 'e1' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects re/assigning an order whose PICKUP is completed', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', storeId: 's1', pickupCompletedAt: new Date(), deliveryCompletedAt: null, status: 'IN_TRANSIT_TO_STORE' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'pickup', executiveId: 'e1' })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects UNASSIGNING a completed delivery too', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', storeId: 's1', pickupCompletedAt: null, deliveryCompletedAt: new Date(), status: 'DELIVERED' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', executiveId: null })
    expect(r.status).toBe(409)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('still allows assignment while the delivery is pending', async () => {
    mockFindFirst.mockResolvedValue({ id: 'o1', storeId: 's1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'READY_FOR_DELIVERY' })
    const r = await post({ businessId: 'b1', orderId: 'o1', type: 'delivery', executiveId: 'e1' })
    expect(r.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('bulk assign skips completed legs and only touches eligible orders', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'a1', storeId: 's1', pickupCompletedAt: new Date(), deliveryCompletedAt: null, status: 'IN_TRANSIT_TO_STORE' },
      { id: 'a2', storeId: 's1', pickupCompletedAt: null, deliveryCompletedAt: null, status: 'AWAITING_PICKUP_ASSIGNMENT' },
    ])
    const r = await post({ businessId: 'b1', orderIds: ['a1', 'a2'], type: 'pickup', executiveId: 'e1' })
    const j = await r.json()
    expect(r.status).toBe(200)
    expect(j).toMatchObject({ success: true, assigned: 1, skipped: 1 })
    // Two statements now: the leg's own columns, then the SHARED fieldStatus
    // stamp — scoped so assigning one leg cannot reset the other's live
    // progress. Both may only target a2 (eligible).
    expect(mockUpdateMany).toHaveBeenCalledTimes(2)
    const [fields, stamp] = mockUpdateMany.mock.calls.map((c) => c[0])
    expect(fields.where.id.in).toEqual(['a2'])
    expect(fields.data).not.toHaveProperty('fieldStatus')
    expect(stamp.where.id.in).toEqual(['a2'])
    expect(stamp.data).toHaveProperty('fieldStatus')
    // …and the stamp is guarded by the OTHER leg being idle.
    expect(stamp.where).toMatchObject({ deliveryStartedAt: null, deliveryCompletedAt: null })
  })
})
