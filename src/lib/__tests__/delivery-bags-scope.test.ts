import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// DELIVERY BAGS SCOPE — the delivery view must show the order's CURRENT
// delivery set, never its assignment history.
//
// A real order reached READY_FOR_DELIVERY with pickup and sorting assignments
// CLOSED (their bags were released) and no delivery bag yet. The old reader
// counted every assignment row as a delivery bag, so it reported "0 of 2 bags
// scanned — scan the remaining 2 bags" when the truth, per the order's own
// service accounting, was "1 bag required, 0 assigned".
//
// The delivery set is the order's OPEN assignment rows (status ASSIGNED) —
// that is the only faithful signal, since nothing in the codebase writes
// purpose "DELIVERY" and Packing's bag rows are purpose NULL yet open. Closed
// pickup/sorting rows are HISTORY: they are not bags being handed over.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    assignments: [] as any[],
    bags: [] as any[],
    events: [] as any[],
  }
  return {
    state,
    prisma: {
      laundryOrderService: { findMany: vi.fn().mockResolvedValue([]) },
      laundryBagAssignment: {
        findMany: vi.fn(async (a: any) => state.assignments
          .filter((r) => r.businessId === a.where.businessId && r.orderId === a.where.orderId)
          .sort((x, y) => x.assignedAt.getTime() - y.assignedAt.getTime())
          .map((r) => ({ ...r, bag: state.bags.find((b) => b.id === r.bagId) ?? null }))),
        count: vi.fn(async () => state.assignments.length),
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({})),
        create: vi.fn(async () => ({})),
      },
      laundryBag: {
        update: vi.fn(async () => ({})),
        updateMany: vi.fn(async () => ({})),
        findMany: vi.fn(async () => state.bags),
      },
      laundryBagEvent: {
        findMany: vi.fn(async (a: any) => state.events
          .filter((e) => e.businessId === a.where.businessId && e.orderId === a.where.orderId)
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())),
        create: vi.fn(async (a) => {
          const row = { ...a.data, createdAt: new Date(Date.now() + state.events.length) }
          state.events.push(row); return row
        }),
      },
      laundryOrder: {
        findFirst: vi.fn(async () => ({ id: ORDER, orderNumber: 'V8ORD100', customerId: 'cust-1', storeId: 'store-1' })),
      },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-bag-assign', () => ({ assignBagToOrder: vi.fn() }))

import { deliveryBags, deliveryBagGate, confirmDeliveryBag, DELIVERY_BAG_CONFIRMED } from '@/lib/laundry-delivery-bags'

const { state } = H
const LB = 'lb_vs'
const ORDER = 'ord-1'
const EXEC = { id: 'exec-9', name: 'Ravi', role: 'DELIVERY_EXECUTIVE' }
const ROW_AT = (i: number) => new Date(Date.now() + i * 1000)

// A bag with ALL the fields the assignment mapping can read, plus an id used by
// both the bag record and QR scans (bagNumber === qrValue), like the real data.
const bag = (id: string, num: string) => ({
  id, bagNumber: num, qrValue: num, status: 'READY_FOR_DELIVERY',
  currentCustodianType: 'DELIVERY_EXECUTIVE', businessId: LB,
})

// One assignment row. open = status ASSIGNED; anything else (e.g. RETURNED) is
// CLOSED history. purpose mirrors what the writers actually store: PICKUP
// (assign routes), SORTING (laundry-finishing), null (Packing & QR).
const row = (bagId: string, status: string, purpose: string | null, serviceId: string | null, serviceName: string | null, i: number) => ({
  id: `asg-${i}`, bagId, businessId: LB, orderId: ORDER, status,
  assignedAt: ROW_AT(i), purpose, serviceId, serviceName,
})

/** The live order shape: closed PICKUP + closed SORTING, no delivery bag yet. */
const seedClosedHistory = () => {
  const pickup = bag('bag-p', 'V8BAG329')
  const sorted = bag('bag-s', 'V8BAG329')
  state.bags = [pickup, sorted]
  state.assignments = [
    row('bag-p', 'RETURNED', 'PICKUP', 'svc-wf', 'Wash & Fold', 1),
    row('bag-s', 'RETURNED', 'SORTING', 'svc-wf', 'Wash & Fold', 2),
  ]
}

/** A couple of open DELIVERY bags (purpose NULL, like Packing writes them). */
const seedDelivery = (n: number) => {
  state.bags = Array.from({ length: n }, (_, i) => bag(`bag-d${i + 1}`, `V8BAG0${i + 2}`))
  state.assignments = state.bags.map((b, i) => row(b.id, 'ASSIGNED', null, 'svc-wf', 'Wash & Fold', i + 1))
}

const withRequirement = (requiredBags: number) =>
  vi.mocked(H.prisma.laundryOrderService.findMany).mockResolvedValue([
    { serviceId: 'svc-wf', serviceName: 'Wash & Fold', requiredBags },
  ])

beforeEach(() => {
  state.assignments = []; state.bags = []; state.events = []
  vi.clearAllMocks()
  vi.mocked(H.prisma.laundryOrderService.findMany).mockResolvedValue([])
})

// ── the live case: history only, nothing to deliver ─────────────────────────
describe('an order with only closed pickup/sorting history and no delivery bag', () => {
  it('does NOT report "0 of 2" — no history row is a delivery bag', async () => {
    seedClosedHistory()
    withRequirement(1)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(0)                      // not 2
    expect(v.bags).toEqual([])                   // V8BAG329 A and B are HIDDEN
    expect(v.summary).not.toContain('2 bags scanned')
    expect(v.summary).toBe('0 / 1 bags')         // requirement, from accounting
  })

  it('tells the operator the required delivery bag has not been assigned, and delivery is blocked', async () => {
    seedClosedHistory()
    withRequirement(1)
    const v = await deliveryBags(LB, ORDER)
    expect(v.complete).toBe(false)
    expect(v.message).toBe('No delivery bag assigned yet — 0 / 1 bags. Wash & Fold has 1 bag outstanding (0 / 1)')
    expect(await deliveryBagGate(LB, ORDER)).toBe(v.message)
  })

  it('an order that NEVER had a bag still completes — bagless legacy invariant', async () => {
    withRequirement(1)
    const v = await deliveryBags(LB, ORDER)
    expect([v.total, v.complete]).toEqual([0, true])
    expect(v.message).toBeNull()
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })
})

// ── the count reflects only the delivery set ────────────────────────────────
describe('the delivery set counts ONLY OPEN assignment rows', () => {
  it('one open delivery bag → exactly one, shown', async () => {
    seedDelivery(1)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(1)
    expect(v.bags.map((b) => b.bagNumber)).toEqual(['V8BAG02'])
  })

  it('two open delivery bags → exactly two, shown', async () => {
    seedDelivery(2)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(2)
    expect(v.bags.map((b) => b.bagNumber)).toEqual(['V8BAG02', 'V8BAG03'])
  })

  it('closed pickup/sorting history PLUS two delivery bags → only the two are shown', async () => {
    seedClosedHistory()
    seedDelivery(2)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(2)
    expect(v.bags.map((b) => b.bagNumber)).toEqual(['V8BAG02', 'V8BAG03'])
    expect(v.bags.every((b) => b.open)).toBe(true)
  })

  it('only CLOSED rows of any purpose → none appear as delivery bags', async () => {
    state.bags = [bag('bag-p', 'V8BAG329'), bag('bag-s', 'V8BAG330'), bag('bag-d', 'V8BAG331')]
    state.assignments = [
      row('bag-p', 'RETURNED', 'PICKUP', 'svc-p', 'Pickup', 1),
      row('bag-s', 'RETURNED', 'SORTING', 'svc-s', 'Sorting', 2),
      row('bag-d', 'RETURNED', null, 'svc-wf', 'Wash & Fold', 3),
    ]
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(0)
    expect(v.bags).toEqual([])
  })
})

// ── the requirement comes from service accounting, not a row count ──────────
describe('requirement vs history are independent', () => {
  it('an opened delivery bag still satisfies the accounting when it matches the service', async () => {
    seedDelivery(1)
    withRequirement(1)
    expect(await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG02', actor: EXEC })).toMatchObject({ ok: true })
    const v = await deliveryBags(LB, ORDER)
    expect([v.total, v.complete]).toEqual([1, true])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('history alone can never satisfy a requirement — blocks even at total 0', async () => {
    seedClosedHistory()
    withRequirement(1)
    expect(await deliveryBagGate(LB, ORDER)).not.toBeNull()
  })

  it('events are keyed to the delivered bags only — closed rows never accrue counts', async () => {
    seedClosedHistory()
    seedDelivery(2)
    for (const b of state.bags.filter((b) => b.id.startsWith('bag-d'))) {
      await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: b.bagNumber, actor: EXEC })
    }
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.total]).toEqual([2, 2])
    expect(state.events.filter((e) => e.action === DELIVERY_BAG_CONFIRMED)).toHaveLength(2)
  })
})

// ── the reader is scoped at the source anyone can grep ──────────────────────
describe('the delivery reader scopes on open assignments', () => {
  it('orderBags still returns closed rows (history consumers untouched)', async () => {
    const { orderBags } = await import('@/lib/laundry-order-bags')
    seedClosedHistory()
    const all = await orderBags(LB, ORDER)
    expect(all).toHaveLength(2)                    // history is still readable
    expect(all.every((b) => !b.open)).toBe(true)
  })

  it('deliveryBags filters that history to the OPEN set — a one-line, greppable rule', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/laundry-delivery-bags.ts'), 'utf8')
    expect(src).toContain('all.filter((b) => b.open)')
    expect(src).toContain('const bags = all.filter((b) => b.open)')
  })
})