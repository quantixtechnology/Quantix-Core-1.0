import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// DELIVERY BAG SCAN EXCEPTION.
//
// A bag scan must be TRACKED, but a bag scan must never STRAND a delivery. An
// executive standing at a customer's door with a torn QR label, or a counter
// handing over a bag that is simply not there, has to be able to finish the job.
//
// So a bag is ACCOUNTED FOR when it is either
//   1. scanned and confirmed, or
//   2. explicitly recorded as a scan exception, with a reason and an actor.
//
// This is NOT a bypass. The client cannot declare a bag done, cannot name a bag
// that is not on the order, cannot invent a reason, and cannot say "Other" and
// leave it at that. Every path writes a permanent event, and the gate re-reads
// that event from the database.
//
// The bag itself is untouched by an exception: it keeps its assignment, its
// custody and its place in the order, and it moves with every other bag when
// the delivery completes.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    assignments: [] as { id: string; bagId: string; businessId: string; orderId: string; status: string; assignedAt: Date }[],
    bags: [] as { id: string; bagNumber: string; qrValue: string; status: string; currentCustodianType: string; businessId: string }[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: [] as any[],
    order: null as null | { id: string; orderNumber: string; customerId: string | null; storeId: string | null; businessId: string },
    assignmentWrites: 0,
    bagWrites: 0,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionMatches = (w: any, action: string) =>
    w.action === undefined ? true : typeof w.action === 'string' ? w.action === action : (w.action.in ?? []).includes(action)
  return {
    state,
    prisma: {
      // The delivery engine now reads each service's own bag requirement.
      // Default [] = no booked services, which must fall back to the
      // every-bag rule rather than blocking (see `applicable`).
      laundryOrderService: { findMany: vi.fn().mockResolvedValue([]) },
      laundryBagAssignment: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.assignments
          .filter((r) => r.businessId === a.where.businessId && r.orderId === a.where.orderId)
          .sort((x, y) => x.assignedAt.getTime() - y.assignedAt.getTime())
          .map((r) => ({ ...r, bag: state.bags.find((b) => b.id === r.bagId) ?? null }))),
        count: vi.fn(async () => state.assignments.length),
        update: vi.fn(async () => { state.assignmentWrites++; return {} }),
        updateMany: vi.fn(async () => { state.assignmentWrites++; return {} }),
        create: vi.fn(async () => { state.assignmentWrites++; return {} }),
      },
      laundryBag: {
        update: vi.fn(async () => { state.bagWrites++; return {} }),
        updateMany: vi.fn(async () => { state.bagWrites++; return {} }),
        findMany: vi.fn(async () => state.bags),
      },
      laundryBagEvent: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.events
          .filter((e) => e.businessId === a.where.businessId && e.orderId === a.where.orderId && actionMatches(a.where, e.action))
          .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: vi.fn(async (a: any) => {
          const row = { ...a.data, createdAt: new Date(Date.now() + state.events.length) }
          state.events.push(row); return row
        }),
      },
      laundryOrder: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findFirst: vi.fn(async (a: any) => (state.order && state.order.id === a.where.id && state.order.businessId === a.where.businessId ? state.order : null)),
      },
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-bag-assign', () => ({ assignBagToOrder: vi.fn() }))

import {
  deliveryBags, confirmDeliveryBag, recordDeliveryBagException, deliveryBagGate,
  DELIVERY_BAG_CONFIRMED, DELIVERY_BAG_EXCEPTION, EXCEPTION_REASONS, EXCEPTION_REASON_CODES,
  isExceptionReason, parseExceptionReason,
} from '@/lib/laundry-delivery-bags'
import { orderBags } from '@/lib/laundry-order-bags'

const { state } = H
const LB = 'lb_vs'
const ORDER = 'ord-1'
const EXEC = { id: 'exec-9', name: 'Ravi', role: 'DELIVERY_EXECUTIVE' }

const seed = (n: number) => {
  state.bags = Array.from({ length: n }, (_, i) => ({
    id: `bag-${i + 2}`, bagNumber: `V8BAG00${i + 2}`, qrValue: `V8BAG00${i + 2}`,
    status: 'READY_FOR_DELIVERY', currentCustodianType: 'DELIVERY_EXECUTIVE', businessId: LB,
  }))
  state.assignments = state.bags.map((b, i) => ({
    id: `asg-${i + 1}`, bagId: b.id, businessId: LB, orderId: ORDER, status: 'ASSIGNED',
    assignedAt: new Date(Date.now() + i * 1000),
  }))
}

const scan = (code: string) => confirmDeliveryBag({ lbId: LB, orderId: ORDER, code, actor: EXEC })
const except = (code: string, reason: unknown, note?: unknown) =>
  recordDeliveryBagException({ lbId: LB, orderId: ORDER, code, reason, note, actor: EXEC })

beforeEach(() => {
  state.assignments = []; state.bags = []; state.events = []
  state.assignmentWrites = 0; state.bagWrites = 0
  state.order = { id: ORDER, orderNumber: 'V8ORD100', customerId: 'cust-1', storeId: 'store-1', businessId: LB }
  vi.clearAllMocks()
})

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// ── 1-5: the gate arithmetic ────────────────────────────────────────────────
describe('scanned OR excepted — the completion arithmetic', () => {
  it('1. 3/3 scanned → delivery allowed', async () => {
    seed(3)
    for (const b of state.bags) await scan(b.bagNumber)
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.exceptions, v.accounted, v.total]).toEqual([3, 0, 3, 3])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('2. 2/3 scanned + 0 exceptions → delivery BLOCKED', async () => {
    seed(3)
    await scan('V8BAG002'); await scan('V8BAG003')
    const v = await deliveryBags(LB, ORDER)
    expect(v.accounted).toBe(2)
    expect(v.complete).toBe(false)
    const block = await deliveryBagGate(LB, ORDER)
    expect(block).toContain('2 of 3 bags scanned')
    // The block must say what to DO about it — both ways out, not just "scan".
    expect(block).toContain('scan exception')
  })

  it('3. 2/3 scanned + 1 exception → delivery ALLOWED', async () => {
    seed(3)
    await scan('V8BAG002'); await scan('V8BAG003')
    expect(await deliveryBagGate(LB, ORDER)).not.toBeNull()
    const r = await except('V8BAG004', 'QR_UNREADABLE')
    expect(r.ok).toBe(true)
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.exceptions, v.accounted]).toEqual([2, 1, 3])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('4. 1/3 scanned + 2 exceptions → delivery ALLOWED', async () => {
    seed(3)
    await scan('V8BAG002')
    await except('V8BAG003', 'BAG_UNAVAILABLE')
    await except('V8BAG004', 'QR_UNREADABLE')
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.exceptions, v.accounted]).toEqual([1, 2, 3])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('5. 0/3 scanned + 3 exceptions → delivery ALLOWED', async () => {
    seed(3)
    for (const b of state.bags) await except(b.bagNumber, 'QR_UNREADABLE')
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.exceptions, v.accounted]).toEqual([0, 3, 3])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
    // …and it is visible that nothing was actually scanned.
    expect(v.summary).toBe('0 of 3 bags scanned · 3 exceptions')
  })

  it('the summary counts scans and exceptions separately — "2 of 3 bags scanned · 1 exception"', async () => {
    seed(3)
    await scan('V8BAG002'); await scan('V8BAG003'); await except('V8BAG004', 'OTHER', 'label soaked through')
    expect((await deliveryBags(LB, ORDER)).summary).toBe('2 of 3 bags scanned · 1 exception')
  })
})

// ── 6-8: the exception cannot be forged ─────────────────────────────────────
describe('an exception must be earned, not asserted', () => {
  it('6. an exception requires a valid reason', async () => {
    seed(2)
    for (const bad of [undefined, null, '', 'BECAUSE', 'qr_unreadable', 1, true, { code: 'OTHER' }]) {
      const r = await except('V8BAG002', bad)
      expect(r.ok, `reason ${JSON.stringify(bad)} must be refused`).toBe(false)
      if (!r.ok) expect(r.status).toBe(400)
    }
    // Nothing was written, and the bag is still outstanding.
    expect(state.events).toHaveLength(0)
    expect((await deliveryBags(LB, ORDER)).accounted).toBe(0)
  })

  it('6b. the accepted reasons are exactly the three published codes', () => {
    expect(EXCEPTION_REASON_CODES.sort()).toEqual(['BAG_UNAVAILABLE', 'OTHER', 'QR_UNREADABLE'])
    expect(EXCEPTION_REASONS.QR_UNREADABLE).toBe('QR damaged / unreadable')
    expect(EXCEPTION_REASONS.BAG_UNAVAILABLE).toBe('Bag not available')
    expect(isExceptionReason('QR_UNREADABLE')).toBe(true)
    expect(isExceptionReason('constructor')).toBe(false)   // no prototype leakage
    expect(isExceptionReason('toString')).toBe(false)
  })

  it('7. "Other" requires a note', async () => {
    seed(2)
    for (const blank of [undefined, null, '', '   ']) {
      const r = await except('V8BAG002', 'OTHER', blank)
      expect(r.ok).toBe(false)
      if (!r.ok) { expect(r.status).toBe(400); expect(r.error).toMatch(/note/i) }
    }
    expect(state.events).toHaveLength(0)

    const ok = await except('V8BAG002', 'OTHER', '  customer had already emptied it  ')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.note).toBe('customer had already emptied it')   // trimmed
    // The other two reasons stand alone — a note is optional there.
    expect((await except('V8BAG003', 'BAG_UNAVAILABLE')).ok).toBe(true)
  })

  it('8. a client cannot invent an exception for a bag that is not on the order', async () => {
    seed(2)
    for (const foreign of ['V8BAG999', 'OTHER-TENANT-BAG', 'not-a-bag']) {
      const r = await except(foreign, 'QR_UNREADABLE')
      expect(r.ok).toBe(false)
      if (!r.ok) { expect(r.status).toBe(409); expect(r.error).toContain('does not belong to this order') }
    }
    expect(state.events).toHaveLength(0)
    expect((await deliveryBags(LB, ORDER)).accounted).toBe(0)
    expect(await deliveryBagGate(LB, ORDER)).not.toBeNull()
  })

  it('8b. there is no generic bypass — neither route accepts a "skip"/"confirmed" flag', () => {
    const EXEC_ROUTE = read('src/app/api/laundry/executive/jobs/[id]/delivery-bags/route.ts')
    const ADMIN_ROUTE = read('src/app/api/laundry/orders/[id]/delivery-bags/route.ts')
    const DELIVER = read('src/app/api/laundry/executive/jobs/[id]/deliver/route.ts')
    const ADMIN_DELIVER = read('src/app/api/laundry/orders/[id]/deliver/route.ts')
    for (const src of [EXEC_ROUTE, ADMIN_ROUTE, DELIVER, ADMIN_DELIVER]) {
      expect(src).not.toMatch(/b\.(skipBags|bypassBags|forceDeliver|bagsConfirmed|ignoreBags)/)
      expect(src).not.toMatch(/skipBagGate|force\s*\?\s*null/)
    }
    // The deliver routes consult the gate and cannot be told not to.
    expect(DELIVER).toContain('deliveryBagGate(')
    expect(ADMIN_DELIVER).toContain('deliveryBagGate(')
    // The exception route hands the reason to the DOMAIN for validation rather
    // than deciding anything itself.
    for (const src of [EXEC_ROUTE, ADMIN_ROUTE]) {
      expect(src).toContain('recordDeliveryBagException(')
      expect(src).toContain('reason: b.reason')
    }
  })

  it('8c. the exception is recorded by the server, and the response is the server view', async () => {
    seed(2)
    const r = await except('V8BAG002', 'QR_UNREADABLE')
    expect(r.ok).toBe(true)
    // The caller is told the SERVER's count, not its own.
    if (r.ok) expect([r.accounted, r.total, r.complete]).toEqual([1, 2, false])
    // A second identical request is idempotent — one event, not two.
    const again = await except('V8BAG002', 'BAG_UNAVAILABLE')
    expect(again.ok).toBe(true)
    if (again.ok) { expect(again.alreadyExcepted).toBe(true); expect(again.reason).toBe('QR_UNREADABLE') }
    expect(state.events.filter((e) => e.action === DELIVERY_BAG_EXCEPTION)).toHaveLength(1)
  })
})

// ── 9: the wrong bag stays wrong ────────────────────────────────────────────
describe('a wrong bag cannot become a successful scan', () => {
  it('9. scanning a bag from another order is refused by name and accounts for nothing', async () => {
    seed(3)
    const r = await scan('V8BAG777')
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.status).toBe(409); expect(r.error).toBe('Bag V8BAG777 does not belong to this order.') }
    expect(state.events).toHaveLength(0)
    expect((await deliveryBags(LB, ORDER)).accounted).toBe(0)
  })

  it('9b. an exception cannot be re-labelled as a scan', async () => {
    seed(2)
    await except('V8BAG002', 'QR_UNREADABLE')
    const v = await deliveryBags(LB, ORDER)
    const row = v.bags.find((b) => b.bagNumber === 'V8BAG002')!
    expect(row.confirmed).toBe(false)          // it was never scanned
    expect(row.accounted).toBe(true)           // but it IS accounted for
    expect(v.confirmed).toBe(0)
    expect(v.exceptions).toBe(1)
  })

  it('9c. a bag that is later actually scanned stops reading as a failure', async () => {
    seed(2)
    await except('V8BAG002', 'QR_UNREADABLE')
    expect((await scan('V8BAG002')).ok).toBe(true)
    const row = (await deliveryBags(LB, ORDER)).bags.find((b) => b.bagNumber === 'V8BAG002')!
    expect(row.confirmed).toBe(true)
    expect(row.exception).toBeNull()
    // The exception EVENT is still in history — the audit is append-only.
    expect(state.events.filter((e) => e.action === DELIVERY_BAG_EXCEPTION)).toHaveLength(1)
  })

  it('9d. an already-scanned bag cannot be given an exception', async () => {
    seed(2)
    await scan('V8BAG002')
    const r = await except('V8BAG002', 'QR_UNREADABLE')
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.status).toBe(409); expect(r.error).toContain('already scanned') }
    expect(state.events.filter((e) => e.action === DELIVERY_BAG_EXCEPTION)).toHaveLength(0)
  })
})

// ── 10: the audit trail ─────────────────────────────────────────────────────
describe('the exception is audited', () => {
  it('10. records bag, order, executive, reason, note and timestamp', async () => {
    seed(2)
    await except('V8BAG002', 'OTHER', 'label soaked in the rain')
    const e = state.events.find((x) => x.action === DELIVERY_BAG_EXCEPTION)!
    expect(e.bagId).toBe('bag-2')
    expect(e.bagNumber).toBe('V8BAG002')
    expect(e.businessId).toBe(LB)
    expect(e.orderId).toBe(ORDER)
    expect(e.orderNumber).toBe('V8ORD100')
    expect(e.customerId).toBe('cust-1')
    expect(e.actorId).toBe('exec-9')
    expect(e.actorName).toBe('Ravi')
    expect(e.actorRole).toBe('DELIVERY_EXECUTIVE')
    expect(e.reason).toBe('OTHER: label soaked in the rain')
    expect(e.createdAt).toBeInstanceOf(Date)
    // The action is its own name — greppable in bag history, never confused
    // with a successful scan.
    expect(DELIVERY_BAG_EXCEPTION).toBe('DELIVERY_BAG_SCAN_EXCEPTION')
    expect(DELIVERY_BAG_EXCEPTION).not.toBe(DELIVERY_BAG_CONFIRMED)
  })

  it('10b. the reason reads back with its label, note, actor and time', async () => {
    seed(2)
    await except('V8BAG002', 'OTHER', 'bag left at reception')
    await except('V8BAG003', 'BAG_UNAVAILABLE')
    const v = await deliveryBags(LB, ORDER)
    const a = v.bags[0].exception!
    expect(a.code).toBe('OTHER')
    expect(a.label).toBe('Other')
    expect(a.note).toBe('bag left at reception')
    expect(a.byId).toBe('exec-9')
    expect(a.byName).toBe('Ravi')
    expect(a.at).toBeInstanceOf(Date)
    const b = v.bags[1].exception!
    expect([b.code, b.label, b.note]).toEqual(['BAG_UNAVAILABLE', 'Bag not available', null])
  })

  it('10c. a note is capped, and an unrecognised historical reason degrades to Other rather than going blank', async () => {
    seed(1)
    await except('V8BAG002', 'OTHER', 'x'.repeat(500))
    expect(state.events[0].reason.length).toBeLessThanOrEqual('OTHER: '.length + 300)
    const legacy = parseExceptionReason('bag was wet', new Date(), null, null)
    expect(legacy.code).toBe('OTHER')
    expect(legacy.note).toBe('bag was wet')
  })
})

// ── 11-12: the bag is not disturbed ─────────────────────────────────────────
describe('an exception does not touch the bag', () => {
  it('11. the bag stays associated with the order', async () => {
    seed(3)
    await except('V8BAG003', 'QR_UNREADABLE')
    const bags = await orderBags(LB, ORDER)
    expect(bags.map((b) => b.bagNumber)).toEqual(['V8BAG002', 'V8BAG003', 'V8BAG004'])
    const still = bags.find((b) => b.bagNumber === 'V8BAG003')!
    expect(still.open).toBe(true)
    expect(still.index).toBe(2)
    // No assignment was closed, moved or deleted.
    expect(state.assignmentWrites).toBe(0)
    expect(state.assignments).toHaveLength(3)
  })

  it('12. custody and status are untouched — the bag is NOT quietly released', async () => {
    seed(2)
    await except('V8BAG002', 'BAG_UNAVAILABLE')
    expect(state.bagWrites).toBe(0)
    expect(state.bags[0].status).toBe('READY_FOR_DELIVERY')
    expect(state.bags[0].currentCustodianType).toBe('DELIVERY_EXECUTIVE')
    // The event records no status/custodian transition of its own.
    const e = state.events[0]
    expect(e.newStatus ?? null).toBeNull()
    expect(e.newCustodianType ?? null).toBeNull()
    const row = (await deliveryBags(LB, ORDER)).bags[0]
    expect(row.status).toBe('READY_FOR_DELIVERY')
    expect(row.custodian).toBe('DELIVERY_EXECUTIVE')
  })

  it('12b. disposition at completion still covers EVERY bag of the order, scanned or not', () => {
    const LIFECYCLE = read('src/lib/laundry-bag-lifecycle.ts')
    const body = LIFECYCLE.slice(LIFECYCLE.indexOf('export async function applyDeliveryDisposition'))
    // It resolves the bag set from the ASSIGNMENTS…
    expect(body).toContain('laundryBagAssignment.findMany')
    expect(body).toContain('for (const bag of bags)')
    // …and never filters that set on a scan or an exception, so an excepted bag
    // gets exactly the same custody outcome as a scanned one.
    const upToLoop = body.slice(0, body.indexOf('for (const bag of bags)'))
    expect(upToLoop).not.toContain('DELIVERY_BAG_CONFIRMED')
    expect(upToLoop).not.toContain('DELIVERY_BAG_SCAN_EXCEPTION')
    expect(upToLoop).not.toContain('laundryBagEvent')
  })
})

// ── 13-15: nothing else moved ───────────────────────────────────────────────
describe('everything around it is unchanged', () => {
  it('13. an existing one-bag delivery still works', async () => {
    seed(1)
    expect(await deliveryBagGate(LB, ORDER)).not.toBeNull()
    await scan('V8BAG002')
    const v = await deliveryBags(LB, ORDER)
    expect([v.confirmed, v.total, v.complete]).toEqual([1, 1, true])
    expect(v.summary).toBe('1 of 1 bags scanned')
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('13b. a legacy order with no assignment rows is not blocked by a bag it never had', async () => {
    state.assignments = []; state.bags = []
    const v = await deliveryBags(LB, ORDER)
    expect([v.total, v.complete]).toEqual([0, true])
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('14. pickup partial return is untouched — it still has no gate at all', async () => {
    const mod = await import('@/lib/laundry-pickup-return')
    expect('pickupReturnGate' in mod).toBe(false)
    const RETURN_SRC = read('src/lib/laundry-pickup-return.ts')
    // No exception machinery leaked into the return path: an unreturned bag
    // needs no excuse, it simply stays with the customer.
    expect(RETURN_SRC).not.toContain('DELIVERY_BAG_SCAN_EXCEPTION')
    expect(RETURN_SRC).not.toContain('EXCEPTION_REASONS')
    const RETURN_ROUTE = read('src/app/api/laundry/executive/jobs/[id]/return-bags/route.ts')
    expect(RETURN_ROUTE).not.toContain('exception')
  })

  it('15. OTP behaviour is unchanged — the bag gate still runs BEFORE verification', () => {
    for (const p of ['src/app/api/laundry/orders/[id]/deliver/route.ts', 'src/app/api/laundry/executive/jobs/[id]/deliver/route.ts']) {
      const src = read(p)
      const gate = src.indexOf('deliveryBagGate(')
      const verify = src.indexOf('verifyDelivery(')
      expect(gate).toBeGreaterThan(-1)
      expect(verify).toBeGreaterThan(-1)
      // Verification CLEARS the OTP on success. Gating after it would burn the
      // customer's code on a delivery that then could not complete.
      expect(gate).toBeLessThan(verify)
    }
    const VERIFY = read('src/lib/laundry-verification.ts')
    expect(VERIFY).not.toContain('deliveryBag')
    expect(VERIFY).not.toContain('EXCEPTION')
  })

  it('15b. Sorting, Packing & QR and payment were not touched by the exception', () => {
    for (const p of ['src/lib/laundry-finishing.ts', 'src/lib/laundry-order-bags.ts']) {
      const src = read(p)
      expect(src).not.toContain('DELIVERY_BAG_SCAN_EXCEPTION')
      expect(src).not.toContain('recordDeliveryBagException')
    }
    // Sorting's multi-bag opt-in is still the only thing that widens assignment.
    expect(read('src/lib/laundry-finishing.ts')).toContain('allowMultiple')
  })

  it('no schema change: the exception rides on columns LaundryBagEvent already has', () => {
    const SCHEMA = read('prisma/schema.prisma')
    const model = SCHEMA.slice(SCHEMA.indexOf('model LaundryBagEvent'))
    const block = model.slice(0, model.indexOf('}'))
    for (const col of ['action', 'reason', 'orderId', 'orderNumber', 'bagId', 'bagNumber', 'actorId', 'actorName', 'createdAt']) {
      expect(block).toContain(col)
    }
    expect(block).not.toContain('deliveryException')
    expect(SCHEMA).not.toContain('model LaundryDeliveryBagException')
  })
})

// ── the operator-facing wiring ──────────────────────────────────────────────
describe('the exception is reachable wherever a delivery completes', () => {
  const LIST = read('src/components/laundry/bag-checklist.tsx')
  const COUNTER = read('src/components/laundry/views/laundry-store-stages.tsx')
  const PWA = read('src/components/laundry/executive/executive-app.tsx')

  it('one checklist component serves the door and the counter', () => {
    expect(PWA).toContain('import { BagChecklist } from "@/components/laundry/bag-checklist"')
    expect(COUNTER).toContain('import { BagChecklist } from "@/components/laundry/bag-checklist"')
    // It is endpoint-driven, so neither caller reimplements the rules.
    expect(LIST).toContain('endpoint: string')
    expect(PWA).toContain('endpoint={`/api/laundry/executive/jobs/${job.id}/delivery-bags`}')
    expect(COUNTER).toContain('endpoint={`/api/laundry/orders/${selected.id}/delivery-bags?businessId=${currentBusinessId}`}')
  })

  it('the counter hand-over is gated on the same accounting and can satisfy it', () => {
    // Before this route existed, /orders/[id]/deliver was gated with no way at
    // the counter to scan or except — a torn label stranded the order.
    expect(COUNTER).toContain('!bagsComplete')
    expect(COUNTER).toContain('account for all bags')
    expect(COUNTER).toContain('onProgress={setBagsComplete}')
  })

  it('the three reasons are offered, and "Other" cannot be submitted empty', () => {
    for (const label of ['QR damaged / unreadable', 'Bag not available', 'Other']) expect(LIST).toContain(label)
    expect(LIST).toContain("disabled={busy || (reason === NEEDS_NOTE && !note.trim())}")
    // The client-side check is a courtesy; the server re-validates both.
    expect(LIST).toContain('{ action: "exception", code: bagNumber, reason, note: note.trim() || undefined }')
  })

  it('only an unaccounted DELIVERY bag can be excepted — never a return bag', () => {
    expect(LIST).toContain('{isGated(kind) && !isAccounted(b) && (')
    expect(LIST).toContain('const isGated = (kind: ChecklistKind) => kind === "delivery"')
    // A return bag that was not handed back needs no excuse.
    expect(LIST).toContain('Still with customer')
  })

  it('a recorded exception stays visible on the bag, with its reason', () => {
    expect(LIST).toContain('Scan Exception')
    expect(LIST).toContain('{b.exception.label}')
    expect(LIST).toContain("{b.exception.note ? ` — ${b.exception.note}` : \"\"}")
  })

  it('the client still never computes progress — the exception POSTs like a scan', () => {
    expect(LIST).toContain('setView(j.data)')
    for (const w of ['confirmed + 1', 'exceptions + 1', 'accounted + 1', 'prev + 1', '++']) expect(LIST, w).not.toContain(w)
    // No local "treat it as done" shortcut.
    expect(LIST).not.toMatch(/accounted:\s*true/)
  })

  it('the counter route carries no new authority — same permission as the delivery it unblocks', () => {
    const ADMIN_ROUTE = read('src/app/api/laundry/orders/[id]/delivery-bags/route.ts')
    const ADMIN_DELIVER = read('src/app/api/laundry/orders/[id]/deliver/route.ts')
    expect(ADMIN_ROUTE).toContain('store_ops.ready_for_delivery.operate')
    expect(ADMIN_DELIVER).toContain('store_ops.ready_for_delivery.operate')
    expect(ADMIN_ROUTE).toContain('requireLaundryPermission(')
    // businessId is resolved through the tenant resolver, never trusted raw.
    expect(ADMIN_ROUTE).toContain('resolveLaundryBusiness(')
    expect(ADMIN_ROUTE).toContain('g.biz.id')
  })

  it('the executive route still only serves the executive the job is assigned to', () => {
    const EXEC_ROUTE = read('src/app/api/laundry/executive/jobs/[id]/delivery-bags/route.ts')
    expect(EXEC_ROUTE).toContain('order.deliveryExecutiveId !== session.executiveId')
    expect(EXEC_ROUTE).toContain('businessId: session.businessId')
    // An exception cannot be recorded after the delivery is already done.
    expect(EXEC_ROUTE).toContain('if (g.order.deliveryCompletedAt)')
  })
})
