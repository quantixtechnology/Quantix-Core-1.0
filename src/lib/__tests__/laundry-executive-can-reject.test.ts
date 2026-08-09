import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Delivery Executive "Can Reject" — an AUTHORIZATION rule, not a UI preference.
//
// DeliveryExecutive.canReject is the single source of truth. The PWA hides the
// Reject control from it, but the respond endpoint is what makes the rule real:
// a hand-rolled request from a restricted executive must be refused.
// ============================================================================

const mocks = vi.hoisted(() => ({
  resolveExecutive: vi.fn(),
  orderFindFirst: vi.fn(),
  execFindUnique: vi.fn(),
  orderUpdate: vi.fn().mockResolvedValue({}),
  logFieldEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findFirst: mocks.orderFindFirst, update: mocks.orderUpdate },
    laundryDeliveryExecutive: { findUnique: mocks.execFindUnique },
  },
}))
vi.mock('@/lib/laundry-executive-auth', () => ({
  resolveExecutive: mocks.resolveExecutive,
  bearerToken: () => 'tok',
}))
vi.mock('@/lib/laundry-field-ops', () => ({ logFieldEvent: mocks.logFieldEvent }))

import { POST } from '@/app/api/laundry/executive/jobs/[id]/respond/route'

const EXEC = { executiveId: 'exe-001', userId: 'u-1', businessId: 'biz-1', storeId: 'st-1' }
const params = Promise.resolve({ id: 'ord-1' })
const req = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveExecutive.mockResolvedValue(EXEC)
  mocks.orderFindFirst.mockResolvedValue({
    id: 'ord-1', pickupExecutiveId: 'exe-001', deliveryExecutiveId: 'exe-001',
    pickupCompletedAt: null, deliveryCompletedAt: null, status: 'PENDING_PICKUP',
  })
  mocks.orderUpdate.mockResolvedValue({})
})

describe('canReject = No', () => {
  beforeEach(() => mocks.execFindUnique.mockResolvedValue({ canReject: false }))

  it('refuses a reject with 403 even though the API was called directly', async () => {
    const res = await POST(req({ action: 'reject' }), { params })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/not allowed to reject/i)
  })

  it('does NOT change the assignment when the reject is refused', async () => {
    await POST(req({ action: 'reject' }), { params })
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
    expect(mocks.logFieldEvent).not.toHaveBeenCalled()
  })

  it('refuses a delivery reject too, not just pickup', async () => {
    const res = await POST(req({ action: 'reject', type: 'delivery' }), { params })
    expect(res.status).toBe(403)
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
  })

  it('still lets the executive ACCEPT — only rejecting is restricted', async () => {
    const res = await POST(req({ action: 'accept' }), { params })
    expect(res.status).toBe(200)
    expect(mocks.orderUpdate).toHaveBeenCalled()
  })

  it('never even reads the flag for an accept', async () => {
    await POST(req({ action: 'accept' }), { params })
    expect(mocks.execFindUnique).not.toHaveBeenCalled()
  })
})

describe('canReject = Yes', () => {
  beforeEach(() => mocks.execFindUnique.mockResolvedValue({ canReject: true }))

  it('allows the reject', async () => {
    const res = await POST(req({ action: 'reject' }), { params })
    expect(res.status).toBe(200)
  })

  it('returns the pickup to Awaiting Assignment by clearing the executive', async () => {
    await POST(req({ action: 'reject' }), { params })
    const data = mocks.orderUpdate.mock.calls[0][0].data
    expect(data.pickupAcceptance).toBe('REJECTED')
    expect(data.pickupExecutiveId).toBeNull()
    expect(data.pickupAssignedAt).toBeNull()
  })

  it('returns the delivery to Awaiting Assignment the same way', async () => {
    await POST(req({ action: 'reject', type: 'delivery' }), { params })
    const data = mocks.orderUpdate.mock.calls[0][0].data
    expect(data.deliveryAcceptance).toBe('REJECTED')
    expect(data.deliveryExecutiveId).toBeNull()
  })

  it('records the rejection on the order timeline', async () => {
    await POST(req({ action: 'reject' }), { params })
    expect(mocks.logFieldEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'PICKUP_REJECTED' }))
  })
})

// The flag is read fresh from the database on every reject, so it can never be
// spoofed by the client and revoking it takes effect immediately.
describe('the rule cannot be bypassed', () => {
  it('fails CLOSED when the executive row cannot be read', async () => {
    mocks.execFindUnique.mockResolvedValue(null)
    const res = await POST(req({ action: 'reject' }), { params })
    expect(res.status).toBe(403)
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
  })

  it('ignores a canReject claim sent in the request body', async () => {
    mocks.execFindUnique.mockResolvedValue({ canReject: false })
    const res = await POST(req({ action: 'reject', canReject: true }), { params })
    expect(res.status).toBe(403)
  })

  it('rejects an unauthenticated caller before any permission work', async () => {
    mocks.resolveExecutive.mockResolvedValue(null)
    const res = await POST(req({ action: 'reject' }), { params })
    expect(res.status).toBe(401)
    expect(mocks.execFindUnique).not.toHaveBeenCalled()
  })

  it("refuses a job assigned to somebody else, whatever the flag says", async () => {
    mocks.execFindUnique.mockResolvedValue({ canReject: true })
    mocks.orderFindFirst.mockResolvedValue({
      id: 'ord-1', pickupExecutiveId: 'exe-999', deliveryExecutiveId: 'exe-999',
      pickupCompletedAt: null, deliveryCompletedAt: null, status: 'PENDING_PICKUP',
    })
    const res = await POST(req({ action: 'reject' }), { params })
    expect(res.status).toBe(403)
    expect(mocks.orderUpdate).not.toHaveBeenCalled()
  })
})
