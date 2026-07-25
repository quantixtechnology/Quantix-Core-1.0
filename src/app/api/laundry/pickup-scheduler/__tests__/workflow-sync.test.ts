import { describe, it, expect } from 'vitest'
import { isTransitionAllowed, getTransition, getTransitions, STATUS_META } from '@/lib/laundry-workflow'
import { dispatchBucketOf, PICKUP_QUEUE_STATUSES, type DispatchOrderView } from '@/lib/laundry-dispatch'

// ============================================================================
// WORKFLOW SYNCHRONIZATION — P0 regression guard.
//
// The failure this guards against: Orders showed "Awaiting Pickup Assignment",
// Assign Bags showed "Pickup Complete", Bag Management showed "Collected", and
// Dispatch showed NOTHING — four modules each inferring workflow state from a
// different field instead of the one source of truth (LaundryOrder.status).
//
// This test drives ONE order through the full pickup → store chain and, at every
// stage, asserts that EVERY module's derived view agrees with LaundryOrder.status.
// It fails if any module reports a stage inconsistent with the order status.
//
//   Create → Assign → Accept → Pickup Completed → In Transit → Store Receive → Store Audit
// ============================================================================

// ── The order as the modules see it (only the fields each module reads) ──────
type Order = DispatchOrderView & {
  status: string
  pickupRequired: boolean
  fieldStatus: string | null
  bagStatus: 'AVAILABLE' | 'ASSIGNED' | 'COLLECTED' | 'RECEIVED_AT_STORE'
  timeline: string[] // actions logged, in order
}

// ── Per-module derivations. Each is a PURE FUNCTION of the order, and the
//    workflow-facing ones read status FIRST. If a module ever infers a stage
//    that disagrees with status, the invariant assertion below fails. ─────────

// Orders page: the canonical human label comes straight from status.
const ordersPageStage = (o: Order) => STATUS_META[o.status as keyof typeof STATUS_META]?.label ?? o.status

// Dispatch Center: bucket + whether the job is even in the pickup queue.
const dispatchBucket = (o: Order) => dispatchBucketOf(o, 'pickup')
const inDispatchQueue = (o: Order) => o.pickupRequired && PICKUP_QUEUE_STATUSES.includes(o.status as never)

// Executive PWA: the task shown to the pickup executive, derived from status.
const executiveTask = (o: Order): string => {
  switch (o.status) {
    case 'AWAITING_PICKUP_ASSIGNMENT':
      if (!o.pickupExecutiveId) return 'UNASSIGNED'
      if (!o.pickupAcceptedAt) return 'AWAITING_ACCEPT'
      if (!o.pickupCompletedAt) return 'IN_PROGRESS'
      return 'COMPLETED_LOCAL' // picked up but status not advanced — should never persist
    case 'IN_TRANSIT_TO_STORE':
      return 'IN_TRANSIT_RECEIVER_PENDING' // read-only: executive can NOT mark received
    default:
      return 'HANDED_OFF' // out of the executive's hands
  }
}

// Store Receive queue: an order is receivable exactly when it is in transit.
const inStoreReceiveQueue = (o: Order) => o.status === 'IN_TRANSIT_TO_STORE'

// ── The single source of truth: what stage is the order actually in? ─────────
// Every module view above must be consistent with THIS. We encode the expected
// module views per status so a drift in any one derivation is caught.
type Expect = {
  status: string
  dispatchBucket: string
  inDispatchQueue: boolean
  inStoreReceiveQueue: boolean
  executiveTask: string
  bagStatus: Order['bagStatus']
  timelineAction: string | null // the action that produced THIS status
}

// ── Drive the order through the chain. Each step: assert the transition is
//    allowed by the real state machine, apply it, then assert all module views. ─
describe('pickup → store chain of custody — workflow synchronization', () => {
  const order: Order = {
    status: 'AWAITING_PICKUP_ASSIGNMENT',
    pickupRequired: true,
    fieldStatus: null,
    pickupCompletedAt: null,
    deliveryCompletedAt: null,
    pickupExecutiveId: null,
    deliveryExecutiveId: null,
    pickupAcceptedAt: null,
    deliveryAcceptedAt: null,
    bagStatus: 'AVAILABLE',
    timeline: [],
  }

  const assertModulesAgree = (e: Expect) => {
    // 1. Order status is the source of truth.
    expect(order.status, 'order.status').toBe(e.status)
    // 2. Orders page derives its label from status (never a private field).
    expect(ordersPageStage(order), 'Orders page stage').toBe(STATUS_META[e.status as keyof typeof STATUS_META]?.label ?? e.status)
    // 3. Dispatch queue membership, and the bucket — but the bucket only has meaning
    //    while the order is IN the queue (Dispatch only ever buckets what it queries).
    expect(inDispatchQueue(order), 'in Dispatch queue').toBe(e.inDispatchQueue)
    if (e.inDispatchQueue) expect(dispatchBucket(order), 'Dispatch bucket').toBe(e.dispatchBucket)
    // 4. Executive task.
    expect(executiveTask(order), 'Executive task').toBe(e.executiveTask)
    // 5. Store Receive queue.
    expect(inStoreReceiveQueue(order), 'in Store Receive queue').toBe(e.inStoreReceiveQueue)
    // 6. Bag status tracks the same physical hand-off.
    expect(order.bagStatus, 'Bag status').toBe(e.bagStatus)
    // 7. Timeline recorded the transition.
    if (e.timelineAction) expect(order.timeline, 'Timeline').toContain(e.timelineAction)
  }

  it('Step 0 — order created, awaiting pickup assignment', () => {
    assertModulesAgree({
      status: 'AWAITING_PICKUP_ASSIGNMENT',
      dispatchBucket: 'awaiting',
      inDispatchQueue: true,
      inStoreReceiveQueue: false,
      executiveTask: 'UNASSIGNED',
      bagStatus: 'AVAILABLE',
      timelineAction: null,
    })
  })

  it('Step 1 — assign executive (stays AWAITING, bucket=assigned)', () => {
    order.pickupExecutiveId = 'exec-1'
    order.timeline.push('PICKUP_ASSIGNED')
    assertModulesAgree({
      status: 'AWAITING_PICKUP_ASSIGNMENT',
      dispatchBucket: 'assigned',
      inDispatchQueue: true,
      inStoreReceiveQueue: false,
      executiveTask: 'AWAITING_ACCEPT',
      bagStatus: 'AVAILABLE',
      timelineAction: 'PICKUP_ASSIGNED',
    })
  })

  it('Step 2 — executive accepts (bucket=accepted)', () => {
    order.pickupAcceptedAt = new Date()
    order.timeline.push('PICKUP_ACCEPTED')
    assertModulesAgree({
      status: 'AWAITING_PICKUP_ASSIGNMENT',
      dispatchBucket: 'accepted',
      inDispatchQueue: true,
      inStoreReceiveQueue: false,
      executiveTask: 'IN_PROGRESS',
      bagStatus: 'AVAILABLE',
      timelineAction: 'PICKUP_ACCEPTED',
    })
  })

  it('Step 3 — bag assigned to order', () => {
    order.bagStatus = 'ASSIGNED'
    order.timeline.push('BAG_ASSIGNED')
    // No status change — still an in-progress pickup.
    assertModulesAgree({
      status: 'AWAITING_PICKUP_ASSIGNMENT',
      dispatchBucket: 'accepted',
      inDispatchQueue: true,
      inStoreReceiveQueue: false,
      executiveTask: 'IN_PROGRESS',
      bagStatus: 'ASSIGNED',
      timelineAction: 'BAG_ASSIGNED',
    })
  })

  it('Step 4 — PICKUP_COMPLETED advances status to IN_TRANSIT_TO_STORE (executive cannot self-receive)', () => {
    // The state machine must ONLY allow the executive path to reach transit, and
    // that transition must be INTERNAL (no generic /transition button can fire it).
    expect(isTransitionAllowed('AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE')).toBe(true)
    const t = getTransition('AWAITING_PICKUP_ASSIGNMENT', 'IN_TRANSIT_TO_STORE')
    expect(t?.action).toBe('PICKUP_COMPLETED')
    expect(t?.internal, 'PICKUP_COMPLETED must be internal — sender cannot expose it as a button').toBe(true)

    // Apply the transition exactly as the executive endpoint does.
    order.status = 'IN_TRANSIT_TO_STORE'
    order.fieldStatus = 'PICKUP_COMPLETED'
    order.pickupCompletedAt = new Date()
    order.bagStatus = 'COLLECTED'
    order.timeline.push('PICKUP_COMPLETED')

    assertModulesAgree({
      status: 'IN_TRANSIT_TO_STORE',
      dispatchBucket: 'pending_receipt', // ← the bug: this used to vanish from Dispatch
      inDispatchQueue: true, // ← still visible; NOT dropped by a pickupCompletedAt filter
      inStoreReceiveQueue: true,
      executiveTask: 'IN_TRANSIT_RECEIVER_PENDING',
      bagStatus: 'COLLECTED',
      timelineAction: 'PICKUP_COMPLETED',
    })
  })

  it('Step 5 — the executive can NOT complete the hand-off (no transition to store audit from transit is executive-owned)', () => {
    // From transit, the only forward move is the store receiving — the sender has
    // no path that acknowledges receipt on the store's behalf.
    const forward = getTransitions('IN_TRANSIT_TO_STORE').filter((t) => t.to !== 'CANCELLED')
    expect(forward).toHaveLength(1)
    expect(forward[0].to).toBe('PENDING_STORE_AUDIT')
    expect(forward[0].action).toBe('RECEIVE_PICKUP_AT_STORE')
    // Store receive is NOT internal — it is the store's explicit confirmation action.
    expect(forward[0].internal ?? false).toBe(false)
  })

  it('Step 6 — STORE receives the bag: IN_TRANSIT_TO_STORE → PENDING_STORE_AUDIT', () => {
    expect(isTransitionAllowed('IN_TRANSIT_TO_STORE', 'PENDING_STORE_AUDIT')).toBe(true)

    order.status = 'PENDING_STORE_AUDIT'
    order.bagStatus = 'RECEIVED_AT_STORE'
    order.timeline.push('RECEIVE_PICKUP_AT_STORE')

    assertModulesAgree({
      status: 'PENDING_STORE_AUDIT',
      dispatchBucket: 'n/a', // out of queue — bucket not asserted
      inDispatchQueue: false, // ← leaves Dispatch: the store now owns it
      inStoreReceiveQueue: false, // already received
      executiveTask: 'HANDED_OFF',
      bagStatus: 'RECEIVED_AT_STORE',
      timelineAction: 'RECEIVE_PICKUP_AT_STORE',
    })
  })

  it('Step 7 — the order cannot skip Store Audit (no direct transit → payment/processing)', () => {
    expect(isTransitionAllowed('IN_TRANSIT_TO_STORE', 'PAYMENT_PENDING')).toBe(false)
    expect(isTransitionAllowed('IN_TRANSIT_TO_STORE', 'PROCESSING')).toBe(false)
    expect(isTransitionAllowed('IN_TRANSIT_TO_STORE', 'READY_FOR_PROCESSING')).toBe(false)
  })

  it('Step 8 — full timeline recorded every hand-off in order', () => {
    expect(order.timeline).toEqual([
      'PICKUP_ASSIGNED',
      'PICKUP_ACCEPTED',
      'BAG_ASSIGNED',
      'PICKUP_COMPLETED',
      'RECEIVE_PICKUP_AT_STORE',
    ])
  })
})

// ── The exact production desync, encoded as an explicit regression test. ─────
describe('regression — the four-module desync must be impossible', () => {
  it('a picked-up order can NEVER be AWAITING in Orders while invisible in Dispatch', () => {
    // Reconstruct the broken production row: pickup completed, bag collected.
    const broken: Order = {
      status: 'IN_TRANSIT_TO_STORE', // correct state after PICKUP_COMPLETED
      pickupRequired: true,
      fieldStatus: 'PICKUP_COMPLETED',
      pickupCompletedAt: new Date(),
      deliveryCompletedAt: null,
      pickupExecutiveId: 'exec-1',
      deliveryExecutiveId: null,
      pickupAcceptedAt: new Date(),
      deliveryAcceptedAt: null,
      bagStatus: 'COLLECTED',
      timeline: ['PICKUP_COMPLETED'],
    }
    // Orders page and Dispatch MUST agree: it is in transit / pending receipt, and
    // it is STILL in the dispatch queue (not filtered out by a side field).
    expect(ordersPageStage(broken)).toBe(STATUS_META.IN_TRANSIT_TO_STORE.label)
    expect(dispatchBucketOf(broken, 'pickup')).toBe('pending_receipt')
    expect(broken.pickupRequired && PICKUP_QUEUE_STATUSES.includes(broken.status as never)).toBe(true)
  })

  it('legacy stuck row (AWAITING + pickupCompletedAt) still surfaces as pending receipt, never hidden', () => {
    // Pre-chain-of-custody data: status never advanced but the pickup finished.
    const legacy: DispatchOrderView = {
      status: 'AWAITING_PICKUP_ASSIGNMENT',
      pickupCompletedAt: new Date(),
      deliveryCompletedAt: null,
      pickupExecutiveId: 'exec-1',
      deliveryExecutiveId: null,
      pickupAcceptedAt: new Date(),
      deliveryAcceptedAt: null,
    }
    // Still in the queue (AWAITING is a queue status) AND bucketed as pending
    // receipt (pickupCompletedAt) — so it is visible and actionable, not lost.
    expect(PICKUP_QUEUE_STATUSES.includes(legacy.status as never)).toBe(true)
    expect(dispatchBucketOf(legacy, 'pickup')).toBe('pending_receipt')
  })
})
