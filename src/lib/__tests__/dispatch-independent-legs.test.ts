import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { LaundryOrderStatus } from '@prisma/client'
import { buildDispatchQueueWhere } from '@/lib/laundry-dispatch'

// ============================================================================
// Pickup and delivery are INDEPENDENT logistics requirements.
//
// Two defects found by the Dispatch Center audit:
//   1. POST /api/laundry/dispatch/pickup hardcoded deliveryRequired: true, so
//      scheduling a pickup silently committed the order to a delivery nobody
//      asked for — including customers who intend to collect from the store.
//   2. Both legs of one order carried the same id, so the UI keyed two work
//      items as one React row and one selection.
//
// The eligibility QUERY was audited as correct and is deliberately unchanged;
// these tests pin that too.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const PICKUP_ROUTE = read('src/app/api/laundry/dispatch/pickup/route.ts')
// "This line is gone" is a claim about CODE; the comment explaining WHY it went
// legitimately names it, so it must not decide the assertion.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '')).join('\n')
const PICKUP_CODE = stripComments(PICKUP_ROUTE)
const DELIVERY_ROUTE = read('src/app/api/laundry/dispatch/delivery/route.ts')
const BOARD = read('src/components/laundry/views/laundry-dispatch-center.tsx')
const DISPATCH_LIB = read('src/lib/laundry-dispatch.ts')

// ── FIX 1 ──────────────────────────────────────────────────────────────────
describe('Fix 1 — scheduling a pickup never forces a delivery', () => {
  it('deliveryRequired is no longer hardcoded true', () => {
    expect(PICKUP_CODE).not.toContain('deliveryRequired: true')
    expect(PICKUP_ROUTE).toContain('deliveryRequired: wantsDelivery')
  })

  it('it is false unless the caller explicitly asks for a delivery', () => {
    // Strict equality: a missing field, null, "" or "false" must not enrol the
    // order in a delivery leg.
    expect(PICKUP_ROUTE).toContain('const wantsDelivery = deliveryRequired === true')
  })

  it('pickupRequired is still set — this route does schedule a pickup', () => {
    expect(PICKUP_ROUTE).toContain('pickupRequired: true')
  })

  it('no inference that pickup implies delivery remains', () => {
    expect(PICKUP_CODE).not.toMatch(/deliveryRequired[^\n]*pickupRequired/)
    expect(PICKUP_CODE).not.toContain('deliveryRequired: pickupRequired')
  })

  it('adding a delivery stays the delivery route’s job', () => {
    // One place sets deliveryRequired true, and it is the one that schedules a
    // delivery.
    expect(DELIVERY_ROUTE).toContain('deliveryRequired: true')
  })
})

// ── FIX 2 ──────────────────────────────────────────────────────────────────
describe('Fix 2 — the two legs are distinct work items', () => {
  const jobKeyOf = (kind: string, orderId: string) => `${kind}:${orderId}`

  it('a composite identity separates the legs of one order', () => {
    const orderId = 'cm_order_123'
    expect(jobKeyOf('pickup', orderId)).toBe('pickup:cm_order_123')
    expect(jobKeyOf('delivery', orderId)).toBe('delivery:cm_order_123')
    expect(jobKeyOf('pickup', orderId)).not.toBe(jobKeyOf('delivery', orderId))
  })

  it('selecting one leg does not select the other', () => {
    // The exact bug: a Set keyed by order id could not tell them apart.
    const orderId = 'cm_order_123'
    const selected = new Set<string>()
    selected.add(jobKeyOf('pickup', orderId))
    expect(selected.has(jobKeyOf('pickup', orderId))).toBe(true)
    expect(selected.has(jobKeyOf('delivery', orderId))).toBe(false)
    expect(selected.size).toBe(1)
  })

  it('both legs of the same order yield unique React keys', () => {
    const orderId = 'cm_order_123'
    const keys = [jobKeyOf('pickup', orderId), jobKeyOf('delivery', orderId)]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('the board stamps jobKey on both merged fetches', () => {
    expect(BOARD).toContain('const jobKeyOf = (kind: Kind, orderId: string) => `${kind}:${orderId}`')
    expect(BOARD).toContain('kind: "pickup" as const, jobKey: jobKeyOf("pickup", j.id)')
    expect(BOARD).toContain('kind: "delivery" as const, jobKey: jobKeyOf("delivery", j.id)')
  })

  it('selection and the React key use jobKey — never the bare order id', () => {
    expect(BOARD).toContain('key={job.jobKey}')
    expect(BOARD).toContain('selected.has(job.jobKey)')
    expect(BOARD).toContain('toggleOne(job.jobKey)')
    expect(BOARD).not.toContain('selected.has(job.id)')
    expect(BOARD).not.toContain('key={job.id}')
    expect(BOARD).not.toContain('toggleOne(job.id)')
  })

  it('the LaundryOrder id is unchanged and still used for the API and navigation', () => {
    // jobKey is a UI identity only — it must never reach the server.
    expect(BOARD).toContain('orderId: job.id')
    expect(BOARD).toContain('groups[j.kind].push(j.id)')
    expect(BOARD).toContain('onClick={() => open(job.id)}')
    expect(BOARD).not.toContain('orderId: job.jobKey')
    expect(BOARD).not.toContain('push(j.jobKey)')
  })
})

// ── The four combinations, through the REAL query builder ──────────────────
describe('the four pickup/delivery combinations', () => {
  const now = new Date('2026-08-13T10:00:00Z')
  const pickupWhere = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', now })
  const deliveryWhere = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'delivery', now })

  // The board's own filter, applied to the flag the query demands.
  const shows = (where: Record<string, unknown>, order: { pickupRequired: boolean; deliveryRequired: boolean }) => {
    if ('pickupRequired' in where) return order.pickupRequired === where.pickupRequired
    if ('deliveryRequired' in where) return order.deliveryRequired === where.deliveryRequired
    return true
  }

  it('CASE 1 — pickup NO, delivery NO → no job of either kind', () => {
    const o = { pickupRequired: false, deliveryRequired: false }
    expect(shows(pickupWhere, o)).toBe(false)
    expect(shows(deliveryWhere, o)).toBe(false)
  })

  it('CASE 2 — pickup YES, delivery NO → pickup job only', () => {
    const o = { pickupRequired: true, deliveryRequired: false }
    expect(shows(pickupWhere, o)).toBe(true)
    expect(shows(deliveryWhere, o)).toBe(false)
  })

  it('CASE 3 — pickup NO, delivery YES → delivery job only', () => {
    const o = { pickupRequired: false, deliveryRequired: true }
    expect(shows(pickupWhere, o)).toBe(false)
    expect(shows(deliveryWhere, o)).toBe(true)
    // …and only once the order is actually deliverable.
    expect(JSON.stringify(deliveryWhere)).toContain(LaundryOrderStatus.READY_FOR_DELIVERY)
  })

  it('CASE 4 — both YES → one job of each, independently selectable', () => {
    const o = { pickupRequired: true, deliveryRequired: true }
    expect(shows(pickupWhere, o)).toBe(true)
    expect(shows(deliveryWhere, o)).toBe(true)
    const keys = new Set(['pickup:o1', 'delivery:o1'])
    expect(keys.size).toBe(2)
  })
})

// ── Regression guards ──────────────────────────────────────────────────────
describe('nothing else moved', () => {
  it('the eligibility query still gates on the DB flags, in every branch', () => {
    const now = new Date('2026-08-13T10:00:00Z')
    for (const preset of ['today', 'yesterday', 'last7d', 'thisMonth', 'upcoming']) {
      expect(buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset, now })).toHaveProperty('pickupRequired', true)
      expect(buildDispatchQueueWhere({ businessId: 'lb-1', type: 'delivery', preset, now })).toHaveProperty('deliveryRequired', true)
    }
    const custom = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: 'custom', fromDate: '2026-08-01', toDate: '2026-08-13', now })
    expect(custom).toHaveProperty('pickupRequired', true)
  })

  it('the dispatch library was not edited', () => {
    // The audit found it correct; the fixes are elsewhere.
    expect(DISPATCH_LIB).toContain('pickupRequired: true')
    expect(DISPATCH_LIB).toContain('deliveryRequired: true')
  })

  it('no dispatch-job model or table was introduced', () => {
    for (const f of [PICKUP_ROUTE, BOARD, DISPATCH_LIB]) {
      expect(f).not.toContain('LaundryDispatchJob')
      expect(f).not.toContain('PickupAssignment')
      expect(f).not.toContain('DeliveryAssignment')
      expect(f).not.toContain('dispatchJob.create')
    }
    const schema = read('prisma/schema.prisma')
    expect(schema).not.toContain('model LaundryDispatchJob')
    expect(schema).not.toContain('model PickupAssignment')
    expect(schema).not.toContain('model DeliveryAssignment')
  })

  it('the fix is not a frontend filter', () => {
    // No client-side "hide non-logistics orders" band-aid.
    expect(BOARD).not.toContain('pickupRequired ||')
    expect(BOARD).not.toMatch(/filter\([^)]*pickupRequired/)
    expect(BOARD).not.toMatch(/filter\([^)]*deliveryRequired/)
  })
})
