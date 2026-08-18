import { describe, it, expect, beforeEach, vi } from 'vitest'

// ============================================================================
// Customer-retained bag lifecycle — the 15 scenarios from the spec.
//
// These run against an in-memory store rather than call-assertions on mocks,
// because what matters here is the STATE a bag ends up in after a sequence of
// real events — handed over, kept for three orders, brought back damaged. A
// test that only proves "update was called" would pass while the bag sat in the
// wrong bucket.
// ============================================================================

interface Row { [k: string]: unknown }

const db: { bags: Row[]; usages: Row[]; events: Row[]; orders: Row[]; customers: Row[] } = {
  bags: [], usages: [], events: [], orders: [], customers: [],
}

let seq = 0
const id = (p: string) => `${p}${++seq}`

/** Supports the subset of Prisma filters this engine actually uses. */
function matches(row: Row, where: Row = {}): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'OR') { if (!(v as Row[]).some((c) => matches(row, c))) return false; continue }
    if (v && typeof v === 'object' && 'in' in (v as Row)) {
      if (!((v as { in: unknown[] }).in).includes(row[k])) return false
      continue
    }
    if (v && typeof v === 'object' && 'not' in (v as Row)) {
      if (row[k] === (v as { not: unknown }).not) return false
      continue
    }
    if (row[k] !== v) return false
  }
  return true
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in (v as Row)) {
      row[k] = ((row[k] as number) || 0) + (v as { increment: number }).increment
    } else row[k] = v
  }
}

function sortBy(rows: Row[], orderBy?: Row): Row[] {
  if (!orderBy) return rows
  const [field, dir] = Object.entries(orderBy)[0] as [string, string]
  return [...rows].sort((a, b) => {
    const av = a[field] as number | Date | null, bv = b[field] as number | Date | null
    const an = av instanceof Date ? av.getTime() : (av as number) ?? 0
    const bn = bv instanceof Date ? bv.getTime() : (bv as number) ?? 0
    return dir === 'desc' ? bn - an : an - bn
  })
}

/** Reads return SNAPSHOTS, exactly as Prisma does. Handing back the live row
 *  would let a caller's "previous status" change underneath it — which silently
 *  disables the concurrency guard and rewrites the audit trail as it is read. */
const snap = (r: Row | undefined | null) => (r ? { ...r } : null)

function table(rows: Row[], prefix: string) {
  return {
    findFirst: vi.fn(async ({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) =>
      snap(sortBy(rows.filter((r) => matches(r, where)), orderBy)[0])),
    findMany: vi.fn(async ({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) =>
      sortBy(rows.filter((r) => matches(r, where)), orderBy).map((r) => ({ ...r }))),
    findUnique: vi.fn(async ({ where }: { where: Row }) => snap(rows.find((r) => r.id === where.id))),
    create: vi.fn(async ({ data }: { data: Row }) => { const r = { id: id(prefix), ...data }; rows.push(r); return { ...r } }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const r = rows.find((x) => x.id === where.id); if (!r) throw new Error('not found')
      applyData(r, data); return { ...r }
    }),
    updateMany: vi.fn(async ({ where, data }: { where?: Row; data: Row }) => {
      const hit = rows.filter((r) => matches(r, where)); hit.forEach((r) => applyData(r, data))
      return { count: hit.length }
    }),
  }
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    get laundryBag() { return table(db.bags, 'bag') },
    get laundryBagAssignment() { return table(db.usages, 'usage') },
    get laundryBagEvent() { return table(db.events, 'evt') },
    get laundryOrder() { return table(db.orders, 'ord') },
    get customer() { return table(db.customers, 'cus') },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get laundryBag() { return table(db.bags, 'bag') },
      get laundryBagAssignment() { return table(db.usages, 'usage') },
      get laundryBagEvent() { return table(db.events, 'evt') },
    })),
  },
}))

import {
  applyDeliveryDisposition, identifyReturnedBag, receiveReturnedBag,
  conditionToStatus, tallyInventory, bucketFor, getBagsWithCustomer,
  setTerminalState, markQrDamaged, getBagHistory,
  BAG_STATUS, CUSTODIAN, BAG_CONDITION, DISPOSITION, DEFAULT_DISPOSITION,
} from '../laundry-bag-lifecycle'

const LB = 'lb1'

function makeBag(over: Row = {}): Row {
  const b: Row = {
    id: id('bag'), bagNumber: `BAG-${seq}`, qrValue: `BAG-${seq}`, businessId: LB,
    status: BAG_STATUS.AVAILABLE, condition: BAG_CONDITION.GOOD, active: true, qrDamaged: false,
    currentCustodianType: CUSTODIAN.STORE, currentCustodianId: null, currentCustodianName: null,
    currentStoreId: 's1', currentOrderId: null, currentOrderNumber: null,
    currentCustomerId: null, currentCustomerName: null,
    handedToCustomerAt: null, handedToCustomerOrderId: null,
    totalUsageCount: 0, lastUsedAt: null, lastReturnedAt: null,
    ...over,
  }
  db.bags.push(b); return b
}

function makeOrder(over: Row = {}): Row {
  const o: Row = {
    id: id('ord'), orderNumber: `ORD-${seq}`, businessId: LB,
    customerId: 'cusA', deliveryBagNumber: null, storeId: 's1', ...over,
  }
  db.orders.push(o); return o
}

/** A bag issued for an order, as the pickup engine would leave it. */
function issue(bag: Row, order: Row) {
  bag.currentOrderId = order.id; bag.currentOrderNumber = order.orderNumber
  bag.currentCustomerId = order.customerId; bag.status = BAG_STATUS.OUT_FOR_DELIVERY
  order.deliveryBagNumber = bag.bagNumber
  db.usages.push({
    id: id('usage'), bagId: bag.id, businessId: LB, orderId: order.id, orderNumber: order.orderNumber,
    customerId: order.customerId, status: 'ASSIGNED', assignedAt: new Date(), returnStatus: null,
    conditionAtReturn: null, deliveredDate: null,
  })
}

const bagRow = (bagId: string) => db.bags.find((b) => b.id === bagId)!

beforeEach(() => {
  db.bags.length = 0; db.usages.length = 0; db.events.length = 0
  db.orders.length = 0; db.customers.length = 0
  db.customers.push({ id: 'cusA', name: 'Customer A' }, { id: 'cusB', name: 'Customer B' })
  vi.clearAllMocks()
})

// ── Test 1 / 13 ──────────────────────────────────────────────────────────────
describe('Test 1 & 13 — delivery hands the bag over and still succeeds', () => {
  it('moves the bag to HANDED_TO_CUSTOMER with the customer as custodian', async () => {
    const bag = makeBag(), order = makeOrder(); issue(bag, order)
    const r = await applyDeliveryDisposition({ lbId: LB, orderId: order.id as string })
    expect(r.ok).toBe(true)
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(b.currentCustodianType).toBe(CUSTODIAN.CUSTOMER)
    expect(b.currentCustomerId).toBe('cusA')
    expect(b.handedToCustomerAt).toBeInstanceOf(Date)
  })

  it('handing over is the DEFAULT — no disposition supplied still works', async () => {
    expect(DEFAULT_DISPOSITION).toBe(DISPOSITION.HANDED_TO_CUSTOMER)
    const bag = makeBag(), order = makeOrder(); issue(bag, order)
    await applyDeliveryDisposition({ lbId: LB, orderId: order.id as string })
    expect(bagRow(bag.id as string).status).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
  })

  // Rule 1: the bag must NOT come back to stock just because the order finished.
  it('does NOT return the bag to AVAILABLE on delivery', async () => {
    const bag = makeBag(), order = makeOrder(); issue(bag, order)
    await applyDeliveryDisposition({ lbId: LB, orderId: order.id as string })
    expect(bagRow(bag.id as string).status).not.toBe(BAG_STATUS.AVAILABLE)
  })

  it('an order with no bag is still a successful delivery', async () => {
    const order = makeOrder({ deliveryBagNumber: null })
    const r = await applyDeliveryDisposition({ lbId: LB, orderId: order.id as string })
    expect(r.ok).toBe(true)
    expect(r.ok && r.disposition).toBe(DISPOSITION.NO_BAG_DELIVERED)
  })

  it('an unregistered delivery bag code does not fail the delivery', async () => {
    const order = makeOrder({ deliveryBagNumber: 'SOME-RANDOM-CODE' })
    const r = await applyDeliveryDisposition({ lbId: LB, orderId: order.id as string })
    expect(r.ok).toBe(true)
  })
})

// ── Test 2 / Rule 3 / Rule 11 ────────────────────────────────────────────────
describe('Test 2 — customer keeps the bag; the next pickup just uses a new one', () => {
  it('leaves the old bag with the customer and never marks it lost', async () => {
    const old = makeBag(), o1 = makeOrder(); issue(old, o1)
    await applyDeliveryDisposition({ lbId: LB, orderId: o1.id as string })

    // A brand-new bag is issued for the next order. Nothing touches the old one.
    const fresh = makeBag(), o2 = makeOrder(); issue(fresh, o2)
    await applyDeliveryDisposition({ lbId: LB, orderId: o2.id as string })

    const b = bagRow(old.id as string)
    expect(b.status).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(b.status).not.toBe(BAG_STATUS.LOST)
    expect(b.currentCustodianType).toBe(CUSTODIAN.CUSTOMER)
  })
})

// ── Test 3 / 11 / 12 ─────────────────────────────────────────────────────────
describe('Test 3, 11 & 12 — the same physical bag returns and is reused', () => {
  it('identifies the returning bag as the same customer’s', async () => {
    const bag = makeBag(), o1 = makeOrder(); issue(bag, o1)
    await applyDeliveryDisposition({ lbId: LB, orderId: o1.id as string })

    const r = await identifyReturnedBag({ lbId: LB, code: bag.bagNumber as string, customerId: 'cusA' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bag.sameCustomer).toBe(true)
    expect(r.bag.requiresAuthorization).toBe(false)
    expect(r.bag.wasWithCustomer).toBe(true)
    expect(r.bag.previousOrderNumber).toBe(o1.orderNumber)
    expect(r.bag.reusable).toBe(true)
  })

  it('reuses ONE identity across many orders and keeps every usage row', async () => {
    const bag = makeBag()
    for (let i = 0; i < 3; i++) {
      const o = makeOrder(); issue(bag, o)
      await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
      await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD, customerId: 'cusA' })
    }
    // Rule 5: still one bag. Rule 6/7: three intact usage rows.
    expect(db.bags.filter((b) => b.bagNumber === bag.bagNumber)).toHaveLength(1)
    const usages = db.usages.filter((u) => u.bagId === bag.id)
    expect(usages).toHaveLength(3)
    expect(usages.every((u) => u.status === 'RETURNED')).toBe(true)
    expect(new Set(usages.map((u) => u.orderId)).size).toBe(3)
  })

  it('a returned GOOD bag becomes AVAILABLE again', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    const r = await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD })
    expect(r.ok).toBe(true)
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.AVAILABLE)
    expect(b.currentCustomerId).toBeNull()
    expect(b.handedToCustomerAt).toBeNull()
  })
})

// ── Test 4 ───────────────────────────────────────────────────────────────────
describe('Test 4 — the bag comes back several orders later', () => {
  it('is still recognised as that customer’s bag', async () => {
    const kept = makeBag(), first = makeOrder(); issue(kept, first)
    await applyDeliveryDisposition({ lbId: LB, orderId: first.id as string })
    // Two more orders pass on entirely different bags.
    for (let i = 0; i < 2; i++) {
      const b = makeBag(), o = makeOrder(); issue(b, o)
      await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    }
    const r = await identifyReturnedBag({ lbId: LB, code: kept.bagNumber as string, customerId: 'cusA' })
    expect(r.ok && r.bag.sameCustomer).toBe(true)
    expect(r.ok && r.bag.previousOrderNumber).toBe(first.orderNumber)
  })
})

// ── Test 5 ───────────────────────────────────────────────────────────────────
describe('Test 5 — a customer returns several bags at once', () => {
  it('validates and receives each bag independently', async () => {
    const bags = [makeBag(), makeBag(), makeBag()]
    for (const b of bags) { const o = makeOrder(); issue(b, o); await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string }) }
    expect((await getBagsWithCustomer(LB, 'cusA'))).toHaveLength(3)

    const results = await Promise.all(bags.map((b) =>
      receiveReturnedBag({ lbId: LB, bagId: b.id as string, condition: BAG_CONDITION.GOOD, customerId: 'cusA' })))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(bags.every((b) => bagRow(b.id as string).status === BAG_STATUS.AVAILABLE)).toBe(true)
    expect((await getBagsWithCustomer(LB, 'cusA'))).toHaveLength(0)
  })
})

// ── Test 6 / Rule 8 / Rule 9 ─────────────────────────────────────────────────
describe('Test 6 — a damaged bag never slips back into circulation', () => {
  it('maps every condition to the right resting state', () => {
    expect(conditionToStatus(BAG_CONDITION.GOOD)).toBe(BAG_STATUS.AVAILABLE)
    expect(conditionToStatus(BAG_CONDITION.MINOR_DAMAGE)).toBe(BAG_STATUS.INSPECTION_REQUIRED)
    expect(conditionToStatus(BAG_CONDITION.DAMAGED)).toBe(BAG_STATUS.DAMAGED)
    expect(conditionToStatus(BAG_CONDITION.HEAVILY_DAMAGED)).toBe(BAG_STATUS.DAMAGED)
    expect(conditionToStatus(BAG_CONDITION.UNUSABLE)).toBe(BAG_STATUS.RETIRED)
  })

  it('records the condition and keeps a damaged bag out of stock', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.DAMAGED })
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.DAMAGED)
    expect(b.condition).toBe(BAG_CONDITION.DAMAGED)
    expect(b.status).not.toBe(BAG_STATUS.AVAILABLE)
    // The condition is written onto the usage row it closes.
    expect(db.usages.find((u) => u.bagId === bag.id)!.conditionAtReturn).toBe(BAG_CONDITION.DAMAGED)
  })

  it('minor damage waits for inspection rather than going straight back', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.MINOR_DAMAGE })
    expect(bagRow(bag.id as string).status).toBe(BAG_STATUS.INSPECTION_REQUIRED)
  })

  it('a damaged bag is refused for reuse until it is dealt with', async () => {
    const bag = makeBag({ status: BAG_STATUS.DAMAGED })
    const r = await identifyReturnedBag({ lbId: LB, code: bag.bagNumber as string })
    expect(r.ok && r.bag.reusable).toBe(false)
    expect(r.ok && r.bag.blockedReason).toMatch(/Damaged/i)
  })
})

// ── Test 7 ───────────────────────────────────────────────────────────────────
describe('Test 7 — the QR is unreadable', () => {
  it('flags the QR without creating a second record for the same bag', async () => {
    const bag = makeBag()
    const before = db.bags.length
    const r = await markQrDamaged({ lbId: LB, bagId: bag.id as string })
    expect(r.ok).toBe(true)
    expect(db.bags).toHaveLength(before) // identity preserved, no duplicate
    expect(bagRow(bag.id as string).qrDamaged).toBe(true)
  })

  it('the bag is still findable by its printed code', async () => {
    const bag = makeBag({ qrDamaged: true })
    const r = await identifyReturnedBag({ lbId: LB, code: bag.bagNumber as string })
    expect(r.ok).toBe(true)
    expect(r.ok && r.bag.qrDamaged).toBe(true)
    expect(r.ok && r.bag.reusable).toBe(true)
  })
})

// ── Test 8 / Rule 10 ─────────────────────────────────────────────────────────
describe('Test 8 — the bag belongs to another customer', () => {
  it('flags it and refuses reuse without authorisation', async () => {
    const bag = makeBag(), o = makeOrder({ customerId: 'cusA' }); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })

    const seen = await identifyReturnedBag({ lbId: LB, code: bag.bagNumber as string, customerId: 'cusB' })
    expect(seen.ok && seen.bag.sameCustomer).toBe(false)
    expect(seen.ok && seen.bag.requiresAuthorization).toBe(true)
    expect(seen.ok && seen.bag.previousCustomerName).toBe('Customer A')

    const blocked = await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD, customerId: 'cusB' })
    expect(blocked.ok).toBe(false)
    expect(!blocked.ok && blocked.code).toBe('AUTHORIZATION_REQUIRED')
    // Nothing moved on a refusal.
    expect(bagRow(bag.id as string).status).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
  })

  it('accepts it once staff authorise, and records who did', async () => {
    const bag = makeBag(), o = makeOrder({ customerId: 'cusA' }); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    const r = await receiveReturnedBag({
      lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD,
      customerId: 'cusB', authorizedBy: 'Store Manager',
    })
    expect(r.ok).toBe(true)
    const evt = db.events.filter((e) => e.bagId === bag.id).pop()!
    expect(String(evt.reason)).toMatch(/Store Manager/)
    // Rule 7 — the original usage still names the original customer.
    expect(db.usages.find((u) => u.bagId === bag.id)!.customerId).toBe('cusA')
  })
})

// ── Test 9 / 10 / Rule 11 ────────────────────────────────────────────────────
describe('Test 9 & 10 — lost and retired are deliberate acts', () => {
  it('marks a bag lost only when a person says so', async () => {
    const bag = makeBag({ status: BAG_STATUS.HANDED_TO_CUSTOMER, currentCustodianType: CUSTODIAN.CUSTOMER, currentCustomerId: 'cusA' })
    const r = await setTerminalState({ lbId: LB, bagId: bag.id as string, state: 'LOST', reason: 'Customer reported lost' })
    expect(r.ok).toBe(true)
    expect(bagRow(bag.id as string).status).toBe(BAG_STATUS.LOST)
    const evt = db.events.pop()!
    expect(evt.previousStatus).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(evt.reason).toBe('Customer reported lost')
  })

  it('retiring deactivates the bag', async () => {
    const bag = makeBag()
    await setTerminalState({ lbId: LB, bagId: bag.id as string, state: 'RETIRED', reason: 'Torn beyond repair' })
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.RETIRED)
    expect(b.active).toBe(false)
  })

  it('a retired bag can never be returned to service', async () => {
    const bag = makeBag({ status: BAG_STATUS.RETIRED })
    const r = await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD })
    expect(r.ok).toBe(false)
  })
})

// ── Test 14 ──────────────────────────────────────────────────────────────────
describe('Test 14 — inventory separates customer-held from available', () => {
  it('never counts a customer-held bag as available', () => {
    const inv = tallyInventory([
      { status: BAG_STATUS.AVAILABLE, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.HANDED_TO_CUSTOMER, currentCustodianType: CUSTODIAN.CUSTOMER },
      { status: BAG_STATUS.HANDED_TO_CUSTOMER, currentCustodianType: CUSTODIAN.CUSTOMER },
    ])
    expect(inv.available).toBe(1)
    expect(inv.withCustomers).toBe(2)
  })

  it('every bag lands in exactly one bucket, so the numbers reconcile', () => {
    const bags = [
      { status: BAG_STATUS.AVAILABLE, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.COLLECTED, currentCustodianType: CUSTODIAN.DELIVERY_EXECUTIVE },
      { status: BAG_STATUS.RECEIVED_AT_STORE, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.PROCESSING, currentCustodianType: CUSTODIAN.PROCESSING_CENTER },
      { status: BAG_STATUS.OUT_FOR_DELIVERY, currentCustodianType: CUSTODIAN.DELIVERY_EXECUTIVE },
      { status: BAG_STATUS.HANDED_TO_CUSTOMER, currentCustodianType: CUSTODIAN.CUSTOMER },
      { status: BAG_STATUS.INSPECTION_REQUIRED, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.DAMAGED, currentCustodianType: CUSTODIAN.STORE },
      { status: BAG_STATUS.LOST, currentCustodianType: CUSTODIAN.CUSTOMER },
      { status: BAG_STATUS.RETIRED, currentCustodianType: CUSTODIAN.STORE },
    ]
    const inv = tallyInventory(bags)
    const { total, ...buckets } = inv
    expect(total).toBe(bags.length)
    expect(Object.values(buckets).reduce((a, b) => a + b, 0)).toBe(total)
    expect(inv).toMatchObject({
      available: 1, withExecutives: 1, atStore: 1, atProcessingCenter: 1,
      outForDelivery: 1, withCustomers: 1, inspectionRequired: 1, damaged: 1, lost: 1, retired: 1,
    })
  })

  it('an unknown legacy status still reconciles rather than vanishing', () => {
    const inv = tallyInventory([{ status: 'CLEANING', currentCustodianType: CUSTODIAN.STORE }])
    const { total, ...buckets } = inv
    expect(Object.values(buckets).reduce((a, b) => a + b, 0)).toBe(total)
    expect(bucketFor({ status: 'CLEANING', currentCustodianType: CUSTODIAN.STORE })).toBe('atStore')
  })
})

// ── Test 15 ──────────────────────────────────────────────────────────────────
describe('Test 15 — concurrency cannot double-receive a bag', () => {
  it('only one of two simultaneous returns wins', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })

    const [a, b] = await Promise.all([
      receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD }),
      receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD }),
    ])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    const loser = [a, b].find((r) => !r.ok)!
    expect(!loser.ok && loser.code).toBe('CONCURRENT_RETURN')
    expect(bagRow(bag.id as string).totalUsageCount).toBe(1) // counted once
  })
})

// ── §12 / §20 audit ──────────────────────────────────────────────────────────
describe('§12 & §20 — every movement is recorded and nothing is overwritten', () => {
  it('writes an append-only trail with before/after status and custodian', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string, actor: { id: 'e1', name: 'Exec', role: 'DELIVERY_EXECUTIVE' } })
    await receiveReturnedBag({ lbId: LB, bagId: bag.id as string, condition: BAG_CONDITION.GOOD, actor: { name: 'Store staff', role: 'STORE' } })

    const events = db.events.filter((e) => e.bagId === bag.id)
    expect(events).toHaveLength(2)
    const [handed, returned] = events
    expect(handed.action).toBe(DISPOSITION.HANDED_TO_CUSTOMER)
    expect(handed.newStatus).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(handed.newCustodianType).toBe(CUSTODIAN.CUSTOMER)
    expect(handed.actorName).toBe('Exec')
    expect(returned.previousStatus).toBe(BAG_STATUS.HANDED_TO_CUSTOMER)
    expect(returned.newStatus).toBe(BAG_STATUS.AVAILABLE)
    expect(returned.condition).toBe(BAG_CONDITION.GOOD)
  })

  it('history returns both the usage rows and the movement log', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string })
    const h = await getBagHistory(LB, bag.id as string)
    expect(h.usages.length).toBeGreaterThan(0)
    expect(h.events.length).toBeGreaterThan(0)
  })
})

// ── §5 other dispositions ────────────────────────────────────────────────────
describe('§5 — the other delivery dispositions', () => {
  it('RETURNED_TO_EXECUTIVE keeps the bag with the executive, not the customer', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string, disposition: DISPOSITION.RETURNED_TO_EXECUTIVE, actor: { id: 'e1', name: 'Exec' } })
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.RETURNED_BY_CUSTOMER)
    expect(b.currentCustodianType).toBe(CUSTODIAN.DELIVERY_EXECUTIVE)
    expect(b.handedToCustomerAt).toBeNull()
  })

  it('DAMAGED at the door quarantines the bag', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string, disposition: DISPOSITION.DAMAGED })
    expect(bagRow(bag.id as string).status).toBe(BAG_STATUS.DAMAGED)
  })

  it('LOST keeps the customer as the last known holder', async () => {
    const bag = makeBag(), o = makeOrder(); issue(bag, o)
    await applyDeliveryDisposition({ lbId: LB, orderId: o.id as string, disposition: DISPOSITION.LOST })
    const b = bagRow(bag.id as string)
    expect(b.status).toBe(BAG_STATUS.LOST)
    expect(b.currentCustodianType).toBe(CUSTODIAN.CUSTOMER)
  })
})
