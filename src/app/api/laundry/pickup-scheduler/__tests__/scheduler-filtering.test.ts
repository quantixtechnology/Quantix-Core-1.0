import { describe, it, expect } from 'vitest'
import { LaundryOrderStatus } from '@prisma/client'
import { dispatchBucketOf, PICKUP_QUEUE_STATUSES, buildDispatchQueueWhere, dispatchDateRangeForPreset, type DispatchOrderView } from '@/lib/laundry-dispatch'

// ============================================================================
// Tests for the scheduler's WHERE clause construction and bucketing.
//
// SINGLE SOURCE OF TRUTH: the pickup queue is driven by LaundryOrder.status
// (PICKUP_QUEUE_STATUSES), NOT by pickupCompletedAt. This is the fix for the
// desync where a completed/in-transit pickup vanished from Dispatch because the
// query filtered `pickupCompletedAt: null`. The bucket logic is imported from
// the shared module so the route and these tests can never drift apart.
// ============================================================================

// The exact WHERE clause shapes from the GET handler.
function buildPickupWhere(lbId: string) {
  return {
    businessId: lbId,
    pickupRequired: true,
    status: { in: PICKUP_QUEUE_STATUSES },
  }
}

function buildDeliveryWhere(lbId: string) {
  return {
    businessId: lbId,
    deliveryRequired: true,
    deliveryCompletedAt: null,
    status: LaundryOrderStatus.READY_FOR_DELIVERY,
  }
}

// Simulate the Prisma query filtering for the shapes above.
function simulateQuery(orders: any[], where: Record<string, unknown>): any[] {
  return orders.filter((o: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'pickupRequired' || key === 'deliveryRequired') {
        if (o[key] !== value) return false
      } else if (key === 'deliveryCompletedAt') {
        if (o.deliveryCompletedAt !== null) return false
      } else if (key === 'status') {
        const statusValue = value as { in?: string[]; notIn?: string[] }
        if (statusValue.in) {
          if (!statusValue.in.includes(o.status as string)) return false
        } else if (statusValue.notIn) {
          if (statusValue.notIn.includes(o.status as string)) return false
        } else if (o.status !== value) {
          return false
        }
      } else if (key === 'businessId') {
        if (o.businessId !== value) return false
      }
    }
    return true
  })
}

describe('scheduler WHERE clause — pickup (status-driven)', () => {
  it('selects orders by businessId, pickupRequired, and pickup-queue statuses', () => {
    expect(buildPickupWhere('biz-1')).toEqual({
      businessId: 'biz-1',
      pickupRequired: true,
      status: { in: [LaundryOrderStatus.AWAITING_PICKUP_ASSIGNMENT, LaundryOrderStatus.IN_TRANSIT_TO_STORE] },
    })
  })

  it('excludes non-HOME_PICKUP orders that lack pickupRequired', () => {
    const orders = [
      { businessId: 'biz-1', pickupRequired: false, status: 'AWAITING_PICKUP_ASSIGNMENT' },
      { businessId: 'biz-1', pickupRequired: true, status: 'AWAITING_PICKUP_ASSIGNMENT' },
    ]
    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].pickupRequired).toBe(true)
  })

  it('KEEPS in-transit (picked-up) orders in the queue — the desync fix', () => {
    const orders = [
      // Picked up, in transit to store — MUST stay visible (pending store receipt).
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: new Date(), status: 'IN_TRANSIT_TO_STORE' },
      // Awaiting assignment — visible.
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'AWAITING_PICKUP_ASSIGNMENT' },
    ]
    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(2)
  })

  it('drops orders once the store has received them (PENDING_STORE_AUDIT leaves the queue)', () => {
    const orders = [
      { businessId: 'biz-1', pickupRequired: true, status: 'PENDING_STORE_AUDIT' },
      { businessId: 'biz-1', pickupRequired: true, status: 'PROCESSING' },
      { businessId: 'biz-1', pickupRequired: true, status: 'IN_TRANSIT_TO_STORE' },
    ]
    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('IN_TRANSIT_TO_STORE')
  })

  it('excludes orders from other businesses', () => {
    const orders = [
      { businessId: 'biz-2', pickupRequired: true, status: 'AWAITING_PICKUP_ASSIGNMENT' },
      { businessId: 'biz-1', pickupRequired: true, status: 'AWAITING_PICKUP_ASSIGNMENT' },
    ]
    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].businessId).toBe('biz-1')
  })
})

describe('scheduler WHERE clause — delivery', () => {
  it('filters by businessId, deliveryRequired, deliveryCompletedAt, and READY_FOR_DELIVERY', () => {
    expect(buildDeliveryWhere('biz-1')).toEqual({
      businessId: 'biz-1',
      deliveryRequired: true,
      deliveryCompletedAt: null,
      status: LaundryOrderStatus.READY_FOR_DELIVERY,
    })
  })

  it('excludes non-READY_FOR_DELIVERY orders', () => {
    const orders = [
      { businessId: 'biz-1', deliveryRequired: true, deliveryCompletedAt: null, status: 'PROCESSING' },
      { businessId: 'biz-1', deliveryRequired: true, deliveryCompletedAt: null, status: 'READY_FOR_DELIVERY' },
    ]
    const result = simulateQuery(orders, buildDeliveryWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('READY_FOR_DELIVERY')
  })
})

describe('dispatchBucketOf — pickup classification (status-driven)', () => {
  const baseOrder = (overrides: Partial<DispatchOrderView> = {}): DispatchOrderView => ({
    status: 'AWAITING_PICKUP_ASSIGNMENT',
    pickupCompletedAt: null,
    deliveryCompletedAt: null,
    pickupExecutiveId: null,
    deliveryExecutiveId: null,
    pickupAcceptedAt: null,
    deliveryAcceptedAt: null,
    ...overrides,
  })

  it('classifies cancelled orders', () => {
    expect(dispatchBucketOf(baseOrder({ status: 'CANCELLED' }), 'pickup')).toBe('cancelled')
  })
  it('classifies in-transit pickup as pending_receipt', () => {
    expect(dispatchBucketOf(baseOrder({ status: 'IN_TRANSIT_TO_STORE', pickupCompletedAt: new Date() }), 'pickup')).toBe('pending_receipt')
  })
  it('classifies legacy completed-but-awaiting pickup as pending_receipt (never lost)', () => {
    expect(dispatchBucketOf(baseOrder({ pickupCompletedAt: new Date() }), 'pickup')).toBe('pending_receipt')
  })
  it('classifies assigned pickup', () => {
    expect(dispatchBucketOf(baseOrder({ pickupExecutiveId: 'exec-1' }), 'pickup')).toBe('assigned')
  })
  it('classifies accepted pickup', () => {
    expect(dispatchBucketOf(baseOrder({ pickupExecutiveId: 'exec-1', pickupAcceptedAt: new Date() }), 'pickup')).toBe('accepted')
  })
  it('classifies awaiting pickup', () => {
    expect(dispatchBucketOf(baseOrder(), 'pickup')).toBe('awaiting')
  })
  it('classifies a RECEIVED pickup (past the queue) as completed — so the Completed bucket works', () => {
    expect(dispatchBucketOf(baseOrder({ status: 'PENDING_STORE_AUDIT', pickupCompletedAt: new Date() }), 'pickup')).toBe('completed')
    expect(dispatchBucketOf(baseOrder({ status: 'PROCESSING', pickupCompletedAt: new Date() }), 'pickup')).toBe('completed')
  })
})

describe('dispatchBucketOf — delivery classification', () => {
  const baseOrder = (overrides: Partial<DispatchOrderView> = {}): DispatchOrderView => ({
    status: 'READY_FOR_DELIVERY',
    pickupCompletedAt: null,
    deliveryCompletedAt: null,
    pickupExecutiveId: null,
    deliveryExecutiveId: null,
    pickupAcceptedAt: null,
    deliveryAcceptedAt: null,
    ...overrides,
  })

  it('classifies completed delivery', () => {
    expect(dispatchBucketOf(baseOrder({ deliveryCompletedAt: new Date() }), 'delivery')).toBe('completed')
  })
  it('classifies DELIVERED status as completed', () => {
    expect(dispatchBucketOf(baseOrder({ status: 'DELIVERED' }), 'delivery')).toBe('completed')
  })
  it('classifies assigned delivery', () => {
    expect(dispatchBucketOf(baseOrder({ deliveryExecutiveId: 'exec-1' }), 'delivery')).toBe('assigned')
  })
  it('classifies accepted delivery', () => {
    expect(dispatchBucketOf(baseOrder({ deliveryExecutiveId: 'exec-1', deliveryAcceptedAt: new Date() }), 'delivery')).toBe('accepted')
  })
  it('classifies awaiting delivery', () => {
    expect(dispatchBucketOf(baseOrder(), 'delivery')).toBe('awaiting')
  })
})

// ── Date-ranged live board (buildDispatchQueueWhere) ─────────────────────────
// The Dispatch Center board supports Today / Yesterday / Last 7 Days / Upcoming /
// Custom. "today" must reproduce the legacy query EXACTLY; every other preset
// filters pending jobs by scheduled date and completed jobs by completion time.

const NOW = new Date('2026-08-05T10:00:00.000Z') // fixed "now" for determinism

// Local-timezone-agnostic day arithmetic — mirrors the range helpers (which use
// local setHours(0,0,0,0) boundaries, matching the legacy query). Tests pass on
// any host timezone (deployed servers run UTC, dev machines run IST).
const localMidnight = (d: Date) => { const s = new Date(d); s.setHours(0, 0, 0, 0); return s }
const addDays = (d: Date, n: number) => { const e = new Date(d); e.setDate(e.getDate() + n); return e }
const plusHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600 * 1000)
const TODAY = localMidnight(NOW)
const YESTERDAY = addDays(TODAY, -1)
const TOMORROW = addDays(TODAY, 1)

function simulate(orders: any[], where: Record<string, unknown>): any[] {
  return orders.filter((o) => matchesWhere(o, where))
}

function matchesWhere(o: Record<string, unknown>, w: Record<string, unknown>): boolean {
  return Object.entries(w).every(([key, value]) => {
    if (key === 'OR') return (value as Record<string, unknown>[]).some((sub) => matchesWhere(o, sub))
    if (key === 'AND') return (value as Record<string, unknown>[]).every((sub) => matchesWhere(o, sub))
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const op = value as Record<string, unknown>
      if ('in' in op) return (op.in as unknown[]).includes(o[key])
      if (op.gte !== undefined || op.lte !== undefined || op.lt !== undefined) {
        const t = o[key] == null ? null : new Date(o[key] as Date).getTime()
        if (t == null) return false
        if (op.gte !== undefined && t < new Date(op.gte as Date).getTime()) return false
        if (op.lt !== undefined && t >= new Date(op.lt as Date).getTime()) return false
        if (op.lte !== undefined && t > new Date(op.lte as Date).getTime()) return false
        return true
      }
      return matchesWhere(o, value as Record<string, unknown>)
    }
    return o[key] === value
  })
}

const base = (overrides: Record<string, unknown> = {}) => ({
  businessId: 'lb-1', status: 'AWAITING_PICKUP_ASSIGNMENT',
  pickupRequired: true, deliveryRequired: false,
  pickupDate: TODAY, pickupCompletedAt: null,
  deliveryDate: null, expectedDeliveryDate: null, deliveryCompletedAt: null,
  ...overrides,
})

describe('buildDispatchQueueWhere — today reproduces the legacy query', () => {
  it('pickup: live queue statuses (any date) + today completions', () => {
    const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: 'today', now: NOW })
    expect(where).toEqual({
      businessId: 'lb-1',
      pickupRequired: true,
      OR: [
        { status: { in: [LaundryOrderStatus.AWAITING_PICKUP_ASSIGNMENT, LaundryOrderStatus.IN_TRANSIT_TO_STORE] } },
        { pickupCompletedAt: { gte: TODAY, lt: addDays(TODAY, 1) } },
      ],
    })
  })

  it('delivery: uncompleted READY_FOR_DELIVERY (any date) + today completions', () => {
    const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'delivery', preset: 'today', now: NOW })
    expect(where).toEqual({
      businessId: 'lb-1',
      deliveryRequired: true,
      OR: [
        { deliveryCompletedAt: null, status: LaundryOrderStatus.READY_FOR_DELIVERY },
        { deliveryCompletedAt: { gte: TODAY, lt: addDays(TODAY, 1) } },
      ],
    })
  })

  it('defaults to today when no preset is supplied', () => {
    const withPreset = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', now: NOW })
    const defaulted = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: '', now: NOW })
    expect(defaulted).toEqual(withPreset)
  })
})

describe('buildDispatchQueueWhere — yesterday shows previous field work', () => {
  const orders = [
    // Pending pickup scheduled yesterday — still manageable.
    base({ pickupDate: YESTERDAY }),
    // Pending pickup scheduled today — must NOT leak into yesterday.
    base({ pickupDate: TODAY }),
    // Pickup COMPLETED yesterday.
    base({ status: 'PENDING_STORE_AUDIT', pickupDate: addDays(TODAY, -2), pickupCompletedAt: plusHours(YESTERDAY, 1) }),
    // Pickup completed today — excluded.
    base({ status: 'PROCESSING', pickupCompletedAt: plusHours(TODAY, 1) }),
  ]
  const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: 'yesterday', now: NOW })
  const result = simulate(orders, where)
  it('keeps pending pickups scheduled yesterday (manageable)', () => {
    expect(result).toHaveLength(2)
    expect(result.some((o) => o.status === 'AWAITING_PICKUP_ASSIGNMENT' && o.pickupCompletedAt === null)).toBe(true)
  })
  it('shows yesterday completed pickups and drops today completions', () => {
    expect(result.some((o) => o.status === 'PENDING_STORE_AUDIT')).toBe(true)
    expect(result.some((o) => o.status === 'PROCESSING')).toBe(false)
  })
})

describe('buildDispatchQueueWhere — yesterday deliveries + missed deliveries', () => {
  const orders = [
    // Missed delivery — READY_FOR_DELIVERY, scheduled yesterday, never delivered.
    base({ status: LaundryOrderStatus.READY_FOR_DELIVERY, deliveryRequired: true, deliveryDate: YESTERDAY }),
    // Delivery completed yesterday.
    base({ status: 'DELIVERED', deliveryRequired: true, deliveryCompletedAt: plusHours(YESTERDAY, 2) }),
    // Pending delivery scheduled today — excluded.
    base({ status: LaundryOrderStatus.READY_FOR_DELIVERY, deliveryRequired: true, deliveryDate: TODAY }),
    // Undated pending delivery — excluded from a dated range.
    base({ status: LaundryOrderStatus.READY_FOR_DELIVERY, deliveryRequired: true }),
  ]
  const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'delivery', preset: 'yesterday', now: NOW })
  const result = simulate(orders, where)
  it('keeps missed deliveries accessible and manageable', () => {
    expect(result).toHaveLength(2)
    expect(result.some((o) => o.status === LaundryOrderStatus.READY_FOR_DELIVERY)).toBe(true)
  })
  it('shows yesterday completed deliveries, excludes today + undated', () => {
    expect(result.some((o) => o.status === 'DELIVERED')).toBe(true)
    expect(result.some((o) => o.deliveryDate && new Date(o.deliveryDate as Date).getTime() === TODAY.getTime())).toBe(false)
  })
})

describe('buildDispatchQueueWhere — delivery falls back to expectedDeliveryDate', () => {
  it('matches an undated-delivery order via expectedDeliveryDate', () => {
    const orders = [
      base({ status: LaundryOrderStatus.READY_FOR_DELIVERY, deliveryRequired: true, deliveryDate: null, expectedDeliveryDate: YESTERDAY }),
      base({ status: LaundryOrderStatus.READY_FOR_DELIVERY, deliveryRequired: true, deliveryDate: null, expectedDeliveryDate: TODAY }),
    ]
    const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'delivery', preset: 'yesterday', now: NOW })
    expect(simulate(orders, where)).toHaveLength(1)
  })
})

describe('buildDispatchQueueWhere — upcoming shows only future pending work', () => {
  const orders = [
    base({ pickupDate: TOMORROW }), // tomorrow — visible
    base({ pickupDate: TODAY }), // today — excluded
    base({ status: 'PENDING_STORE_AUDIT', pickupDate: TOMORROW, pickupCompletedAt: plusHours(TODAY, 1) }), // completed early — excluded
  ]
  const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: 'upcoming', now: NOW })
  const result = simulate(orders, where)
  it('keeps only pending jobs scheduled after today', () => {
    expect(result).toHaveLength(1)
    expect(result[0].pickupCompletedAt).toBeNull()
  })
})

describe('buildDispatchQueueWhere — custom range', () => {
  it('filters pickupDate within [from, to]', () => {
    const day = (d: number) => { const s = new Date(2026, 7, d, 0, 0, 0); return s }
    const orders = [
      base({ pickupDate: day(2) }), // Aug 2 — before range
      base({ pickupDate: day(3) }), // Aug 3 — in range
      base({ pickupDate: day(9) }), // Aug 9 — after range
    ]
    const where = buildDispatchQueueWhere({ businessId: 'lb-1', type: 'pickup', preset: 'custom', fromDate: '2026-08-03', toDate: '2026-08-08', now: NOW })
    expect(simulate(orders, where)).toHaveLength(1)
  })
})

describe('dispatchDateRangeForPreset', () => {
  it('today → [midnight, next midnight)', () => {
    const r = dispatchDateRangeForPreset('today', NOW)
    expect(r.start.getTime()).toBe(TODAY.getTime())
    expect(r.end!.getTime()).toBe(addDays(TODAY, 1).getTime())
  })
  it('yesterday → previous calendar day', () => {
    const r = dispatchDateRangeForPreset('yesterday', NOW)
    expect(r.start.getTime()).toBe(YESTERDAY.getTime())
    expect(r.end!.getTime()).toBe(TODAY.getTime())
  })
  it('upcoming → open-ended from tomorrow', () => {
    const r = dispatchDateRangeForPreset('upcoming', NOW)
    expect(r.start.getTime()).toBe(TOMORROW.getTime())
    expect(r.end).toBeNull()
  })
  it('custom → inclusive day window', () => {
    const r = dispatchDateRangeForPreset('custom', NOW, '2026-08-01', '2026-08-03')
    const s = new Date('2026-08-01'); s.setHours(0, 0, 0, 0)
    const e = new Date('2026-08-03'); e.setHours(23, 59, 59, 999)
    expect(r.start.getTime()).toBe(s.getTime())
    expect(r.end!.getTime()).toBe(e.getTime())
  })
})
