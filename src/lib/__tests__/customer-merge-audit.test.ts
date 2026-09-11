import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// MERGE CUSTOMERS — behaviour of mergeCustomers() with the new audit fields.
//
// The merge engine itself is NOT redesigned: the same relationship repoints
// (orders, subscriptions, purchases, addresses, activities, documents, notes),
// the same stat recompute, the same MERGED/inactive retirement. This test pins
// the ADDITIVE change — audit fields written on the duplicate and the reason
// surfaced in the merge activity — while asserting the existing guarantees
// (no self-merge, no re-merge, tenant scoping) still hold.
// ============================================================================

const H = vi.hoisted(() => {
  const customers: Record<string, { id: string; businessId: string; name: string; customerCode?: string | null; phone?: string | null; walletBalance: number; outstandingBalance: number; loyaltyPoints: number; status?: string }> = {}
  const prisma = {
    customer: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findFirst: vi.fn(async (a: any) => {
        const c = customers[a.where.id]
        return c && c.businessId === a.where.businessId ? c : null
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: vi.fn(async (a: any) => ({ id: a.where.id, ...a.data })),
    },
    laundryOrder: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aggregate: vi.fn(async (a: any) => ({ _count: { _all: 2 }, _sum: { grandTotal: 500 } })),
    },
    customerSubscription: { updateMany: vi.fn(async () => ({ count: 1 })) },
    subscriptionPurchase: { updateMany: vi.fn(async () => ({ count: 1 })) },
    address: { updateMany: vi.fn(async () => ({ count: 1 })) },
    customerActivity: { updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async (a: any) => ({ id: 'act-1', ...a.data })) },
    customerDocument: { updateMany: vi.fn(async () => ({ count: 1 })) },
    customerNote: { updateMany: vi.fn(async () => ({ count: 1 })) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops.map((o) => o))),
  }
  return { prisma, customers }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))

import { mergeCustomers } from '@/lib/laundry-customer'

const seed = () => {
  H.customers['prim-1'] = { id: 'prim-1', businessId: 'BIZ-A', name: 'Primary', customerCode: 'CUS-0001', phone: '9876543210', walletBalance: 10, outstandingBalance: 5, loyaltyPoints: 100 }
  H.customers['dup-1'] = { id: 'dup-1', businessId: 'BIZ-A', name: 'Dup', customerCode: 'CUS-0002', phone: '9876500000', walletBalance: 20, outstandingBalance: 0, loyaltyPoints: 50 }
  H.customers['dup-2'] = { id: 'dup-2', businessId: 'BIZ-A', name: 'Already Merged', customerCode: 'CUS-0004', phone: '9899999999', walletBalance: 0, outstandingBalance: 0, loyaltyPoints: 0, status: 'MERGED' }
  H.customers['other-1'] = { id: 'other-1', businessId: 'BIZ-B', name: 'Other tenant', customerCode: 'CUS-0009', phone: '9777777777', walletBalance: 0, outstandingBalance: 0, loyaltyPoints: 0 }
}

beforeEach(() => { seed(); vi.clearAllMocks() })

describe('mergeCustomers — relationship handling is unchanged', () => {
  it('repoints every reference from the duplicate to the primary', async () => {
    const res = await mergeCustomers('BIZ-A', 'prim-1', 'dup-1', 'Admin', 'duplicate signup')
    expect(res.ok).toBe(true)
    for (const model of ['laundryOrder', 'customerSubscription', 'subscriptionPurchase', 'address', 'customerActivity', 'customerDocument', 'customerNote']) {
      const calls = H.prisma[model].updateMany.mock.calls
      const move = calls.find((c: { 0: { where: { customerId: string }; data: { customerId: string } } }) => c[0].where.customerId === 'dup-1')
      expect(move, `${model} should be repointed`).toBeTruthy()
      expect(move[0].data.customerId).toBe('prim-1')
    }
    // Stat recompute happens against the real orders (unchanged engine).
    expect(H.prisma.laundryOrder.aggregate).toHaveBeenCalled()
    const aggCall = H.prisma.laundryOrder.aggregate.mock.calls[0][0]
    expect(aggCall.where.customerId).toBe('prim-1')
  })

  it('carries balances and recomputes the primary totals (unchanged carry-over)', async () => {
    await mergeCustomers('BIZ-A', 'prim-1', 'dup-1', 'Admin', 'dup')
    const primUpdate = H.prisma.customer.update.mock.calls.find((c: { 0: { where: { id: string } } }) => c[0].where.id === 'prim-1')!
    expect(primUpdate[0].data).toMatchObject({
      totalOrders: 2, totalSpent: 500,
      walletBalance: { increment: 20 }, outstandingBalance: { increment: 0 }, loyaltyPoints: { increment: 50 },
    })
  })

  it('the duplicate is retired MERGED + inactive and audit fields are written', async () => {
    const res = await mergeCustomers('BIZ-A', 'prim-1', 'dup-1', 'Admin', 'duplicate signup')
    expect(res.ok).toBe(true)
    expect(res).toMatchObject({ primaryId: 'prim-1', mergedId: 'dup-1' })
    const dupUpdate = H.prisma.customer.update.mock.calls.find((c: { 0: { where: { id: string } } }) => c[0].where.id === 'dup-1')!
    const data = dupUpdate[0].data
    expect(data).toMatchObject({ isActive: false, status: 'MERGED', mergedIntoId: 'prim-1', mergedBy: 'Admin' })
    expect(data.mergedAt).toBeInstanceOf(Date)
  })

  it('the reason is recorded in the merge activity on the primary', async () => {
    await mergeCustomers('BIZ-A', 'prim-1', 'dup-1', 'Admin', 'duplicate signup')
    const create = H.prisma.customerActivity.create.mock.calls[0][0]
    expect(create.data.type).toBe('MERGE')
    expect(create.data.customerId).toBe('prim-1')
    expect(create.data.body).toContain('duplicate signup')
    expect(create.data.body).toContain('Dup (9876500000)')
    expect(create.data.actorName).toBe('Admin')
  })
})

describe('mergeCustomers — safety guarantees still hold', () => {
  it('refuses self-merge', async () => {
    const res = await mergeCustomers('BIZ-A', 'prim-1', 'prim-1', 'Admin', 'oops')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('itself')
    expect(H.prisma.customer.update).not.toHaveBeenCalled()
  })

  it('refuses a customer that is already MERGED', async () => {
    const res = await mergeCustomers('BIZ-A', 'prim-1', 'dup-2', 'Admin', 'again')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('already been merged')
    expect(H.prisma.customer.update).not.toHaveBeenCalled()
  })

  it('refuses a customer outside the tenant', async () => {
    const res = await mergeCustomers('BIZ-A', 'prim-1', 'other-1', 'Admin', 'cross tenant')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('not found in this workspace')
    expect(H.prisma.customer.update).not.toHaveBeenCalled()
  })

  it('actor defaults to null when not supplied; reason omitted shows no suffix', async () => {
    await mergeCustomers('BIZ-A', 'prim-1', 'dup-1')
    const dupUpdate = H.prisma.customer.update.mock.calls.find((c: { 0: { where: { id: string } } }) => c[0].where.id === 'dup-1')!
    expect(dupUpdate[0].data.mergedBy).toBeNull()
    const create = H.prisma.customerActivity.create.mock.calls[0][0]
    expect(create.data.body).not.toContain('—')
  })
})