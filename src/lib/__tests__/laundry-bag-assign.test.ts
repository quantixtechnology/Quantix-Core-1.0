import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the shared reusable-bag assignment engine — MULTIPLE bags per
// service. A service may span as many bags as the pickup needs, but the core
// validations are unchanged: an unknown bag is rejected, and a bag that is not
// AVAILABLE (already assigned elsewhere / same bag scanned twice / Damaged /
// Lost / Cleaning) can never be assigned again.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    laundryBag: { findFirst: vi.fn() },
    laundryOrder: { findFirst: vi.fn() },
    customer: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { assignBagToOrder } from '../laundry-bag-assign'
import { prisma } from '@/lib/prisma'

const mockBagFindFirst = prisma.laundryBag.findFirst as ReturnType<typeof vi.fn>
const mockOrderFindFirst = prisma.laundryOrder.findFirst as ReturnType<typeof vi.fn>
const mockCustomer = prisma.customer.findUnique as ReturnType<typeof vi.fn>
const mockTx = prisma.$transaction as ReturnType<typeof vi.fn>

// Minimal TransactionClient surface the engine touches.
const tx = {
  laundryBag: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  laundryBagAssignment: { create: vi.fn() },
}

const BAG = { id: 'bag-2', bagNumber: 'BAG-0002', status: 'AVAILABLE' }
const ORDER = { id: 'ord-1', orderNumber: 'ORD-1', customerId: 'cust-1' }

describe('assignBagToOrder — multiple bags per service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBagFindFirst.mockResolvedValue(BAG)
    mockOrderFindFirst.mockResolvedValue(ORDER)
    mockCustomer.mockResolvedValue({ name: 'Ravi' })
    mockTx.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))
    tx.laundryBag.findUnique.mockResolvedValue({ status: 'AVAILABLE' })
    tx.laundryBag.update.mockResolvedValue({ ...BAG })
    tx.laundryBagAssignment.create.mockResolvedValue({ id: 'assign-1' })
  })

  it('assigns a SECOND bag to a service that already has one', async () => {
    // Simulates a bag already assigned to this order+service — the old
    // one-bag-per-service rule would reject; the new rule allows the split.
    tx.laundryBag.findFirst.mockResolvedValue({ bagNumber: 'BAG-0001' })
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-0002', orderId: 'ord-1', serviceId: 'svc-1', serviceName: 'Wash & Fold' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.bag.bagNumber).toBe('BAG-0002')
    // The duplicate-service check is gone — it must not even be consulted.
    expect(tx.laundryBag.findFirst).not.toHaveBeenCalled()
    // A new assignment record is created for this (bag, order, service).
    expect(tx.laundryBagAssignment.create).toHaveBeenCalledTimes(1)
  })

  it('assigns a bag to an order with NO serviceId', async () => {
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-0002', orderId: 'ord-1' })
    expect(r.ok).toBe(true)
    expect(tx.laundryBagAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ serviceId: null, serviceName: 'Laundry' }) }))
  })

  it('rejects an unknown bag', async () => {
    mockBagFindFirst.mockResolvedValue(null)
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-XXXX', orderId: 'ord-1', serviceId: 'svc-1', serviceName: 'Wash & Fold' })
    expect(r).toMatchObject({ ok: false, status: 404 })
    expect(tx.laundryBagAssignment.create).not.toHaveBeenCalled()
  })

  it('rejects a bag already carrying another order (same bag twice)', async () => {
    mockBagFindFirst.mockResolvedValue({ id: 'bag-2', bagNumber: 'BAG-0002', status: 'COLLECTED' })
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-0002', orderId: 'ord-1', serviceId: 'svc-1', serviceName: 'Wash & Fold' })
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(tx.laundryBagAssignment.create).not.toHaveBeenCalled()
  })

  it('rejects a bag marked Damaged', async () => {
    mockBagFindFirst.mockResolvedValue({ id: 'bag-2', bagNumber: 'BAG-0002', status: 'DAMAGED' })
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-0002', orderId: 'ord-1', serviceId: 'svc-1', serviceName: 'Wash & Fold' })
    expect(r).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects a concurrent assignment inside the transaction', async () => {
    tx.laundryBag.findUnique.mockResolvedValue({ status: 'COLLECTED' })
    const r = await assignBagToOrder({ lbId: 'lb-1', code: 'BAG-0002', orderId: 'ord-1', serviceId: 'svc-1', serviceName: 'Wash & Fold' })
    expect(r).toMatchObject({ ok: false, status: 409 })
    expect(tx.laundryBagAssignment.create).not.toHaveBeenCalled()
  })
})
