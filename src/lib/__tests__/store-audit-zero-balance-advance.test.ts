import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { financialSummary } from '@/lib/laundry-adjustment'

// ============================================================================
// AN ORDER WITH NOTHING LEFT TO COLLECT DOES NOT WAIT AT PAYMENT COLLECTION.
//
// Store Audit hands the order to Payment Collection, which is right while money
// is owed. When a subscription covered the whole order, or it was paid up
// front, or the two together settled it, the queue has nothing to ask for — and
// staff had to "collect" ₹0 before the work could start.
//
// The gate is the only new thing. Everything it triggers already existed: the
// same PAYMENT_PENDING → READY_FOR_PROCESSING transition the payment endpoint
// performs, through the same function, with the same financial guard, the same
// conditional update and the same COLLECT_PAYMENT event. No new status, no new
// action, no new workflow, and Store Audit is still required to reach it.
//
// Balance comes from financialSummary — the definition Payments & Ledger uses —
// so "settled" means the same thing on both screens.
//
// Driven against the running app, all four audited and differing only in money:
//   subscription 70 of 70      → READY_FOR_PROCESSING   autoAdvanced true
//   paid 100 of 100            → READY_FOR_PROCESSING   autoAdvanced true
//   subscription 60 + paid 40  → READY_FOR_PROCESSING   autoAdvanced true
//   subscription 20, owes 80   → PAYMENT_PENDING        autoAdvanced false
// and an order with an uninspected garment is still refused 409 AUDIT_INCOMPLETE.
// ============================================================================

const TRANSITION = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/transition/route.ts'), 'utf8')
const PAYMENT = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/payment/route.ts'), 'utf8')
const ADVANCE = readFileSync(join(process.cwd(), 'src/lib/laundry-payment-advance.ts'), 'utf8')
const WORKFLOW = readFileSync(join(process.cwd(), 'src/lib/laundry-workflow.ts'), 'utf8')

/** The money shape summarise() reads, as the route selects it. */
const money = (grandTotal: number, subscriptionCoveredAmount: number, amountPaid: number) => ({
  grandTotal, amountPaid, discount: 0, subscriptionCoveredAmount,
  balanceDue: Math.max(0, grandTotal - subscriptionCoveredAmount - amountPaid),
})

describe('1 · the balance decides, using the ledger’s own definition', () => {
  it('subscription covering the whole order settles it', () => {
    expect(financialSummary(money(70, 70, 0), []).balance).toBe(0)
  })

  it('payment covering the whole order settles it', () => {
    expect(financialSummary(money(100, 0, 100), []).balance).toBe(0)
  })

  it('subscription plus payment together settle it', () => {
    expect(financialSummary(money(100, 60, 40), []).balance).toBe(0)
  })

  it('an order still owing money does not settle', () => {
    expect(financialSummary(money(100, 20, 0), []).balance).toBe(80)
  })

  it('the route reads balanceDue — the field summarise actually uses', () => {
    // round2(undefined) is 0, so omitting this field makes every order look
    // settled and silently advances an unpaid one. It has to be selected.
    expect(TRANSITION).toContain('grandTotal: true, amountPaid: true, balanceDue: true, discount: true,')
    expect(TRANSITION).toContain('subscriptionCoveredAmount: true,')
  })
})

describe('2 · it reuses the existing transition, it does not invent one', () => {
  it('the payment route and the audit route call the same function', () => {
    expect(PAYMENT).toContain('import { advanceAfterPayment } from "@/lib/laundry-payment-advance"')
    expect(TRANSITION).toContain('import { advanceAfterPayment } from "@/lib/laundry-payment-advance"')
    // Defined once, not copied into either route.
    expect(PAYMENT).not.toContain('async function advanceAfterPayment')
    expect(TRANSITION).not.toContain('async function advanceAfterPayment')
  })

  it('that function still performs the original move, guard and event', () => {
    expect(ADVANCE).toContain('guardFinancialAdvance({ orderId, businessId, from: "PAYMENT_PENDING", to: "READY_FOR_PROCESSING" })')
    expect(ADVANCE).toContain('where: { id: orderId, status: "PAYMENT_PENDING" },')
    expect(ADVANCE).toContain('data: { status: "READY_FOR_PROCESSING" },')
    expect(ADVANCE).toContain('fromStatus: "PAYMENT_PENDING", toStatus: "READY_FOR_PROCESSING", action')
  })

  it('the existing COLLECT_PAYMENT action is used — no new action or status', () => {
    expect(TRANSITION).toContain('"COLLECT_PAYMENT"')
    expect(WORKFLOW).toContain('{ to: "READY_FOR_PROCESSING", action: "COLLECT_PAYMENT", label: "Collect Payment", primary: true, internal: true }')
    // The audit edges themselves are untouched.
    expect(WORKFLOW).toContain('{ to: "PAYMENT_PENDING", action: "APPROVE_AUDIT", label: "Approve Audit", primary: true }')
    expect(WORKFLOW).toContain('{ to: "PAYMENT_PENDING", action: "COMPLETE_AUDIT", label: "Complete Audit", primary: true }')
  })

  it('the update is conditional on PAYMENT_PENDING, so it cannot skip a stage', () => {
    expect(ADVANCE).toContain('updateMany')
  })
})

describe('3 · Store Audit is still required, and still gates first', () => {
  it('the audit completeness check runs before any write', () => {
    const auditGate = TRANSITION.indexOf('const audit = await checkAuditComplete(id, { requireWeight: true })')
    const write = TRANSITION.indexOf('const updated = await prisma.laundryOrder.update({')
    expect(auditGate).toBeGreaterThan(-1)
    expect(auditGate).toBeLessThan(write)
  })

  it('the auto-advance only fires once the order has reached Payment', () => {
    expect(TRANSITION).toContain('if (toStatus === "PAYMENT_PENDING") {')
    const gate = TRANSITION.indexOf('if (toStatus === "PAYMENT_PENDING") {')
    expect(gate).toBeGreaterThan(TRANSITION.indexOf('const updated = await prisma.laundryOrder.update({'))
  })

  it('only a nil balance advances', () => {
    expect(TRANSITION).toContain('if (f.balance <= 0) {')
  })
})

describe('4 · nothing financial or subscription-related was changed', () => {
  it('the transition route records no money and touches no subscription', () => {
    for (const w of ['laundryPayment.create', 'applyPaymentToPurchase', 'confirmSubscriptionPurchase']) {
      expect(TRANSITION, w).not.toContain(w)
    }
    // The money fields appear only in the read that decides the gate. What
    // matters is that nothing WRITES them, so the check is on `data:` blocks —
    // a plain string match would trip on `amountPaid: true` in the select.
    expect(TRANSITION).not.toMatch(/data:\s*\{[^}]*amountPaid/)
    expect(TRANSITION).not.toMatch(/data:\s*\{[^}]*balanceDue/)
    expect(TRANSITION).not.toMatch(/data:\s*\{[^}]*subscriptionCoveredAmount/)
  })

  it('the payment route keeps recording money exactly as before', () => {
    expect(PAYMENT).toContain('prisma.laundryPayment.create(')
    expect(PAYMENT).toContain('applyPaymentToPurchase(d.purchase.id, toSubscription)')
    expect(PAYMENT).toContain('advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT", createdBy')
  })

  it('a failure to advance never blocks the audit transition', () => {
    expect(TRANSITION).toContain('console.error("[laundry-order-transition] zero-balance auto-advance failed:", e)')
  })

  it('the caller is told where the order actually landed', () => {
    expect(TRANSITION).toContain('toStatus: autoAdvanced ? "READY_FOR_PROCESSING" : toStatus,')
    expect(TRANSITION).toContain('autoAdvanced,')
  })
})
