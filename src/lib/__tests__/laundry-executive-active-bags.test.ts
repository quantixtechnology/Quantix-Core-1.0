import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// The Delivery Executive PWA must show the bags it is HOLDING, not every bag
// the order has ever travelled in.
//
// LaundryBagAssignment is append-only, so one order accumulates a row per leg
// — pickup, store↔processing transit, the return. On a live job those stale
// rows made a one-bag delivery read as "2 bags".
//
// A row counts as live only when BOTH signals agree: the assignment is still
// open, and the bag still names this order as its current holder.
// ============================================================================

const mocks = vi.hoisted(() => ({
  resolveExecutive: vi.fn(),
  orderFindMany: vi.fn(),
  customerFindMany: vi.fn().mockResolvedValue([]),
  assignmentFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryOrder: { findMany: mocks.orderFindMany },
    customer: { findMany: mocks.customerFindMany },
    laundryBagAssignment: { findMany: mocks.assignmentFindMany },
  },
}))
vi.mock('@/lib/laundry-executive-auth', () => ({
  resolveExecutive: mocks.resolveExecutive,
  bearerToken: () => 'tok',
}))

import { GET } from '@/app/api/laundry/executive/jobs/route'

const ORDER_ID = 'ord-1'

const order = {
  id: ORDER_ID, orderNumber: 'ORD-1', status: 'READY_FOR_DELIVERY', fieldStatus: null,
  isExpress: false, customerId: null,
  pickupDate: null, pickupTimeSlot: null, pickupAddress: null, pickupLandmark: null,
  pickupMapsLink: null, pickupLat: null, pickupLng: null,
  expectedDeliveryDate: null, deliveryDate: null, deliveryTimeSlot: null, deliveredAt: null,
  pickupAcceptance: 'ACCEPTED', deliveryAcceptance: 'ACCEPTED',
  deliveryBagNumber: null, grandTotal: 0, amountPaid: 0, balanceDue: 0, paymentStatus: 'PAID',
  pickupVerificationMethod: null, deliveryVerificationMethod: null,
  services: [{ serviceId: 'svc-1', serviceName: 'Wash & Fold' }],
  _count: { items: 3 },
}

/** A bag released back to the pool — its row is closed and it holds nothing. */
const releasedRow = {
  orderId: ORDER_ID, serviceId: 'svc-1', serviceName: 'Wash & Fold', bagId: 'bag-1',
  assignedAt: new Date('2026-08-01'), status: 'RETURNED',
  bag: { bagNumber: 'BAG-000009', currentOrderId: null },
}
/** The bag actually carrying this order right now. */
const liveRow = {
  orderId: ORDER_ID, serviceId: 'svc-1', serviceName: 'Wash & Fold', bagId: 'bag-2',
  assignedAt: new Date('2026-08-05'), status: 'ASSIGNED',
  bag: { bagNumber: 'BAG-000001', currentOrderId: ORDER_ID },
}

const call = async (type: string) => {
  const res = await GET(new Request(`http://x/api/laundry/executive/jobs?type=${type}`))
  return (await res.json()).data[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolveExecutive.mockResolvedValue({ executiveId: 'exe-1', businessId: 'biz-1', userId: 'u-1' })
  mocks.orderFindMany.mockResolvedValue([order])
  mocks.customerFindMany.mockResolvedValue([])
})

describe('a live delivery job', () => {
  beforeEach(() => {
    // The query already drops closed rows; the released one is returned here to
    // prove the second signal (bag custody) also holds on its own.
    mocks.assignmentFindMany.mockResolvedValue([releasedRow, liveRow])
  })

  it('shows only the bag currently carrying the order', async () => {
    const job = await call('delivery')
    expect(job.services[0].bags).toEqual(['BAG-000001'])
  })

  it('counts one bag, not every bag ever linked to the order', async () => {
    const job = await call('delivery')
    expect(job.bagCount).toBe(1)
  })

  it('asks the database for open assignments only', async () => {
    await call('delivery')
    expect(mocks.assignmentFindMany.mock.calls[0][0].where.status).toBe('ASSIGNED')
  })

  it('drops a bag that has been handed to another order', async () => {
    mocks.assignmentFindMany.mockResolvedValue([
      { ...liveRow, bag: { bagNumber: 'BAG-000001', currentOrderId: 'other-order' } },
    ])
    const job = await call('delivery')
    expect(job.services[0].bags).toEqual([])
    expect(job.bagCount).toBe(0)
  })

  it('still shows both when the order genuinely travels in two live bags', async () => {
    mocks.assignmentFindMany.mockResolvedValue([
      liveRow,
      { ...liveRow, bagId: 'bag-3', bag: { bagNumber: 'BAG-000002', currentOrderId: ORDER_ID } },
    ])
    const job = await call('delivery')
    expect(job.services[0].bags).toEqual(['BAG-000001', 'BAG-000002'])
    expect(job.bagCount).toBe(2)
  })
})

describe('a live pickup job', () => {
  it('shows the bags the executive just scanned', async () => {
    mocks.assignmentFindMany.mockResolvedValue([liveRow])
    const job = await call('pickup')
    expect(job.services[0].bags).toEqual(['BAG-000001'])
    expect(job.assignedBags).toBe(1)
    expect(mocks.assignmentFindMany.mock.calls[0][0].where.status).toBe('ASSIGNED')
  })
})

// Filtering a finished job would erase the executive's record of what they
// carried — the complaint was about live jobs only.
describe('completed and history keep the full record', () => {
  beforeEach(() => mocks.assignmentFindMany.mockResolvedValue([releasedRow, liveRow]))

  it('history shows the bags the order actually travelled in', async () => {
    const job = await call('history')
    expect(job.services[0].bags).toEqual(['BAG-000009', 'BAG-000001'])
    expect(job.bagCount).toBe(2)
  })

  it('does not restrict the query to open assignments', async () => {
    await call('completed')
    expect(mocks.assignmentFindMany.mock.calls[0][0].where.status).toBeUndefined()
  })
})
