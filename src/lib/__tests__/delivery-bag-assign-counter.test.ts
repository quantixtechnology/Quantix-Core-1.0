import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// DELIVERY BAG ASSIGNMENT AT THE COUNTER.
//
// The Ready for Delivery screen had one dead end: an order whose delivery bag
// set was EMPTY reported "0 / 1 bags · No delivery bag assigned yet" and then
// offered NO way to put the physical bag onto the order — the Hand Over button
// was permanently disabled and the order was stranded at the counter.
//
// assignDeliveryBagToOrder() is the missing half. It reuses the SAME building
// blocks the rest of the app uses — pickServiceForBag (one-service orders pick
// automatically), addBagToOrder (the guarded front door on assignBagToOrder,
// which is the ONLY writer of assignment rows) and confirmDeliveryBag (the same
// append-only event a manual scan writes) — so a counter-assigned bag is
// indistinguishable from a sorted one: a plain OPEN assignment carrying purpose
// null, moved to the customer by the SAME applyDeliveryDisposition() at
// completion.
//
// Nothing here bypasses a rule. A bag that does not exist, belongs to another
// tenant or is held by another order is refused exactly as sorting refuses it;
// a multi-service order must say which service the bag belongs to; re-assigning
// a bag already on the order is idempotent; and a bag already confirmed writes
// no second event.
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
      },
      laundryBagEvent: {
        findMany: vi.fn(async (a: any) => state.events
          .filter((e) => e.businessId === a.where.businessId && e.orderId === a.where.orderId)
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())),
        create: vi.fn(async (a: any) => {
          const row = { ...a.data, createdAt: new Date(Date.now() + state.events.length) }
          state.events.push(row); return row
        }),
      },
      laundryOrder: {
        findFirst: vi.fn(async () => ({ orderNumber: 'V8ORD100', customerId: 'cust-1', storeId: 'store-1' })),
      },
    },
    assign: vi.fn(),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-bag-assign', () => ({ assignBagToOrder: H.assign }))

import { assignDeliveryBagToOrder, deliveryBagGate } from '@/lib/laundry-delivery-bags'
import { assignBagToOrder } from '@/lib/laundry-bag-assign'

const { state } = H
const LB = 'lb_vs'
const ORDER = 'ord-1'
const ACTOR = { id: 'emp-7', name: 'Meera', role: 'STORE' }

const ROW_AT = (i: number) => new Date(Date.now() + i * 1000)

const bag = (id: string, num: string) => ({
  id, bagNumber: num, qrValue: num, status: 'AVAILABLE',
  currentCustodianType: 'LAUNDRY', businessId: LB, currentOrderId: null as string | null,
})

const row = (bagId: string, serviceId: string | null, serviceName: string | null, i: number, purpose: string | null = null) => ({
  id: `asg-${i}`, bagId, businessId: LB, orderId: ORDER, status: 'ASSIGNED',
  assignedAt: ROW_AT(i), purpose, serviceId, serviceName,
})

const withRequirement = (requiredBags: number, serviceId = 'svc-wf', serviceName = 'Wash & Fold', extra: { serviceId: string; serviceName: string; requiredBags: number }[] = []) =>
  vi.mocked(H.prisma.laundryOrderService.findMany).mockResolvedValue([
    { serviceId, serviceName, requiredBags }, ...extra,
  ])

const assignImplementation = async ({ code }: { code: string; lbId: string; orderId: string }) => {
  const wanted = String(code ?? '').trim()
  const b = state.bags.find((x) => x.bagNumber === wanted || x.qrValue === wanted)
  if (!b) return { ok: false, status: 404, error: `Bag ${wanted} not found` }
  if (b.currentOrderId && b.currentOrderId !== ORDER) {
    return { ok: false, status: 409, error: `Bag ${wanted} is assigned to another order`, conflict: { bagNumber: b.bagNumber, bagStatus: b.status, heldByOrderNumber: 'ord-other' } }
  }
  if (!state.assignments.some((r) => r.orderId === ORDER && r.bagId === b.id)) {
    b.currentOrderId = ORDER; b.status = 'COLLECTED'; b.currentCustodianType = 'STORE'
    state.assignments.push(row(b.id, 'svc-wf', 'Wash & Fold', state.assignments.length + 1))
  }
  return { ok: true, bag: { id: b.id } }
}

beforeAll(() => { H.assign.mockImplementation(assignImplementation) })

beforeEach(() => {
  state.assignments = []; state.bags = []; state.events = []
  vi.clearAllMocks()
  vi.mocked(H.prisma.laundryOrderService.findMany).mockResolvedValue([])
})

// ── the happy path: the counter puts the required bag onto the order ────────
describe('counter assigns the delivery bag', () => {
  it('the walk-in bag becomes the order bag: total 1/1, gate open', async () => {
    state.bags = [bag('bag-1', 'V8BAG801')]
    withRequirement(1)
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.alreadyOnOrder).toBe(false)
    expect(res.view).toMatchObject({ total: 1, confirmed: 1, accounted: 1, complete: true })
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
    // One assignment row, one append-only confirmation event — nothing else.
    expect(state.assignments.map((r) => r.bagId)).toEqual(['bag-1'])
    expect(state.events.map((e) => e.action)).toEqual(['DELIVERY_BAG_CONFIRMED'])
  })

  it('an order with only CLOSED history gets its missing bag and unblocks', async () => {
    // Closed PICKUP + SORTING rows from earlier stages, no delivery bag.
    const sorted = bag('bag-s', 'V8BAG329')
    state.bags = [sorted, bag('bag-d', 'V8BAG801')]
    state.assignments = [
      { id: 'asg-p', bagId: 'bag-p', businessId: LB, orderId: ORDER, status: 'RETURNED', assignedAt: ROW_AT(0), purpose: 'PICKUP', serviceId: 'svc-wf', serviceName: 'Wash & Fold' },
      { id: 'asg-s', bagId: 'bag-s', businessId: LB, orderId: ORDER, status: 'RETURNED', assignedAt: ROW_AT(1), purpose: 'SORTING', serviceId: 'svc-wf', serviceName: 'Wash & Fold' },
    ]
    withRequirement(1)
    expect((await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })).ok).toBe(true)
    const g = await deliveryBagGate(LB, ORDER)
    expect(g).toBeNull()
    // History is not deleted — the LIVE set gained exactly one open bag.
    expect(state.assignments.filter((r) => r.status === 'ASSIGNED')).toHaveLength(1)
  })
})

// ── every existing rule still holds — nothing is bypassed ───────────────────
describe('the counter assigns through the SAME rules as sorting', () => {
  it('a bag that does not exist is refused, nothing is written', async () => {
    withRequirement(1)
    state.bags = [bag('bag-1', 'V8BAG801')]
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG999', actor: ACTOR })
    expect(res).toMatchObject({ ok: false, status: 404 })
    expect(state.assignments).toHaveLength(0)
    expect(state.events).toHaveLength(0)
    expect(H.assign).toHaveBeenCalledTimes(1)
  })

  it('a bag held by another active order is refused by name, nothing is written', async () => {
    withRequirement(1)
    state.bags = [{ ...bag('bag-1', 'V8BAG801'), currentOrderId: 'ord-other' }]
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.status).toBe(409)
    expect(res.conflict?.bagNumber).toBe('V8BAG801')
    expect(res.conflict?.heldByOrderNumber).toBe('ord-other')
    expect(state.assignments).toHaveLength(0)
    expect(state.events).toHaveLength(0)
  })

  it('a multi-service order must say which service the bag belongs to', async () => {
    withRequirement(1, 'svc-a', 'Wash & Fold', [{ serviceId: 'svc-b', serviceName: 'Dry Clean', requiredBags: 1 }])
    state.bags = [bag('bag-1', 'V8BAG801')]
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.status).toBe(400)
    expect(res.error).toContain('2 services')
    // Refused BEFORE any assignment writer is reached.
    expect(H.assign).not.toHaveBeenCalled()
    expect(state.events).toHaveLength(0)
  })

  it('an empty code is refused up front', async () => {
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: '   ', actor: ACTOR })
    expect(res).toMatchObject({ ok: false, status: 400 })
    expect(H.assign).not.toHaveBeenCalled()
  })
})

// ── idempotency and history integrity ───────────────────────────────────────
describe('re-assign and history stay honest', () => {
  it('re-assigning a bag already on the order is idempotent — no second row', async () => {
    state.bags = [bag('bag-1', 'V8BAG801')]
    state.assignments = [row('bag-1', 'svc-wf', 'Wash & Fold', 1)]
    withRequirement(1)
    const first = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.alreadyOnOrder).toBe(true)
    expect(state.assignments).toHaveLength(1)
    // The confirmation event was written once by the first assign.
    expect(state.events.filter((e) => e.action === 'DELIVERY_BAG_CONFIRMED')).toHaveLength(1)
  })

  it('re-assigning a bag already confirmed writes NO second event', async () => {
    state.bags = [bag('bag-1', 'V8BAG801')]
    state.assignments = [row('bag-1', 'svc-wf', 'Wash & Fold', 1)]
    state.events = [{
      id: 'ev-1', bagId: 'bag-1', bagNumber: 'V8BAG801', businessId: LB, orderId: ORDER,
      action: 'DELIVERY_BAG_CONFIRMED', orderNumber: 'V8ORD100', customerId: 'cust-1', storeId: 'store-1',
      actorId: 'emp-7', actorName: 'Meera', actorRole: 'STORE',
      createdAt: ROW_AT(0),
    }]
    withRequirement(1)
    const res = await assignDeliveryBagToOrder({ lbId: LB, orderId: ORDER, code: 'V8BAG801', actor: ACTOR })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.alreadyConfirmed).toBe(true)
    expect(state.events).toHaveLength(1)
  })
})

// ── the wiring is explicit at source level, and the executive is untouched ──
describe('the counter wires the assignment UI; the executive does not', () => {
  const checklistSrc = readFileSync(join(process.cwd(), 'src/components/laundry/bag-checklist.tsx'), 'utf8')
  const storeSrc = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')
  const execSrc = readFileSync(join(process.cwd(), 'src/components/laundry/executive/executive-app.tsx'), 'utf8')
  const routeSrc = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/delivery-bags/route.ts'), 'utf8')

  it('BagChecklist exposes allowAssign, OFF by default, and posts action "assign"', () => {
    expect(checklistSrc).toContain('allowAssign?: boolean')
    expect(checklistSrc).toContain('allowAssign = false')
    expect(checklistSrc).toContain('action: "assign"')
    expect(checklistSrc).toContain('Scan Delivery Bag')
    expect(checklistSrc).toContain('Enter bag code manually')
    // Only the store page can assign — gated by kind + opt-in flag.
    expect(checklistSrc).toContain('kind === "delivery" && !!allowAssign')
  })

  it('the Ready-for-Delivery page passes allowAssign', () => {
    expect(storeSrc).toMatch(/<BagChecklist[\s\S]{0,400}?allowAssign\s*\/?>/)
  })

  it('the delivery EXECUTIVE BagChecklist passes NO allowAssign — behaviour unchanged', () => {
    const usage = execSrc.slice(execSrc.lastIndexOf('<BagChecklist'), execSrc.indexOf('</BagChecklist>'))
    expect(usage).not.toContain('allowAssign')
  })

  it('the counter route supports the assign action through assignDeliveryBagToOrder', () => {
    expect(routeSrc).toContain('action === "assign"')
    expect(routeSrc).toContain('assignDeliveryBagToOrder')
  })
})