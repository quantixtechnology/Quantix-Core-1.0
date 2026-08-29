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

  it('takes the Payment Collection edge there, and the stage edge elsewhere', () => {
    expect(PAY_LATER_BRANCH).toContain('const atPaymentCollection = orderPL.status === "PAYMENT_PENDING"')
    expect(PAY_LATER_BRANCH).toContain('const moved = atPaymentCollection')
  })

  it('records the arrangement when no step was available', () => {
    expect(PAY_LATER_BRANCH).toContain('fromStatus: orderPL.status, toStatus: orderPL.status,')
    expect(PAY_LATER_BRANCH).toContain('action: "PAY_LATER"')
  })

  it('does not write a second arrangement for the same order', () => {
    expect(PAY_LATER_BRANCH).toContain('where: { orderId: orderPL.id, action: "PAY_LATER", fromStatus: orderPL.status },')
    expect(PAY_LATER_BRANCH).toContain('alreadyArranged = !!existing')
    expect(PAY_LATER_BRANCH).toContain('if (!existing) {')
  })

  it('never answers 409 for the stage — only the policy can refuse it', () => {
    expect(PAY_LATER_BRANCH).not.toContain('status: 409')
    expect(PAY_LATER_BRANCH).toContain('status: 403') // ADVANCE_REQUIRED only
  })

  it('reports what actually happened, so the toast cannot claim a move that did not occur', () => {
    expect(PAY_LATER_BRANCH).toContain('advanced: !!moved')
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

  it('advancing is never gated on the balance being zero', () => {
    expect(PAY_LATER_BRANCH).toContain('const moved = atPaymentCollection')
    expect(PAY_LATER_BRANCH).not.toContain('balanceDue === 0 ?')
    expect(PAY_LATER_BRANCH).not.toContain('paymentStatus === "PAID"')
  })

  it('the state machine backs this up: COLLECT_PAYMENT exists only at PAYMENT_PENDING', () => {
    const withPayment = (Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[])
      .filter((s) => TRANSITIONS[s].some((t) => t.action === 'COLLECT_PAYMENT'))
    expect(withPayment).toEqual(['PAYMENT_PENDING'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PAY LATER MOVES THE ORDER — from whatever stage the decision is taken at.
//
// Business rule: Pay Later is a completed payment DECISION. Payment is never
// what holds an order, so confirming it takes the order to its next defined
// stage rather than leaving it where it was.
//
// The target is always read from the state machine — never a literal — so the
// order takes the step the workflow itself defines and nothing is skipped that
// is not about payment.
// ═══════════════════════════════════════════════════════════════════════════


describe('PAY_LATER advances the order', () => {
  it('THE REPORTED CASE · IN_TRANSIT_TO_STORE moves to PENDING_STORE_AUDIT', () => {
    // The next valid stage is read from the state machine, not chosen.
    const primary = getTransitions('IN_TRANSIT_TO_STORE').find((t) => t.primary && t.to !== 'CANCELLED')
    expect(primary?.to).toBe('PENDING_STORE_AUDIT')
    // …and that is exactly what advanceOnPayLater applies.
    expect(API).toContain("const primary = getTransitions(from).find((t) => t.primary && t.to !== \"CANCELLED\")")
    expect(API).toContain('data: { status: primary.to as never },')
  })

  it('is called for every stage that is not Payment Collection', () => {
    expect(PAY_LATER_BRANCH).toContain(': await advanceOnPayLater(orderPL.id, bizPL.id, createdBy, note)')
  })

  it('still uses the existing COLLECT_PAYMENT edge at Payment Collection', () => {
    expect(PAY_LATER_BRANCH).toContain('await advanceAfterPayment(orderPL.id, bizPL.id, "PAY_LATER", createdBy, note)')
    expect(API).toContain('data: { status: "READY_FOR_PROCESSING" }')
  })

  it('records the arrangement and the move ATOMICALLY', () => {
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).toContain('prisma.$transaction(async (tx) =>')
    expect(fn).toContain('tx.laundryOrder.updateMany')
    expect(fn).toContain('tx.laundryOrderEvent.create')
    // Concurrency-safe: the move only applies from the status we read.
    expect(fn).toContain('where: { id: orderId, status: from as never },')
  })

  it('never invents a stage, and never advances to CANCELLED', () => {
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).toContain("t.to !== \"CANCELLED\"")
    expect(fn).not.toContain('"READY_FOR_PROCESSING"')
    expect(fn).not.toContain('"PENDING_STORE_AUDIT"')
    expect(fn).not.toContain('"DELIVERED"')
  })

  it('respects the audit gate — a payment decision cannot skip counting garments', () => {
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).toContain('primary.action === "APPROVE_AUDIT" || primary.action === "COMPLETE_AUDIT"')
    // Same transition, same gate — including the weight requirement, so a
    // Pay Later decision at Store Audit cannot slip past it either.
    expect(fn).toContain('const audit = await checkAuditComplete(orderId, { requireWeight: true })')
    expect(fn).toContain('if (!audit.ok) return null')
  })

  it('advances exactly ONE step — no walking the chain', () => {
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).not.toContain('while')
    expect(fn).not.toContain('for (')
  })

  it('still posts no money and never marks the order PAID', () => {
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).not.toContain('amountPaid')
    expect(fn).not.toContain('balanceDue')
    expect(fn).not.toContain('"PAID"')
    expect(fn).not.toContain('laundryPayment')
  })

  it('reports the real from → to so the toast cannot lie', () => {
    expect(PAY_LATER_BRANCH).toContain('advanced: !!moved')
    expect(PAY_LATER_BRANCH).toContain('from: moved?.from ?? orderPL.status, to: finalStatus,')
    expect(PANEL).toContain('Order moved to ${statusLabel(String(d.to))}')
  })

  it('a blocked arrangement is retried on the next confirmation', () => {
    // The move is attempted every time; the duplicate check only decides whether
    // the EVENT is re-written, and it runs after the move has been tried.
    expect(PAY_LATER_BRANCH.indexOf('const moved =')).toBeLessThan(PAY_LATER_BRANCH.indexOf('laundryOrderEvent.findFirst'))
  })

  it('PAY NOW is untouched — still PAYMENT_PENDING-only', () => {
    const fn = API.slice(API.indexOf('// Advance PAYMENT_PENDING'), API.indexOf('export async function POST'))
    expect(fn).toContain('where: { id: orderId, status: "PAYMENT_PENDING" },')
    expect(fn).toContain('data: { status: "READY_FOR_PROCESSING" },')
    expect(API).toContain('advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT"')
  })

  it('tenant isolation is unchanged — the order is resolved within the business', () => {
    expect(PAY_LATER_BRANCH).toContain('prisma.laundryOrder.findFirst({ where: { id, businessId: bizPL.id }')
  })

  it('the physical receive endpoint still owns custody facts', () => {
    const RECEIVE = read('src/app/api/laundry/bags/receive-at-store/route.ts')
    // Its status update is scoped to receivable states, so it becomes a no-op
    // if Pay Later already moved the order — the custody record still lands.
    expect(RECEIVE).toContain('status: { in: [...RECEIVABLE] as never[] }')
    expect(RECEIVE).toContain('receivedBy: receiver')
    const fn = API.slice(API.indexOf('async function advanceOnPayLater'), API.indexOf('// Advance PAYMENT_PENDING'))
    expect(fn).not.toContain('receivedBy')
    expect(fn).not.toContain('laundryBag')
  })

  it('COLLECT_PAYMENT still exists at exactly one status', () => {
    const withPayment = (Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[])
      .filter((s) => TRANSITIONS[s].some((t) => t.action === 'COLLECT_PAYMENT'))
    expect(withPayment).toEqual(['PAYMENT_PENDING'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PAY LATER → PACKING & QR, and RETURN TO AUDIT → STORE AUDIT.
//
// Reported: after confirming Pay Later the order left Payment Collection but
// never appeared in Packing & QR ("No orders in this stage"). TWO causes:
//
//  1. the duplicate-arrangement guard returned BEFORE the advance. An order
//     carrying a PAY_LATER event from an earlier stage matched it, so the
//     decision was reported as "already arranged" and the order never moved.
//  2. the Packing & QR queue filtered out orders whose Store Audit was
//     incomplete, so an order that HAD reached READY_FOR_PROCESSING was hidden
//     with no explanation.
// ═══════════════════════════════════════════════════════════════════════════

describe('PAY LATER lands the order in the Packing & QR queue', () => {
  const PACKING = read('src/components/laundry/views/laundry-store-stages.tsx')

  it('Packing & QR pending reads exactly READY_FOR_PROCESSING', () => {
    expect(PACKING).toContain('const queue = useQueue("READY_FOR_PROCESSING")')
    expect(PACKING).toContain('<QueueShell status="READY_FOR_PROCESSING" title="Packing & QR"')
  })

  it('…which is the state the Payment Collection edge advances to', () => {
    const edge = TRANSITIONS.PAYMENT_PENDING.find((t) => t.action === 'COLLECT_PAYMENT')
    expect(edge?.to).toBe('READY_FOR_PROCESSING')
    expect(API).toContain('data: { status: "READY_FOR_PROCESSING" }')
  })

  it('the queue no longer hides orders it actually holds', () => {
    // The silent "No orders in this stage" came from a client-side filter.
    expect(PACKING).not.toContain('auditReadyForPacking')
    expect(PACKING).not.toContain('o.auditComplete !== false')
    // The reason is shown ON the order instead, with a way out.
    expect(PACKING).toContain('selected.auditComplete === false')
    expect(PACKING).toContain('Cannot Pack Order')
    expect(PACKING).toContain('setLaundryPage("audit-queue")')
  })

  it('the server-side pack gate is untouched — visibility is not permission', () => {
    const PACK = read('src/app/api/laundry/orders/[id]/pack/route.ts')
    // Packing runs on orders already PAST audit, so it deliberately does NOT
    // opt into the weight rule — that would strand in-flight orders.
    expect(PACK).toContain('const audit = await checkAuditComplete(order.id)')
    expect(PACK).not.toContain('requireWeight')
    expect(PACK).toContain('if (!audit.ok)')
  })

  it('an earlier arrangement can NEVER block the move', () => {
    // The duplicate check now governs only whether the EVENT is re-written…
    expect(PAY_LATER_BRANCH).toContain('const moved = atPaymentCollection')
    const beforeMove = PAY_LATER_BRANCH.slice(0, PAY_LATER_BRANCH.indexOf('const moved ='))
    expect(beforeMove).not.toContain('laundryOrderEvent.findFirst')
    // …and it runs only when no step was available.
    expect(PAY_LATER_BRANCH).toContain('if (!moved) {')
    expect(PAY_LATER_BRANCH).toContain("where: { orderId: orderPL.id, action: \"PAY_LATER\", fromStatus: orderPL.status },")
  })

  it('there is no early return between reading the order and moving it', () => {
    const beforeMove = PAY_LATER_BRANCH.slice(0, PAY_LATER_BRANCH.indexOf('const moved ='))
    // Only genuine refusals: business not found, order not found, zero balance,
    // and the ADVANCE_REQUIRED policy. Nothing about a prior arrangement.
    const returns = beforeMove.match(/return NextResponse\.json/g) || []
    expect(returns).toHaveLength(4)
    expect(beforeMove).toContain('if (orderPL.balanceDue <= 0)')
    expect(beforeMove).toContain('requires advance payment')
    expect(beforeMove).not.toContain('alreadyArranged')
  })
})

describe('RETURN TO AUDIT sends the order back to Store Audit', () => {
  it('the REOPEN_AUDIT edge exists from Payment Collection', () => {
    const edge = TRANSITIONS.PAYMENT_PENDING.find((t) => t.action === 'REOPEN_AUDIT')
    expect(edge?.to).toBe('PENDING_STORE_AUDIT')
    // Not internal ⇒ the generic transition endpoint may perform it.
    expect(edge?.internal).toBeFalsy()
  })

  it('the button drives that exact transition', () => {
    expect(PANEL).toContain('Return to Audit')
    expect(PANEL).toContain("toStatus: \"PENDING_STORE_AUDIT\"")
    expect(PANEL).toContain('/transition')
  })

  it('it records no payment and changes no balance', () => {
    const fn = PANEL.slice(PANEL.indexOf('const returnToAudit'), PANEL.indexOf('const returnToAudit') + 900)
    expect(fn).not.toContain('/payment')
    expect(fn).not.toContain('amountPaid')
    expect(fn).not.toContain('balanceDue')
  })

  it('Store Audit reads the state that edge targets', () => {
    const AUDIT = read('src/components/laundry/views/laundry-store-audit.tsx')
    expect(AUDIT).toContain('PENDING_STORE_AUDIT')
  })
})
