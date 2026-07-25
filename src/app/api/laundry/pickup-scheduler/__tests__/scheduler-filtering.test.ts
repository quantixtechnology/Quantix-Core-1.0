import { describe, it, expect } from 'vitest'
import { LaundryOrderStatus } from '@prisma/client'
import { dispatchBucketOf, PICKUP_QUEUE_STATUSES, type DispatchOrderView } from '@/lib/laundry-dispatch'

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
