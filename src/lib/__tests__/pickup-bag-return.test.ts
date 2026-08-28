import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// CUSTOMER BAG RETURN AT THE NEXT PICKUP.
//
// RETURNING BAGS IS OPTIONAL AND PARTIAL. A customer may hand back all, some,
// one or none of the bags they hold, and THE PICKUP COMPLETES EITHER WAY —
// pickup completion is not bag-return completion. An earlier revision gated the
// pickup on all bags coming back; that rule was reversed and the gate function
// was removed rather than left unused.
//
// A bag is returned ONLY by being scanned; an unscanned bag stays with the
// customer and reappears at their next pickup. Everything is
// derived from state that already exists: getBagsWithCustomer() (status
// HANDED_TO_CUSTOMER, so a returned bag drops out and history never reappears
// as work), receiveReturnedBag() (the lifecycle writer that keeps the bag id),
// and the append-only event log for idempotency. No schema change, no second
// customer-bag relation, no replacement bag ids.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    held: [] as { bagId: string; bagNumber: string; orderId: string | null; orderNumber: string | null; handedOverAt: Date | null }[],
    events: [] as { bagId: string; bagNumber: string; businessId: string; customerId: string | null; orderId: string | null; orderNumber: string | null; action: string; createdAt: Date }[],
    receiveCalls: [] as { bagId: string; condition: string; customerId: string | null }[],
    receiveFails: false,
  }
  return {
    state,
    prisma: {
      laundryBagEvent: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.events.filter((e) =>
          e.businessId === a.where.businessId && e.customerId === a.where.customerId &&
          e.action === a.where.action && e.orderId === a.where.orderId)),
      },
    },
    getBagsWithCustomer: vi.fn(async () => state.held.map((b) => ({ ...b }))),
    receiveReturnedBag: vi.fn(async (i: { bagId: string; condition: string; customerId?: string | null; orderId?: string | null }) => {
      state.receiveCalls.push({ bagId: i.bagId, condition: i.condition, customerId: i.customerId ?? null })
      if (state.receiveFails) return { ok: false as const, status: 500, error: 'lifecycle failed' }
      const bag = state.held.find((b) => b.bagId === i.bagId)!
      // The existing writer moves it out of HANDED_TO_CUSTOMER and logs the event.
      state.held = state.held.filter((b) => b.bagId !== i.bagId)
      state.events.push({
        bagId: bag.bagId, bagNumber: bag.bagNumber, businessId: LB, customerId: i.customerId ?? null,
        orderId: i.orderId ?? null, orderNumber: bag.orderNumber, action: 'RETURNED_BY_CUSTOMER',
        createdAt: new Date(Date.now() + state.events.length),
      })
      return { ok: true as const, bagNumber: bag.bagNumber, status: 'AVAILABLE', condition: i.condition }
    }),
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: H.prisma }))
vi.mock('@/lib/laundry-bag-lifecycle', async (orig) => {
  const actual = await orig<typeof import('@/lib/laundry-bag-lifecycle')>()
  return { ...actual, getBagsWithCustomer: H.getBagsWithCustomer, receiveReturnedBag: H.receiveReturnedBag }
})

import { customerReturnBags, confirmReturnedBag } from '@/lib/laundry-pickup-return'

const { state } = H
const LB = 'lb_vs'
const CUST = 'cus-1'
const ORDER = 'ord-next'

const hold = (n: number) => {
  state.held = Array.from({ length: n }, (_, i) => ({
    bagId: `bag-${i + 2}`, bagNumber: `V8BAG00${i + 2}`,
    orderId: 'ord-prev', orderNumber: 'ORD-PREV', handedOverAt: new Date(),
  }))
}

beforeEach(() => {
  state.held = []; state.events = []; state.receiveCalls = []; state.receiveFails = false
  vi.clearAllMocks()
})

const scan = (code: string) => confirmReturnedBag({ lbId: LB, customerId: CUST, code, orderId: ORDER })

// ── 19-22, 36 ──────────────────────────────────────────────────────────────
describe('19,20,21,22,36 · the customer\'s held bags are listed', () => {
  it('19 · one held bag', async () => {
    hold(1)
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.total).toBe(1)
    expect(v.bags[0].bagNumber).toBe('V8BAG002')
  })

  it('20,21,22 · two and three held bags all appear', async () => {
    hold(3)
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.total).toBe(3)
    expect(v.bags.map((b) => b.bagNumber)).toEqual(['V8BAG002', 'V8BAG003', 'V8BAG004'])
    expect(v.bags.map((b) => b.index)).toEqual([1, 2, 3])
  })

  it('36 · only CURRENTLY-held bags — history never reappears', async () => {
    hold(2)
    await scan('V8BAG002')
    // The returned bag stays visible for THIS pickup's progress…
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.total).toBe(2)
    expect(v.bags.find((b) => b.bagNumber === 'V8BAG002')?.returned).toBe(true)
    // …but a later pickup, with no events of its own, sees only what is held.
    const next = await customerReturnBags(LB, CUST, { orderId: 'ord-later' })
    expect(next.total).toBe(1)
    expect(next.bags[0].bagNumber).toBe('V8BAG003')
  })

  it('13 · the lookup uses the existing helper, not deliveryBagNumber', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-pickup-return.ts'), 'utf8')
    expect(SRC).toContain('getBagsWithCustomer(lbId, customerId)')
    expect(SRC).not.toContain('deliveryBagNumber')
  })
})

// ── 1-4 · PARTIAL RETURN — the pickup is never blocked ────────────────────
describe('1,2,3,4 · returning fewer bags never blocks the pickup', () => {
  it('THE RULE · there is no pickup return gate to call', async () => {
    const mod = await import('@/lib/laundry-pickup-return')
    expect('pickupReturnGate' in mod).toBe(false)
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-pickup-return.ts'), 'utf8')
    expect(SRC).toContain('DELIBERATELY NO GATE FUNCTION')
    // And nothing in the pickup path calls one.
    const RET_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/executive/jobs/[id]/return-bags/route.ts'), 'utf8')
    expect(RET_API).not.toContain('Gate')
  })

  it('1 · 3 of 3 returned', async () => {
    hold(3)
    for (const c of ['V8BAG002', 'V8BAG003', 'V8BAG004']) await scan(c)
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.returned).toBe(3); expect(v.outstanding).toBe(0); expect(v.allReturned).toBe(true)
    expect(v.message).toBe('3 of 3 bags returned.')
  })

  it('2 · 2 of 3 — the third stays with the customer', async () => {
    hold(3)
    await scan('V8BAG002'); await scan('V8BAG003')
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.returned).toBe(2); expect(v.outstanding).toBe(1); expect(v.allReturned).toBe(false)
    expect(v.message).toBe('2 of 3 bags returned. 1 bag remains with customer.')
    // Informational — it never tells the operator they cannot continue.
    expect(v.message).not.toMatch(/cannot|before completing|scan all/i)
  })

  it('3 · 1 of 3', async () => {
    hold(3)
    await scan('V8BAG002')
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.returned).toBe(1); expect(v.outstanding).toBe(2)
    expect(v.message).toBe('1 of 3 bags returned. 2 bags remain with customer.')
  })

  it('4 · 0 of 3 — nothing returned is a normal pickup', async () => {
    hold(3)
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.returned).toBe(0); expect(v.outstanding).toBe(3); expect(v.allReturned).toBe(false)
    expect(v.message).not.toMatch(/cannot|before completing/i)
  })

  it('5,6 · only SCANNED bags leave the customer', async () => {
    hold(3)
    await scan('V8BAG002')
    // The scanned one left; the other two are still held.
    expect(state.held.map((b) => b.bagNumber)).toEqual(['V8BAG003', 'V8BAG004'])
    expect(state.receiveCalls).toHaveLength(1)
  })

  it('no bag is returned merely because the pickup ended', async () => {
    hold(3)
    // No scans at all — the lifecycle writer is never called.
    await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(state.receiveCalls).toHaveLength(0)
    expect(state.held).toHaveLength(3)
  })
})

// ── 27-30 · safety ─────────────────────────────────────────────────────────
describe('27,28,29,30 · scanning is customer- and tenant-safe', () => {
  it('27,28,29 · a bag this customer does not hold is refused by name', async () => {
    hold(2)
    const r = await scan('V8BAG099')
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toBe('Bag V8BAG099 is not currently assigned to this customer.')
    expect(r.status).toBe(409)
    expect(state.receiveCalls).toHaveLength(0) // nothing was written
  })

  it('29 · the held lookup is business-scoped', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-pickup-return.ts'), 'utf8')
    expect(SRC).toContain('getBagsWithCustomer(lbId, customerId)')
    expect(SRC).toContain('businessId: lbId')
  })

  it('30 · a duplicate scan is idempotent and writes nothing twice', async () => {
    hold(3)
    await scan('V8BAG002')
    const again = await scan('V8BAG002')
    expect(again.ok).toBe(true)
    if (!again.ok) throw new Error('expected ok')
    expect(again.alreadyReturned).toBe(true)
    expect(again.returned).toBe(1)
    expect(state.receiveCalls).toHaveLength(1)
  })
})

// ── 11,12,31,32,33,35 · lifecycle and identity ─────────────────────────────
describe('11,12,31,32,33,35 · the bag keeps its identity and lifecycle', () => {
  it('31 · the bag id is preserved — no replacement row is created', async () => {
    hold(1)
    const r = await scan('V8BAG002')
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected ok')
    expect(r.bagNumber).toBe('V8BAG002')
    expect(state.receiveCalls[0].bagId).toBe('bag-2')
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-pickup-return.ts'), 'utf8')
    for (const w of ['generateBagCode', 'issueBagId', 'laundryBag.create']) expect(SRC, w).not.toContain(w)
  })

  it('12,33,35 · it delegates to the existing lifecycle writer', async () => {
    hold(1)
    await scan('V8BAG002')
    expect(H.receiveReturnedBag).toHaveBeenCalledWith(expect.objectContaining({ lbId: LB, bagId: 'bag-2', customerId: CUST }))
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-pickup-return.ts'), 'utf8')
    // No status is invented here — condition decides, inside the writer.
    for (const w of ['laundryBag.update', 'AVAILABLE', 'status ='] ) expect(SRC, w).not.toContain(w)
  })

  it('32,34 · a returned bag stops being held', async () => {
    hold(2)
    await scan('V8BAG002')
    expect(state.held.map((b) => b.bagNumber)).toEqual(['V8BAG003'])
    expect(H.getBagsWithCustomer).toHaveBeenCalled()
  })

  it('19 · a failed return does NOT report the bag as returned', async () => {
    hold(2)
    state.receiveFails = true
    const r = await scan('V8BAG002')
    expect(r.ok).toBe(false)
    expect((await customerReturnBags(LB, CUST, { orderId: ORDER })).returned).toBe(0)
    expect(state.held).toHaveLength(2) // still with the customer
  })
})

// ── 37,38 · end to end ─────────────────────────────────────────────────────
describe('37,38 · delivery → custody → next pickup', () => {
  it('37 · three delivered bags are all returned at the next pickup', async () => {
    hold(3)
    expect((await customerReturnBags(LB, CUST, { orderId: ORDER })).total).toBe(3)
    for (const c of ['V8BAG002', 'V8BAG003', 'V8BAG004']) {
      const r = await scan(c)
      expect(r.ok, c).toBe(true)
    }
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.returned).toBe(3)
    expect(v.allReturned).toBe(true)
    expect(state.held).toHaveLength(0)
  })

  it('13 · the one-bag flow still works end to end', async () => {
    hold(1)
    expect((await customerReturnBags(LB, CUST, { orderId: ORDER })).outstanding).toBe(1)
    await scan('V8BAG002')
    const v = await customerReturnBags(LB, CUST, { orderId: ORDER })
    expect(v.allReturned).toBe(true)
    expect(state.receiveCalls).toHaveLength(1)
  })
})
