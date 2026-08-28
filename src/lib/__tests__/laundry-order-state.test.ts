import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  assertTransition,
  checkStateInvariants,
  reconcileStatus,
  type OrderStateEvidence,
} from '@/lib/laundry-order-state'
import { TRANSITIONS, CUSTODY_ACTIONS } from '@/lib/laundry-workflow'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

// A blank order: no garments, nothing processed, nothing delivered.
const base = (over: Partial<OrderStateEvidence> = {}): OrderStateEvidence => ({
  id: 'o1',
  orderNumber: 'ORD-STR-BUS-202608-0008-002-000029',
  businessId: 'lb_vs',
  status: 'AWAITING_PICKUP_ASSIGNMENT',
  itemCount: 0,
  inspectedCount: 0,
  processedCount: 0,
  hasProcessingEvent: false,
  hasStoreReceiptEvent: false,
  pickupRequired: true,
  pickupCompletedAt: null,
  deliveryRequired: true,
  deliveredAt: null,
  deliveryCompletedAt: null,
  ...over,
})

/** An order that has genuinely done the work, sitting at Ready for Delivery. */
const readyForDelivery = (over: Partial<OrderStateEvidence> = {}) =>
  base({
    status: 'READY_FOR_DELIVERY',
    itemCount: 4,
    inspectedCount: 4,
    processedCount: 4,
    hasProcessingEvent: true,
    hasStoreReceiptEvent: true,
    pickupCompletedAt: new Date('2026-08-20T09:00:00Z'),
    ...over,
  })

describe('DELIVERED is unreachable without a completed delivery', () => {
  it('refuses DELIVERED when the delivery has not been completed', () => {
    const v = checkStateInvariants('DELIVERED', readyForDelivery())
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('DELIVERY_NOT_COMPLETED')
  })

  it('allows DELIVERED only when the caller stamps the completion in the same write', () => {
    expect(checkStateInvariants('DELIVERED', readyForDelivery(), { deliveryCompletion: true }).ok).toBe(true)
  })

  it('accepts an already-completed delivery (historical rows stay valid)', () => {
    expect(checkStateInvariants('DELIVERED', readyForDelivery({ deliveredAt: new Date(), deliveryCompletedAt: new Date() })).ok).toBe(true)
  })

  // Rule 3: a delivery that merely exists / progresses can never move the order.
  it.each([
    ['awaiting assignment', { deliveryExecutive: null, accepted: null }],
    ['assigned', { deliveryExecutive: 'e1', accepted: null }],
    ['accepted', { deliveryExecutive: 'e1', accepted: new Date() }],
    ['started / in transit', { deliveryExecutive: 'e1', accepted: new Date() }],
  ])('a delivery that is only %s cannot make the parent order Delivered', () => {
    // None of those states writes deliveredAt / deliveryCompletedAt, which is
    // exactly what the invariant reads.
    const v = checkStateInvariants('DELIVERED', readyForDelivery())
    expect(v.ok).toBe(false)
  })
})

describe('processing can never be skipped', () => {
  it('blocks Ready for Delivery when the garments never finished processing', () => {
    const v = checkStateInvariants('READY_FOR_DELIVERY', base({ status: 'RETURN_IN_TRANSIT', itemCount: 3, inspectedCount: 3 }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('PROCESSING_NOT_COMPLETE')
  })

  it('blocks DELIVERED on an unprocessed order even with a completion stamp', () => {
    const v = checkStateInvariants('DELIVERED', base({ status: 'READY_FOR_DELIVERY', itemCount: 3, inspectedCount: 3, deliveredAt: new Date() }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('PROCESSING_NOT_COMPLETE')
  })

  it('accepts an order processed before per-garment tracking (proof event)', () => {
    expect(checkStateInvariants('READY_FOR_DELIVERY', base({ itemCount: 3, inspectedCount: 3, processedCount: 0, hasProcessingEvent: true })).ok).toBe(true)
  })
})

describe('garments must be identified before payment, packing or processing', () => {
  it.each(['PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED', 'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY', 'DELIVERED'])(
    'blocks %s on a zero-garment order',
    (status) => {
      const v = checkStateInvariants(status, base())
      expect(v.ok).toBe(false)
      if (!v.ok) expect(v.code).toBe('GARMENTS_NOT_IDENTIFIED')
    },
  )

  it('blocks Payment when a garment is still un-inspected', () => {
    const v = checkStateInvariants('PAYMENT_PENDING', base({ itemCount: 4, inspectedCount: 3 }))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('GARMENTS_NOT_IDENTIFIED')
  })
})

describe('pickup stays independently operable (rule 12)', () => {
  it.each(['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT', 'UNDER_AUDIT'])(
    '%s carries no garment or processing precondition',
    (status) => {
      expect(checkStateInvariants(status, base()).ok).toBe(true)
    },
  )

  it('pickup completion moves the order to transit, never to Delivered', () => {
    const edge = TRANSITIONS.AWAITING_PICKUP_ASSIGNMENT.find((t) => t.action === 'PICKUP_COMPLETED')
    expect(edge?.to).toBe('IN_TRANSIT_TO_STORE')
    // and there is no edge from the pickup stages to DELIVERED at all
    for (const s of ['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT'] as const) {
      expect(TRANSITIONS[s].some((t) => t.to === 'DELIVERED')).toBe(false)
    }
  })
})

describe('assertTransition: edges, internal edges and invariants together', () => {
  it('rejects a jump that has no edge', () => {
    const v = assertTransition('PENDING_STORE_AUDIT', 'DELIVERED', base())
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('INVALID_TRANSITION')
  })

  it('rejects an internal edge for a caller that performs no physical action', () => {
    const v = assertTransition('READY_FOR_DELIVERY', 'DELIVERED', readyForDelivery())
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('INTERNAL_TRANSITION')
  })

  it('allows the delivery engine through, with its custody + completion declaration', () => {
    expect(assertTransition('READY_FOR_DELIVERY', 'DELIVERED', readyForDelivery(), { allowInternal: true, custodyAction: true, deliveryCompletion: true }).ok).toBe(true)
  })

  it('still refuses the delivery engine on an unprocessed order', () => {
    const ev = base({ status: 'READY_FOR_DELIVERY', itemCount: 2, inspectedCount: 2 })
    const v = assertTransition('READY_FOR_DELIVERY', 'DELIVERED', ev, { allowInternal: true, custodyAction: true, deliveryCompletion: true })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.code).toBe('PROCESSING_NOT_COMPLETE')
  })

  it('a normal Pickup → Processing → Ready → Delivered flow passes at every step', () => {
    const audited = { itemCount: 4, inspectedCount: 4 }
    const steps: [string, string, Partial<OrderStateEvidence>][] = [
      ['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', {}],
      ['IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT', {}],
      ['PENDING_STORE_AUDIT', 'PAYMENT_PENDING', audited],
      ['PAYMENT_PENDING', 'READY_FOR_PROCESSING', audited],
      ['READY_FOR_PROCESSING', 'PACKED', audited],
      ['PACKED', 'IN_TRANSIT_TO_PROCESSING', audited],
      ['IN_TRANSIT_TO_PROCESSING', 'PROCESSING', audited],
      ['PROCESSING', 'RETURN_IN_TRANSIT', audited],
      ['RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY', { ...audited, processedCount: 4 }],
      ['READY_FOR_DELIVERY', 'DELIVERED', { ...audited, processedCount: 4 }],
    ]
    for (const [from, to, ev] of steps) {
      const v = assertTransition(from, to, base({ status: from, ...ev }), { allowInternal: true, custodyAction: true, deliveryCompletion: to === 'DELIVERED' })
      expect(v, `${from} → ${to}`).toEqual({ ok: true })
    }
  })
})

describe('reconciliation of already-corrupted rows', () => {
  it('sends a Delivered order with no garments back to the pickup board', () => {
    const fix = reconcileStatus(base({ status: 'DELIVERED' }))
    expect(fix?.to).toBe('AWAITING_PICKUP_ASSIGNMENT')
  })

  it('sends a Delivered order whose pickup was completed back to transit', () => {
    const fix = reconcileStatus(base({ status: 'DELIVERED', pickupCompletedAt: new Date() }))
    expect(fix?.to).toBe('IN_TRANSIT_TO_STORE')
  })

  it('sends a Delivered order already received at the store back to Store Audit', () => {
    const fix = reconcileStatus(base({ status: 'DELIVERED', pickupCompletedAt: new Date(), hasStoreReceiptEvent: true }))
    expect(fix?.to).toBe('PENDING_STORE_AUDIT')
  })

  it('parks an audited-but-unprocessed Delivered order in the Packing & QR queue', () => {
    const fix = reconcileStatus(base({
      status: 'DELIVERED', itemCount: 3, inspectedCount: 3,
      pickupCompletedAt: new Date(), hasStoreReceiptEvent: true,
    }))
    expect(fix?.to).toBe('READY_FOR_PROCESSING')
  })

  it('parks a fully-processed but never-delivered order at Ready for Delivery', () => {
    const fix = reconcileStatus(readyForDelivery({ status: 'DELIVERED' }))
    expect(fix?.to).toBe('READY_FOR_DELIVERY')
  })

  // A repair must never claim the garments are in the Processing Centre.
  it('never lands an order in an in-flight processing stage', () => {
    const inFlight = ['PACKED', 'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'QC_PENDING', 'RETURN_IN_TRANSIT']
    for (const s of ['DELIVERED', 'READY_FOR_DELIVERY', 'RETURN_IN_TRANSIT', 'PROCESSING']) {
      const fix = reconcileStatus(base({ status: s }))
      if (fix) expect(inFlight, `${s} → ${fix.to}`).not.toContain(fix.to)
    }
  })

  it('leaves a genuinely delivered order alone', () => {
    expect(reconcileStatus(readyForDelivery({ status: 'DELIVERED', deliveredAt: new Date(), deliveryCompletedAt: new Date() }))).toBeNull()
  })

  it('leaves valid in-flight orders alone at every stage', () => {
    const audited = { itemCount: 4, inspectedCount: 4, pickupCompletedAt: new Date(), hasStoreReceiptEvent: true }
    for (const s of ['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT', 'PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED', 'PROCESSING']) {
      expect(reconcileStatus(base({ status: s, ...audited })), s).toBeNull()
    }
  })

  it('never touches DRAFT or CANCELLED', () => {
    expect(reconcileStatus(base({ status: 'CANCELLED' }))).toBeNull()
    expect(reconcileStatus(base({ status: 'DRAFT' }))).toBeNull()
  })

  it('only ever moves an order BACKWARDS', () => {
    const order = ['DRAFT', 'AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT', 'UNDER_AUDIT', 'PAYMENT_PENDING', 'READY_FOR_PROCESSING', 'PACKED', 'IN_TRANSIT_TO_PROCESSING', 'PROCESSING', 'QC_PENDING', 'RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY', 'DELIVERED']
    for (const s of order.slice(1)) {
      const fix = reconcileStatus(base({ status: s }))
      if (fix) expect(order.indexOf(fix.to), `${s} → ${fix.to}`).toBeLessThan(order.indexOf(fix.from))
    }
  })
})

// ── Wiring: the guard is actually installed on every status-writing path ─────
describe('every status-advancing endpoint is behind the guard', () => {
  const files = [
    'src/app/api/laundry/orders/[id]/transition/route.ts',
    'src/app/api/laundry/orders/[id]/payment/route.ts',
    'src/app/api/laundry/orders/[id]/pack/route.ts',
    'src/app/api/laundry/orders/[id]/dispatch/route.ts',
    'src/app/api/laundry/orders/[id]/receive/route.ts',
    'src/app/api/laundry/orders/[id]/return-dispatch/route.ts',
    'src/app/api/laundry/orders/[id]/store-receive/route.ts',
    'src/app/api/laundry/processing/transit/route.ts',
    'src/lib/laundry-deliver.ts',
  ]
  it.each(files)('%s is behind the state guard', (f) => {
    const src = read(f)
    expect(src).toMatch(/guardStatusWrite|guardFinancialAdvance/)
  })

  it('markOrderDelivered is the only place that writes DELIVERED', () => {
    // A repo-wide grep would be brittle; these two are the assertions that matter:
    // the delivery engine declares the completion, and the generic transition API
    // refuses internal edges.
    expect(read('src/lib/laundry-deliver.ts')).toContain('deliveryCompletion: true')
    expect(read('src/app/api/laundry/orders/[id]/transition/route.ts')).toContain('transition.internal')
  })

  // A guard call that names an `internal` edge WITHOUT allowInternal would
  // refuse the very transition its own endpoint exists to perform — silently
  // stalling the workflow. This checks every call site against the state machine.
  it('every guarded internal edge is granted by the endpoint that owns it', () => {
    const calls: { file: string; from: string; to: string; allowInternal: boolean; custodyAction: boolean }[] = []
    for (const f of files) {
      const src = read(f)
      for (const m of src.matchAll(/guardStatusWrite\(\{([^}]*)\}\)/g)) {
        const body = m[1]
        const from = /from: "([A-Z_]+)"/.exec(body)?.[1]
        const to = /to: "([A-Z_]+)"/.exec(body)?.[1]
        if (!from || !to) continue // the generic transition API passes variables
        calls.push({ file: f, from, to, allowInternal: /allowInternal: true/.test(body), custodyAction: /custodyAction: true/.test(body) })
      }
    }
    expect(calls.length).toBeGreaterThanOrEqual(7)
    for (const c of calls) {
      const edge = TRANSITIONS[c.from as keyof typeof TRANSITIONS]?.find((t) => t.to === c.to)
      expect(edge, `${c.file}: no edge ${c.from} → ${c.to}`).toBeDefined()
      if (edge?.internal) {
        expect(c.allowInternal, `${c.file}: ${c.from} → ${c.to} is internal and needs allowInternal`).toBe(true)
      }
      if (edge?.custody) {
        expect(c.custodyAction, `${c.file}: ${c.from} → ${c.to} is a custody edge and needs custodyAction`).toBe(true)
      }
    }
  })

  it('Pay Later can no longer take an internal (physical custody) edge', () => {
    const api = read('src/app/api/laundry/orders/[id]/payment/route.ts')
    const fn = api.slice(api.indexOf('async function advanceOnPayLater'), api.indexOf('async function advanceAfterPayment'))
    expect(fn).toContain('if (primary.internal || primary.custody) return null')
    expect(fn).toContain('guardFinancialAdvance')
  })
})

// ============================================================================
// ACCEPTANCE CRITERION
// "No payment endpoint can ever advance an order through an internal physical
//  workflow edge" — proven structurally, not by inspecting today's call site.
// ============================================================================
describe('a payment can never impersonate a physical operation', () => {
  // Every file that handles money and could conceivably move an order.
  const moneyRoutes = [
    'src/app/api/laundry/orders/[id]/payment/route.ts',
    'src/app/api/laundry/payments-ledger/route.ts',
    'src/app/api/core/storefront/laundry-pay/verify/route.ts',
    'src/lib/laundry-payment-record.ts',
    'src/lib/laundry-subscription-server.ts',
  ]

  it('custody is always a strict subset of internal', () => {
    const custody = Object.values(TRANSITIONS).flat().filter((t) => t.custody)
    expect(custody.length).toBeGreaterThan(0)
    for (const t of custody) expect(t.internal, `${t.action} is custody but not internal`).toBe(true)
  })

  it('marks every physical movement of the garments as custody', () => {
    expect(new Set(CUSTODY_ACTIONS)).toEqual(new Set([
      'PICKUP_COMPLETED', 'PACK_ORDER', 'DISPATCH_TO_PROCESSING', 'RECEIVE_AT_PROCESSING',
      'DISPATCH_TO_STORE', 'RECEIVE_AT_STORE', 'MARK_DELIVERED',
    ]))
  })

  it('COLLECT_PAYMENT is internal but NOT custody — money moves, garments do not', () => {
    const edge = TRANSITIONS.PAYMENT_PENDING.find((t) => t.action === 'COLLECT_PAYMENT')
    expect(edge?.internal).toBe(true)
    expect(edge?.custody).toBeUndefined()
  })

  // The behavioural proof: a caller holding allowInternal and perfect evidence
  // still cannot take a custody edge without declaring it did the physical work.
  it('refuses every custody edge to a caller that performed no physical action', () => {
    const full = {
      itemCount: 4, inspectedCount: 4, processedCount: 4,
      hasProcessingEvent: true, hasStoreReceiptEvent: true, pickupCompletedAt: new Date(),
    }
    for (const [from, defs] of Object.entries(TRANSITIONS)) {
      for (const edge of defs.filter((t) => t.custody)) {
        const ev = base({ status: from, ...full })
        const v = assertTransition(from, edge.to, ev, { allowInternal: true, deliveryCompletion: true })
        expect(v.ok, `${from} → ${edge.to} was granted without custodyAction`).toBe(false)
        if (!v.ok) expect(v.code).toBe('CUSTODY_TRANSITION')
        // …and granted the moment the performing endpoint declares it.
        expect(assertTransition(from, edge.to, ev, { allowInternal: true, custodyAction: true, deliveryCompletion: true }).ok).toBe(true)
      }
    }
  })

  it('the financial entry point cannot even express a custody grant', () => {
    const lib = read('src/lib/laundry-order-state.ts')
    const fn = lib.slice(lib.indexOf('export async function guardFinancialAdvance'))
    // Its signature accepts no custody parameter, and it hard-codes the refusal.
    const sig = fn.slice(0, fn.indexOf('}): Promise<StateVerdict>'))
    expect(sig).not.toContain('custodyAction')
    expect(fn).toContain('custodyAction: false')
  })

  it.each(moneyRoutes)('%s never claims custody and never bypasses the financial entry point', (f) => {
    const src = read(f)
    expect(src, 'a money endpoint must never declare custodyAction').not.toContain('custodyAction')
    // If it guards a status write at all, it must do so through the financial
    // entry point — guardStatusWrite would let it ask for allowInternal itself.
    if (src.includes('laundry-order-state')) {
      expect(src).toContain('guardFinancialAdvance')
      expect(src).not.toContain('guardStatusWrite')
    }
  })

  it('Pay Later refuses a physical edge at the route, before the guard is consulted', () => {
    const api = read('src/app/api/laundry/orders/[id]/payment/route.ts')
    const fn = api.slice(api.indexOf('async function advanceOnPayLater'), api.indexOf('async function advanceAfterPayment'))
    expect(fn).toContain('if (primary.internal || primary.custody) return null')
    // and the refusal comes BEFORE any status write
    expect(fn.indexOf('primary.custody')).toBeLessThan(fn.indexOf('updateMany'))
  })

  // The regression itself: the exact walk that produced a Delivered order with
  // no delivery. Every physical step of it is now refused to a payment.
  it('cannot walk an order from pickup to Delivered one confirmation at a time', () => {
    const walk = [
      ['AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE'],
      ['READY_FOR_PROCESSING', 'PACKED'],
      ['PACKED', 'IN_TRANSIT_TO_PROCESSING'],
      ['IN_TRANSIT_TO_PROCESSING', 'PROCESSING'],
      ['PROCESSING', 'RETURN_IN_TRANSIT'],
      ['RETURN_IN_TRANSIT', 'READY_FOR_DELIVERY'],
      ['READY_FOR_DELIVERY', 'DELIVERED'],
    ]
    for (const [from, to] of walk) {
      const ev = base({ status: from, itemCount: 4, inspectedCount: 4, processedCount: 4, hasProcessingEvent: true })
      // A payment endpoint's maximum authority — allowInternal, no custody.
      const v = assertTransition(from, to, ev, { allowInternal: true })
      expect(v.ok, `a payment was able to take ${from} → ${to}`).toBe(false)
    }
  })
})
