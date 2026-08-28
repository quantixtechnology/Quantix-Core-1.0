import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// MULTI-BAG DELIVERY.
//
// An order may be packed into several bags; the customer receives ALL of them.
// Delivery reads the same authority every other stage reads — LaundryBagAssignment
// via orderBags() — and every bag must be confirmed before the handover is
// complete.
//
// NO SCHEMA CHANGE. Per-bag confirmation is an append-only LaundryBagEvent
// (already indexed by orderId), not a new column and never a comma-packed
// deliveryBagNumber. That field is left alone and still read as the LEGACY
// fallback for orders older than the assignment rows.
// ============================================================================

const H = vi.hoisted(() => {
  const state = {
    assignments: [] as { id: string; bagId: string; businessId: string; orderId: string; status: string; assignedAt: Date }[],
    bags: [] as { id: string; bagNumber: string; qrValue: string; status: string; currentCustodianType: string; businessId: string }[],
    events: [] as { bagId: string; businessId: string; orderId: string | null; action: string; createdAt: Date }[],
    order: null as null | { id: string; orderNumber: string; customerId: string | null; storeId: string | null; businessId: string },
  }
  return {
    state,
    prisma: {
      laundryBagAssignment: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.assignments
          .filter((r) => r.businessId === a.where.businessId && r.orderId === a.where.orderId)
          .sort((x, y) => x.assignedAt.getTime() - y.assignedAt.getTime())
          .map((r) => ({ ...r, bag: state.bags.find((b) => b.id === r.bagId) ?? null }))),
        count: vi.fn(async () => state.assignments.length),
      },
      laundryBagEvent: {
        // The reader asks for BOTH delivery actions at once (scan + exception),
        // so the fake honours `action: { in: [...] }` as well as a bare string.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: vi.fn(async (a: any) => state.events
          .filter((e) => e.businessId === a.where.businessId && e.orderId === a.where.orderId
            && (typeof a.where.action === 'string' ? e.action === a.where.action : (a.where.action?.in ?? []).includes(e.action)))
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

import { deliveryBags, confirmDeliveryBag, deliveryBagGate, DELIVERY_BAG_CONFIRMED } from '@/lib/laundry-delivery-bags'

const { state } = H
const LB = 'lb_vs'
const ORDER = 'ord-1'

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

beforeEach(() => {
  state.assignments = []; state.bags = []; state.events = []
  state.order = { id: ORDER, orderNumber: 'ORD-1', customerId: 'cus-1', storeId: 'st-1', businessId: LB }
  vi.clearAllMocks()
})

// ── A, B, C, D, E ──────────────────────────────────────────────────────────
describe('A,B,C,D,E · the bag list comes from the assignments', () => {
  it('A · a one-bag order shows exactly one bag', async () => {
    seed(1)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(1)
    expect(v.bags[0].bagNumber).toBe('V8BAG002')
  })

  it('B · a two-bag order shows both', async () => {
    seed(2)
    expect((await deliveryBags(LB, ORDER)).bags.map((b) => b.bagNumber)).toEqual(['V8BAG002', 'V8BAG003'])
  })

  it('C · a three-bag order shows all three, numbered', async () => {
    seed(3)
    const v = await deliveryBags(LB, ORDER)
    expect(v.total).toBe(3)
    expect(v.bags.map((b) => b.index)).toEqual([1, 2, 3])
  })

  it('D · it reads LaundryBagAssignment, not an order column', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-delivery-bags.ts'), 'utf8')
    expect(SRC).toContain('orderBags(lbId, orderId)')
    expect(SRC).not.toContain('deliveryBagCount')
  })

  it('E · nothing comma-packs deliveryBagNumber', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-delivery-bags.ts'), 'utf8')
    const LIFE = readFileSync(join(process.cwd(), 'src/lib/laundry-bag-lifecycle.ts'), 'utf8')
    for (const src of [SRC, LIFE]) {
      expect(src).not.toContain('.join(",")')
      expect(src).not.toContain("split(',')")
    }
    // The field is only ever READ (a `select`), never WRITTEN by this module.
    expect(LIFE).toContain('deliveryBagNumber: true')       // read
    expect(LIFE).not.toContain('data: { deliveryBagNumber') // never written
  })
})

// ── F, G, H, I ─────────────────────────────────────────────────────────────
describe('F,G,H,I · every bag must be confirmed', () => {
  it('F · 0/3 blocks with the operator message', async () => {
    seed(3)
    // Says where it stands AND both ways out — scan the rest, or record why one
    // cannot be scanned. It never leaves the operator with no move.
    expect(await deliveryBagGate(LB, ORDER)).toBe('0 of 3 bags scanned. Scan the remaining 3 bags, or record a scan exception, before completing delivery.')
  })

  it('G · 1/3 blocks', async () => {
    seed(3)
    await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(await deliveryBagGate(LB, ORDER)).toContain('1 of 3')
  })

  it('H · 2/3 blocks', async () => {
    seed(3)
    for (const c of ['V8BAG002', 'V8BAG003']) await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: c })
    expect(await deliveryBagGate(LB, ORDER)).toContain('2 of 3')
  })

  it('I · 3/3 allows completion', async () => {
    seed(3)
    for (const c of ['V8BAG002', 'V8BAG003', 'V8BAG004']) await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: c })
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
    expect((await deliveryBags(LB, ORDER)).complete).toBe(true)
  })

  it('a one-bag order completes on one scan (existing flow)', async () => {
    seed(1)
    await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })

  it('an order with NO bags is not blocked — a bagless delivery is legitimate', async () => {
    expect(await deliveryBagGate(LB, ORDER)).toBeNull()
  })
})

// ── J, K, L, M ─────────────────────────────────────────────────────────────
describe('J,K,L,M · scanning is order-safe', () => {
  it('J,K · a bag that is not on this order is refused by name', async () => {
    seed(2)
    const r = await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG099' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toBe('Bag V8BAG099 does not belong to this order.')
    expect(r.status).toBe(409)
  })

  it('L · another tenant cannot confirm these bags', async () => {
    seed(2)
    const r = await confirmDeliveryBag({ lbId: 'lb_other', orderId: ORDER, code: 'V8BAG002' })
    expect(r.ok).toBe(false) // the order's bag list is empty for that tenant
  })

  it('M · a duplicate scan does not advance the count or write a second event', async () => {
    seed(3)
    await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    const again = await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'V8BAG002' })
    expect(again.ok).toBe(true)
    if (!again.ok) throw new Error('expected ok')
    expect(again.alreadyConfirmed).toBe(true)
    expect(again.confirmed).toBe(1)
    expect(state.events.filter((e) => e.action === DELIVERY_BAG_CONFIRMED)).toHaveLength(1)
  })

  it('confirmation is case-insensitive and accepts the QR value', async () => {
    seed(1)
    expect((await confirmDeliveryBag({ lbId: LB, orderId: ORDER, code: 'v8bag002' })).ok).toBe(true)
  })
})

// ── N, O, P, V · disposition over the whole set ────────────────────────────
describe('N,O,P,V · every bag goes to the customer', () => {
  const LIFE = readFileSync(join(process.cwd(), 'src/lib/laundry-bag-lifecycle.ts'), 'utf8')

  it('N,O · the disposition loops the order\'s bags, not one field', () => {
    expect(LIFE).toContain('for (const bag of bags) {')
    expect(LIFE).toContain('prisma.laundryBagAssignment.findMany({')
    expect(LIFE).toContain('bagNumbers: bags.map((b) => b.bagNumber)')
    // HANDED_TO_CUSTOMER still sets the customer custodian — not AVAILABLE.
    expect(LIFE).toContain('status = BAG_STATUS.HANDED_TO_CUSTOMER; custodianType = CUSTODIAN.CUSTOMER')
  })

  it('O · nothing in the delivery path releases a bag to stock', () => {
    const fn = LIFE.slice(LIFE.indexOf('export async function applyDeliveryDisposition'), LIFE.indexOf('// ── Identifying a bag'))
    expect(fn).not.toContain('releaseBag')
    expect(fn).not.toContain('AVAILABLE')
  })

  it('V · a legacy order with only deliveryBagNumber still dispositions', () => {
    const fn = LIFE.slice(LIFE.indexOf('export async function applyDeliveryDisposition'), LIFE.indexOf('// ── Identifying a bag'))
    expect(fn).toContain('assigned.length')
    expect(fn).toContain('order.deliveryBagNumber')
    expect(fn).toContain('LEGACY')  // the fallback is documented at the lookup
  })

  it('P · customer-held bags are found through the existing helper', () => {
    expect(LIFE).toContain('export async function getBagsWithCustomer(')
  })
})

// ── Z + isolation ──────────────────────────────────────────────────────────
describe('Z · payment and OTP untouched', () => {
  const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-delivery-bags.ts'), 'utf8')

  it('the bag gate consults no payment field', () => {
    for (const w of ['balanceDue', 'paymentStatus', 'PAY_LATER', 'amountPaid']) expect(SRC, w).not.toContain(w)
  })

  it('and no OTP', () => {
    for (const w of ['deliveryOtp', 'verifyDelivery', 'regenerateOtp']) expect(SRC, w).not.toContain(w)
  })

  it('confirmation is append-only — it overwrites no bag status', () => {
    expect(SRC).toContain('laundryBagEvent.create')
    for (const w of ['laundryBag.update', 'laundryBagAssignment.update', 'laundryOrder.update']) {
      expect(SRC, w).not.toContain(w)
    }
  })

  it('Sorting and Packing were not changed by this slice', () => {
    const SORT = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/sorting/route.ts'), 'utf8')
    expect(SORT).toContain('allowMultiple: true')            // dcff9d8 intact
    expect(SORT).not.toContain('DELIVERY_BAG_CONFIRMED')
    const PACK = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')
    expect(PACK).toContain('useOrderBags(selected?.id ?? null, currentBusinessId)') // 5dab449 intact
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// THE GATE IS SERVER-AUTHORITATIVE, and it runs BEFORE anything changes.
// ═══════════════════════════════════════════════════════════════════════════

describe('1,2 · the delivery gate is wired into both routes', () => {
  const ADMIN = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/deliver/route.ts'), 'utf8')
  const EXEC = readFileSync(join(process.cwd(), 'src/app/api/laundry/executive/jobs/[id]/deliver/route.ts'), 'utf8')

  it('both routes call the shared gate — the logic is not duplicated', () => {
    for (const src of [ADMIN, EXEC]) {
      expect(src).toContain('deliveryBagGate(')
      expect(src).toContain('code: "BAGS_PENDING"')
      expect(src).toContain('{ status: 409 }')
      // No local re-implementation of the count.
      expect(src).not.toContain('bags scanned. Scan the remaining')
    }
  })

  // Handler bodies only — the import block names everything first.
  const bodyOf = (src: string) => src.slice(src.indexOf('export async function POST'))

  it('2 · the gate runs BEFORE the delivery transition', () => {
    for (const src of [ADMIN, EXEC]) {
      const body = bodyOf(src)
      expect(body.indexOf('deliveryBagGate(')).toBeLessThan(body.indexOf('markOrderDelivered('))
      expect(body.indexOf('deliveryBagGate(')).toBeLessThan(body.indexOf('applyDeliveryDisposition('))
    }
  })

  it('2,5 · and BEFORE verification, so a rejection cannot burn the OTP', () => {
    // verifyDelivery CLEARS the OTP on success. Gating after it would leave the
    // customer without a usable code on a delivery that then could not complete.
    for (const src of [ADMIN, EXEC]) {
      const body = bodyOf(src)
      expect(body.indexOf('deliveryBagGate(')).toBeLessThan(body.indexOf('verifyDelivery('))
    }
  })

  it('a client cannot bypass it — the gate is on the server, not the UI', () => {
    for (const src of [ADMIN, EXEC]) {
      expect(src).toContain('const bagBlock = await deliveryBagGate')
      expect(src).toContain('if (bagBlock) return NextResponse.json')
    }
  })

  it('5,17,18 · the OTP engine is untouched by this wiring', () => {
    for (const src of [ADMIN, EXEC]) {
      expect(src).toContain('verifyDelivery(')     // still the only verifier
      expect(src).not.toContain('regenerateOtp')
      expect(src).toContain('deliveryOtp: true')          // read in the select
      expect(src).not.toContain('data: { deliveryOtp')    // never written here
    }
  })
})
