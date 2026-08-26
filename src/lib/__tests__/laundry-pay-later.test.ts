import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/orders/[id]/payment/route.ts')
const PANEL = read('src/components/laundry/views/laundry-payment-details-panel.tsx')
const LEDGER = read('src/app/api/laundry/payments-ledger/route.ts')

// The whole PAY_LATER branch, up to where the money path begins.
const PAY_LATER_BRANCH = API.slice(
  API.indexOf('if (body.action === "PAY_LATER")'),
  API.indexOf('if (!method || !METHODS.has(method))'),
)

describe('Pay Later posts no money and advances the order', () => {
  it('creates no payment row', () => {
    expect(PAY_LATER_BRANCH).not.toContain('laundryPayment.create')
    expect(PAY_LATER_BRANCH.length).toBeGreaterThan(200) // the slice really found the branch
  })

  it('never writes amountPaid, the balance, or a PAID status', () => {
    // The only order write in the branch is advanceAfterPayment's status move.
    expect(PAY_LATER_BRANCH).not.toContain('laundryOrder.update')
    expect(PAY_LATER_BRANCH).not.toContain('amountPaid')
    expect(PAY_LATER_BRANCH).not.toContain('"PAID"')
    // balanceDue appears only as a READ — the guard, the note and the response
    // payload. The three assertions above are what prove nothing is written.
  })

  it('advances PAYMENT_PENDING → READY_FOR_PROCESSING', () => {
    expect(API).toContain('data: { status: "READY_FOR_PROCESSING" }')
    expect(API).toContain('advanceAfterPayment(orderPL.id, bizPL.id, "PAY_LATER"')
  })

  it('records an auditable event with the actor', () => {
    expect(API).toContain('action, actorName: actor || null')
    expect(API).toContain('fromStatus: "PAYMENT_PENDING", toStatus: "READY_FOR_PROCESSING"')
  })

  it('leaves the balance outstanding in the note', () => {
    expect(API).toContain('Balance ₹${orderPL.balanceDue.toFixed(2)} to collect at delivery')
  })

  // The workspace policy still governs the decision.
  it('refuses when the workspace requires advance payment', () => {
    expect(API).toContain('requires advance payment — pay-later is not allowed')
  })

  // REVERSED. Requiring PAYMENT_PENDING refused the DECISION itself with
  // "Order is not awaiting payment (current: …)". The decision and the
  // stage-advance are now separate concerns.
  it('records the decision from ANY stage — it is never refused for the stage', () => {
    expect(PAY_LATER_BRANCH).not.toContain('is not awaiting payment')
    expect(API).not.toContain('Order is not awaiting payment')
  })

  it('advances ONLY from Payment Collection', () => {
    expect(PAY_LATER_BRANCH).toContain('const atPaymentCollection = orderPL.status === "PAYMENT_PENDING"')
    expect(PAY_LATER_BRANCH).toContain('const advanced = atPaymentCollection')
  })

  it('records the arrangement without moving the order from elsewhere', () => {
    expect(PAY_LATER_BRANCH).toContain('fromStatus: orderPL.status, toStatus: orderPL.status,')
    expect(PAY_LATER_BRANCH).toContain('action: "PAY_LATER"')
  })

  it('does not write a second arrangement for the same order', () => {
    expect(PAY_LATER_BRANCH).toContain("where: { orderId: orderPL.id, action: \"PAY_LATER\" },")
    expect(PAY_LATER_BRANCH).toContain('alreadyArranged: true')
  })

  it('never answers 409 for the stage — only the policy can refuse it', () => {
    expect(PAY_LATER_BRANCH).not.toContain('status: 409')
    expect(PAY_LATER_BRANCH).toContain('status: 403') // ADVANCE_REQUIRED only
  })

  it('reports what actually happened, so the toast cannot claim a move that did not occur', () => {
    expect(PAY_LATER_BRANCH).toContain('advanced, payLater: true')
    expect(PANEL).toContain('stays outstanding.')
    expect(PANEL).toContain('d.advanced')
  })

  it('a zero balance is a no-op, not an error', () => {
    expect(PAY_LATER_BRANCH).toContain('if (orderPL.balanceDue <= 0)')
    expect(PAY_LATER_BRANCH).toContain('payLater: false, balanceDue: 0')
  })
})

describe('no other guard blocks an order for an outstanding balance', () => {
  const BARCODES = read('src/app/api/laundry/orders/[id]/barcodes/route.ts')

  it('Move to Processing blocks only under ADVANCE_REQUIRED', () => {
    // An unpaid order is otherwise free to move — pay-later orders included.
    expect(BARCODES).toContain('biz?.paymentPolicy === "ADVANCE_REQUIRED"')
    expect(BARCODES).toContain('enforced at delivery instead)')
  })

  it('the workflow transition endpoint has no balance gate at all', () => {
    const TRANSITION = read('src/app/api/laundry/orders/[id]/transition/route.ts')
    expect(TRANSITION).not.toContain('balanceDue >')
    expect(TRANSITION).not.toContain('paymentStatus !==')
  })
})

describe('collecting also advances the workflow', () => {
  it('a recorded payment moves the order on', () => {
    expect(API).toContain('advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT"')
  })
})

describe('the panel offers both choices', () => {
  it('Collect Payment with Cash, UPI and Razorpay', () => {
    expect(PANEL).toContain('Collect Payment')
    expect(PANEL).toContain('const PAY_METHODS = ["CASH", "UPI", "RAZORPAY"] as const')
  })

  it('Pay Later, with the confirmation wording', () => {
    expect(PANEL).toContain('Pay Later')
    expect(PANEL).toContain('will remain outstanding. Allow this customer to pay later?')
    expect(PANEL).toContain('Confirm Pay Later')
  })

  it('calls the EXISTING payment endpoint, not a new one', () => {
    expect(PANEL).toContain('action: "PAY_LATER"')
    expect(PANEL).toMatch(/\/payment\?businessId=/)
  })

  it('both actions are hidden when nothing is owed', () => {
    expect(PANEL.match(/disabled=\{f\.balance <= 0\}/g)?.length).toBe(2)
  })

  // Razorpay is still refused rather than faked until it is configured.
  it('does not fabricate a Razorpay transaction', () => {
    expect(PANEL).toContain('Razorpay is not configured yet')
    expect(PANEL).not.toMatch(/rzp_|pay_test/)
  })
})

describe('the ledger keeps a pay-later order visible', () => {
  it('labels it from the event already written', () => {
    expect(LEDGER).toContain('action: "PAY_LATER"')
    expect(LEDGER).toContain('payLater.has(o.id) && f.balance > 0 ? "PAY LATER"')
  })

  it('reverts to the real status once collected', () => {
    expect(LEDGER).toContain('f.balance > 0 ? "PAY LATER" : o.paymentStatus')
  })

  // No new status column was introduced for this.
  it('adds no new status field', () => {
    expect(read('prisma/schema.prisma')).not.toContain('payLaterApproved')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PAY LATER ADVANCES THE ORDER — where advancing is the payment's to do.
//
// Reported as "Pay Later approved but the order is stuck at
// IN_TRANSIT_TO_STORE". It is not stuck because of the balance: the state
// machine's only forward edge from IN_TRANSIT_TO_STORE is
// RECEIVE_PICKUP_AT_STORE, a PHYSICAL chain-of-custody event fired by the
// store's bag scan. A fully-paid order sits at exactly the same place until
// someone receives the bag.
//
// So: Pay Later advances the order wherever payment is genuinely the gate
// (PAYMENT_PENDING), and never performs a custody transition it has no
// business performing.
// ═══════════════════════════════════════════════════════════════════════════

import { TRANSITIONS, getTransitions } from '@/lib/laundry-workflow'

describe('PAY_LATER advances the order at Payment Collection', () => {
  it('PAYMENT_PENDING advances to READY_FOR_PROCESSING, exactly as collecting does', () => {
    expect(PAY_LATER_BRANCH).toContain('await advanceAfterPayment(orderPL.id, bizPL.id, "PAY_LATER", createdBy, note)')
    expect(API).toContain('data: { status: "READY_FOR_PROCESSING" }')
    // The SAME helper both decisions use — no duplicated transition logic.
    expect(API).toContain('advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT"')
  })

  it('advancing is gated on the STAGE, never on the balance being zero', () => {
    expect(PAY_LATER_BRANCH).toContain('const advanced = atPaymentCollection')
    expect(PAY_LATER_BRANCH).not.toContain('balanceDue === 0 ?')
    expect(PAY_LATER_BRANCH).not.toContain('paymentStatus === "PAID"')
  })

  it('the state machine backs this up: COLLECT_PAYMENT exists only at PAYMENT_PENDING', () => {
    const withPayment = (Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[])
      .filter((s) => TRANSITIONS[s].some((t) => t.action === 'COLLECT_PAYMENT'))
    expect(withPayment).toEqual(['PAYMENT_PENDING'])
  })
})

describe('Pay Later never performs a physical custody transition', () => {
  it('IN_TRANSIT_TO_STORE moves only by the store receiving the bag', () => {
    const forward = getTransitions('IN_TRANSIT_TO_STORE').filter((t) => t.to !== 'CANCELLED')
    expect(forward).toHaveLength(1)
    expect(forward[0].action).toBe('RECEIVE_PICKUP_AT_STORE')
    expect(forward[0].to).toBe('PENDING_STORE_AUDIT')
  })

  it('that edge is owned by the bag-scan endpoint, not by payment', () => {
    const RECEIVE = read('src/app/api/laundry/bags/receive-at-store/route.ts')
    expect(RECEIVE).toContain('action: exception ? "RECEIVE_EXCEPTION" : "RECEIVE_PICKUP_AT_STORE"')
    // It records custody facts a payment decision simply does not have.
    expect(RECEIVE).toContain('receivedBy: receiver')
    expect(PAY_LATER_BRANCH).not.toContain('RECEIVE_PICKUP_AT_STORE')
    expect(PAY_LATER_BRANCH).not.toContain('PENDING_STORE_AUDIT')
  })

  it('the receive path has no payment gate — a balance never blocks it', () => {
    const RECEIVE = read('src/app/api/laundry/bags/receive-at-store/route.ts')
    expect(RECEIVE).not.toContain('balanceDue')
    expect(RECEIVE).not.toContain('paymentStatus')
  })

  it('tells the operator what the order is actually waiting for', () => {
    expect(PAY_LATER_BRANCH).toContain('const nextStepOf = (status: string)')
    expect(PAY_LATER_BRANCH).toContain('getTransitions(status).find((t) => t.primary)')
    expect(PANEL).toContain('Next step: ${d.nextStep.label}')
  })

  it('the next step named for a transiting order is the store receive', () => {
    const primary = getTransitions('IN_TRANSIT_TO_STORE').find((t) => t.primary)
    expect(primary?.label).toBe('Receive at Store')
  })
})
