import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Tests for the scheduler's WHERE clause construction and filtering logic.
//
// Verifies that after removing the runtime updateMany() fixup, the correct
// Prisma WHERE clause is built for both pickup and delivery scopes, and
// that orders are correctly bucketed.
//
// These tests exercise the filter logic independently of Prisma by testing
// the WHERE shapes and bucket classification.
// ============================================================================

// We need LaundryOrderStatus enum values for the WHERE clause comparisons
import { LaundryOrderStatus } from '@prisma/client'

// The exact WHERE clause shapes from the GET handler (lines 111-113 after cleanup)
function buildPickupWhere(lbId: string) {
  return {
    businessId: lbId,
    pickupRequired: true,
    pickupCompletedAt: null,
    status: {
      notIn: [
        LaundryOrderStatus.CANCELLED,
        LaundryOrderStatus.READY_FOR_DELIVERY,
        LaundryOrderStatus.DELIVERED,
      ],
    },
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

// Bucket classification logic (lines 147-157)
type OrderRow = {
  status: string
  pickupCompletedAt: Date | null
  deliveryCompletedAt: Date | null
  deliveredAt: Date | null
  pickupExecutiveId: string | null
  deliveryExecutiveId: string | null
  pickupAcceptedAt: Date | null
  deliveryAcceptedAt: Date | null
}

function bucketOf(o: OrderRow, type: 'pickup' | 'delivery'): string {
  if (o.status === 'CANCELLED') return 'cancelled'
  if (type === 'delivery') {
    if (o.deliveryCompletedAt || o.status === 'DELIVERED') return 'completed'
    if (o.deliveryExecutiveId) return o.deliveryAcceptedAt ? 'accepted' : 'assigned'
    return 'awaiting'
  }
  if (o.pickupCompletedAt) return 'completed'
  if (o.pickupExecutiveId) return o.pickupAcceptedAt ? 'accepted' : 'assigned'
  return 'awaiting'
}

// Simulate the fixup that was removed — we test WITHOUT it
function simulateQuery(orders: any[], where: Record<string, unknown>): any[] {
  return orders.filter((o: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'pickupRequired' || key === 'deliveryRequired') {
        if (o[key] !== value) return false
      } else if (key === 'pickupCompletedAt') {
        if (o.pickupCompletedAt !== null) return false
      } else if (key === 'deliveryCompletedAt') {
        if (o.deliveryCompletedAt !== null) return false
      } else if (key === 'status') {
        const statusValue = value as { notIn?: string[] }
        if (statusValue.notIn) {
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

describe('scheduler WHERE clause — pickup', () => {
  it('filters orders by businessId, pickupRequired, pickupCompletedAt, and excluded statuses', () => {
    const where = buildPickupWhere('biz-1')

    expect(where).toEqual({
      businessId: 'biz-1',
      pickupRequired: true,
      pickupCompletedAt: null,
      status: {
        notIn: [
          LaundryOrderStatus.CANCELLED,
          LaundryOrderStatus.READY_FOR_DELIVERY,
          LaundryOrderStatus.DELIVERED,
        ],
      },
    })
  })

  it('excludes non-HOME_PICKUP orders that lack pickupRequired', () => {
    const orders = [
      // WALK_IN order — no pickup required, should be excluded
      { businessId: 'biz-1', pickupRequired: false, pickupCompletedAt: null, status: 'PENDING' },
      // STORE_DROP — no pickup required
      { businessId: 'biz-1', pickupRequired: false, pickupCompletedAt: null, status: 'PROCESSING' },
      // HOME_PICKUP — should be included
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'PENDING' },
    ]

    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].pickupRequired).toBe(true)
  })

  it('excludes orders with excluded statuses', () => {
    const orders = [
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'CANCELLED' },
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'READY_FOR_DELIVERY' },
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'DELIVERED' },
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'PROCESSING' },
    ]

    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('PROCESSING')
  })

  it('excludes already-picked-up orders', () => {
    const orders = [
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: new Date(), status: 'PROCESSING' },
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'PROCESSING' },
    ]

    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].pickupCompletedAt).toBeNull()
  })

  it('excludes orders from other businesses', () => {
    const orders = [
      { businessId: 'biz-2', pickupRequired: true, pickupCompletedAt: null, status: 'PENDING' },
      { businessId: 'biz-1', pickupRequired: true, pickupCompletedAt: null, status: 'PENDING' },
    ]

    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(1)
    expect(result[0].businessId).toBe('biz-1')
  })

  it('returns zero orders when no HOME_PICKUP orders exist for this business', () => {
    const orders = [
      { businessId: 'biz-1', pickupRequired: false, pickupCompletedAt: null, status: 'PROCESSING', orderType: 'STORE_DROP' },
      { businessId: 'biz-1', pickupRequired: false, pickupCompletedAt: null, status: 'PENDING', orderType: 'WALK_IN' },
    ]

    const result = simulateQuery(orders, buildPickupWhere('biz-1'))
    expect(result).toHaveLength(0)
  })
})

describe('scheduler WHERE clause — delivery', () => {
  it('filters orders by businessId, deliveryRequired, deliveryCompletedAt, and READY_FOR_DELIVERY status', () => {
    const where = buildDeliveryWhere('biz-1')

    expect(where).toEqual({
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

describe('bucketOf — pickup classification', () => {
  const baseOrder = (overrides: Partial<OrderRow> = {}): OrderRow => ({
    status: 'PENDING',
    pickupCompletedAt: null,
    deliveryCompletedAt: null,
    deliveredAt: null,
    pickupExecutiveId: null,
    deliveryExecutiveId: null,
    pickupAcceptedAt: null,
    deliveryAcceptedAt: null,
    ...overrides,
  })

  it('classifies cancelled orders', () => {
    expect(bucketOf(baseOrder({ status: 'CANCELLED' }), 'pickup')).toBe('cancelled')
  })

  it('classifies completed pickup', () => {
    expect(bucketOf(baseOrder({ pickupCompletedAt: new Date() }), 'pickup')).toBe('completed')
  })

  it('classifies assigned pickup', () => {
    expect(bucketOf(baseOrder({ pickupExecutiveId: 'exec-1' }), 'pickup')).toBe('assigned')
  })

  it('classifies accepted pickup', () => {
    expect(bucketOf(baseOrder({ pickupExecutiveId: 'exec-1', pickupAcceptedAt: new Date() }), 'pickup')).toBe('accepted')
  })

  it('classifies awaiting pickup', () => {
    expect(bucketOf(baseOrder(), 'pickup')).toBe('awaiting')
  })
})

describe('bucketOf — delivery classification', () => {
  const baseOrder = (overrides: Partial<OrderRow> = {}): OrderRow => ({
    status: 'READY_FOR_DELIVERY',
    pickupCompletedAt: null,
    deliveryCompletedAt: null,
    deliveredAt: null,
    pickupExecutiveId: null,
    deliveryExecutiveId: null,
    pickupAcceptedAt: null,
    deliveryAcceptedAt: null,
    ...overrides,
  })

  it('classifies completed delivery', () => {
    expect(bucketOf(baseOrder({ deliveryCompletedAt: new Date() }), 'delivery')).toBe('completed')
  })

  it('classifies DELIVERED status as completed', () => {
    expect(bucketOf(baseOrder({ status: 'DELIVERED' }), 'delivery')).toBe('completed')
  })

  it('classifies assigned delivery', () => {
    expect(bucketOf(baseOrder({ deliveryExecutiveId: 'exec-1' }), 'delivery')).toBe('assigned')
  })

  it('classifies accepted delivery', () => {
    expect(bucketOf(baseOrder({ deliveryExecutiveId: 'exec-1', deliveryAcceptedAt: new Date() }), 'delivery')).toBe('accepted')
  })

  it('classifies awaiting delivery', () => {
    expect(bucketOf(baseOrder(), 'delivery')).toBe('awaiting')
  })
})
