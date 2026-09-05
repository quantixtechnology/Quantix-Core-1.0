// Correcting a payment that was entered but never received.
//
// The distinction this file exists to protect: a correction is NOT a refund.
// Money never arrived, so money must never go back, and nothing may be written
// that would later read as a movement of the customer's money.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  PAYMENT_CORRECTED_STATUS, PAYMENT_CORRECTION_ACTION, LIVE_PAYMENT_WHERE,
  isCorrectedPayment, UNCORRECTABLE_METHODS, validatePaymentCorrection,
} from '@/lib/laundry-payment-correction'
import { canCorrectDealValue } from '@/lib/laundry-dv-correction'
import { financialSummary } from '@/lib/laundry-adjustment'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** Comments explain intent; they must never be what an assertion matches. */
const code = (p: string) => read(p).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

const LIB = code('src/lib/laundry-payment-correction.ts')
const API = code('src/app/api/laundry/orders/[id]/payments/[paymentId]/correct/route.ts')
const PANEL = code('src/components/laundry/views/laundry-payment-details-panel.tsx')

// The order in the brief: DV corrected to ₹441, discount voided, and ₹900 that
// staff recorded but the customer never paid.
const r2 = (n: number) => Math.round(n * 100) / 100
const applyCorrection = (order: { grandTotal: number; amountPaid: number }, amount: number) => {
  const amountPaid = r2(Math.max(0, order.amountPaid - amount))
  const balanceDue = r2(Math.max(0, order.grandTotal - amountPaid))
  const paymentStatus = balanceDue <= 0
    ? (amountPaid > 0 ? 'PAID' : 'SUBSCRIPTION')
    : (amountPaid > 0 ? 'PARTIAL' : 'UNPAID')
  return { amountPaid, balanceDue, paymentStatus }
}

describe('1 — the exact scenario', () => {
  const order = { grandTotal: 441, amountPaid: 900 }

  it('₹900 recorded in error leaves paid ₹0 and balance ₹441', () => {
    expect(applyCorrection(order, 900)).toEqual({ amountPaid: 0, balanceDue: 441, paymentStatus: 'UNPAID' })
  })

  it('the panel then shows DV ₹441, discount ₹0, paid ₹0, balance ₹441, refund due ₹0', () => {
    const after = applyCorrection(order, 900)
    // The ₹459 manual discount was already voided, so it counts for nothing.
    const voided = [{ amount: 459, appliedToDue: 0, refundable: 459, refundStatus: 'PENDING', voidedAt: new Date() }]
    const f = financialSummary(
      { grandTotal: 441, amountPaid: after.amountPaid, balanceDue: after.balanceDue, discount: 0, subscriptionCoveredAmount: 0 },
      voided,
    )
    expect(f.invoiceTotal).toBe(441)
    expect(f.discount).toBe(0)
    expect(f.paid).toBe(0)
    expect(f.balance).toBe(441)
    expect(f.refundDue).toBe(0)
    expect(f.refunded).toBe(0)
  })

  it('the Deal Value is not re-derived by the correction', () => {
    // Only amountPaid, balanceDue and paymentStatus are written on the order.
    const write = LIB.slice(LIB.indexOf('tx.laundryOrder.update'), LIB.indexOf('tx.laundryOrderEvent.create'))
    expect(write).toContain('amountPaid, balanceDue, paymentStatus')
    expect(write).not.toMatch(/grandTotal/)
    expect(write).not.toMatch(/discount/)
    expect(write).not.toMatch(/subscriptionCovered/)
  })
})

describe('2 — it is not a refund, and never becomes one', () => {
  it('no payment row is ever created by a correction', () => {
    expect(LIB).not.toMatch(/laundryPayment\.create/)
    expect(API).not.toMatch(/laundryPayment\.create/)
  })

  it('no adjustment, credit or offsetting row is created either', () => {
    expect(LIB).not.toMatch(/laundryOrderAdjustment\.(create|update)/)
    expect(API).not.toMatch(/laundryOrderAdjustment\./)
    // REFUND appears only as a method this endpoint refuses to touch, never as
    // something it writes.
    expect(LIB).not.toMatch(/method:\s*["']REFUND["']/)
    expect(LIB).not.toMatch(/refundable|refundStatus|refundedAt|gatewayRefundId/)
  })

  it('the original row is updated, never deleted', () => {
    expect(LIB).toContain('tx.laundryPayment.update')
    expect(LIB).not.toMatch(/laundryPayment\.(delete|deleteMany)/)
  })

  it('and only the correction columns are written on it', () => {
    const upd = LIB.slice(LIB.indexOf('tx.laundryPayment.update'), LIB.indexOf('tx.laundryOrder.update'))
    for (const f of ['status:', 'correctedAt:', 'correctedBy:', 'correctedByName:', 'correctionReason:']) {
      expect(upd).toContain(f)
    }
    // What was entered stays exactly as entered.
    for (const f of ['amount:', 'method:', 'note:', 'createdAt:', 'createdBy:']) {
      expect(upd).not.toContain(f)
    }
  })

  it('the panel calls the correction endpoint, not the refund one', () => {
    expect(PANEL).toContain('/payments/${pay.id}/correct')
    const handler = PANEL.slice(PANEL.indexOf('const correctPayment'), PANEL.indexOf('const applyDiscount'))
    expect(handler).not.toMatch(/refund/i)
  })
})

describe('3 — authorization is the DV Correction bar, server-side', () => {
  it('reuses the same predicate rather than restating the rule', () => {
    expect(API).toContain('import { canCorrectDealValue, roleLabelFor } from "@/lib/laundry-dv-correction"')
    expect(API).toContain('canCorrectDealValue(who)')
    expect(API).toContain('Only the Quantix Super Admin, the Owner or an Accountant can correct a payment.')
    expect(API).toContain('{ status: 403 }')
  })

  it('business scoping runs before the role gate', () => {
    expect(API).toContain('requireLaundryLevel(request, order.businessId, "store_ops.payment_collection", Level.EDIT)')
    expect(API.indexOf('requireLaundryLevel')).toBeLessThan(API.indexOf('canCorrectDealValue(who)'))
  })

  it('edit rights on the Payments screen are not enough', () => {
    for (const roleCode of ['STORE_MANAGER', 'STORE_SUPERVISOR', 'COUNTER_EXECUTIVE', 'CASHIER', 'VIEWER']) {
      expect(canCorrectDealValue({ platformRole: null, isOwner: false, roleCode })).toBe(false)
    }
    expect(canCorrectDealValue({ platformRole: 'QUANTIX_SUPER_ADMIN', isOwner: false, roleCode: 'VIEWER' })).toBe(true)
    expect(canCorrectDealValue({ platformRole: null, isOwner: true, roleCode: 'BUSINESS_OWNER' })).toBe(true)
    expect(canCorrectDealValue({ platformRole: null, isOwner: false, roleCode: 'ACCOUNTANT' })).toBe(true)
  })

  it('the UI gate is the same flag, and only a convenience', () => {
    expect(PANEL).toContain('canCorrectDv')
    expect(PANEL).toContain('Correct Erroneous Payment')
  })
})

describe('4 — a reason is mandatory', () => {
  it('empty, blank and non-string reasons are refused', () => {
    for (const bad of ['', '   ', '\n\t', null, undefined, 42, {}]) {
      const v = validatePaymentCorrection(bad)
      expect(v.ok).toBe(false)
      expect(v.error).toBe('A reason is required to correct a payment.')
    }
  })

  it('a real reason is accepted and trimmed', () => {
    const v = validatePaymentCorrection('  Payment was incorrectly marked as paid; customer did not pay for this order.  ')
    expect(v.ok).toBe(true)
    expect(v.reason).toBe('Payment was incorrectly marked as paid; customer did not pay for this order.')
  })

  it('nothing is written before the reason is validated', () => {
    expect(LIB.indexOf('validatePaymentCorrection(input.reason)')).toBeLessThan(LIB.indexOf('$transaction'))
  })

  it('and the dialog cannot be confirmed without one', () => {
    expect(PANEL).toContain('disabled={busy === p.id || !correctReason.trim()}')
    expect(PANEL).toContain('Confirm Correction')
    expect(PANEL).toContain('>Cancel<')
  })
})

describe('5 — what may not be corrected', () => {
  it('subscription coverage and refunds are refused', () => {
    expect(UNCORRECTABLE_METHODS).toEqual(['SUBSCRIPTION', 'REFUND'])
    expect(LIB).toContain('UNCORRECTABLE_METHODS as readonly string[]).includes((pay.method || "").toUpperCase())')
  })

  it('so a customer plan can never be altered through this endpoint', () => {
    expect(LIB).not.toMatch(/customerSubscription|subscriptionPurchase|subscriptionUsage/i)
    expect(API).not.toMatch(/customerSubscription|subscriptionPurchase/i)
    expect(LIB).not.toMatch(/applySubscriptionToOrder|computeCoverage/)
  })

  it('correcting twice is refused, and the first correction stands', () => {
    expect(LIB).toContain('alreadyCorrected: true')
    expect(API).toContain('status: 409')
  })

  it('the payment is looked up scoped to its order', () => {
    expect(LIB).toContain('where: { id: paymentId, orderId }')
  })
})

describe('6 — the record is kept and stops being money', () => {
  it('CORRECTED is the status an erroneous entry carries', () => {
    expect(PAYMENT_CORRECTED_STATUS).toBe('CORRECTED')
    expect(isCorrectedPayment({ status: 'CORRECTED' })).toBe(true)
    expect(isCorrectedPayment({ status: 'corrected' })).toBe(true)
    expect(isCorrectedPayment({ correctedAt: new Date() })).toBe(true)
    expect(isCorrectedPayment({ status: 'SUCCESS', correctedAt: null })).toBe(false)
    expect(isCorrectedPayment({ status: 'SUCCESS' })).toBe(false)
  })

  it('the Payments & Ledger TODAY list excludes it without being changed', () => {
    // That list already asks for SUCCESS only, so a corrected row drops out on
    // its own. The file must stay exactly as it was.
    const ledger = code('src/app/api/laundry/payments-ledger/route.ts')
    expect(ledger).toContain('status: "SUCCESS"')
    expect(ledger).not.toMatch(/CORRECTED|correctedAt|LIVE_PAYMENT_WHERE/)
  })

  it('the customer-facing money lists exclude it too', () => {
    for (const f of [
      'src/lib/laundry-customer.ts',
      'src/app/api/laundry/app/history/route.ts',
      'src/app/api/laundry/app/orders/[orderId]/route.ts',
    ]) {
      const src = code(f)
      expect(src).toContain('LIVE_PAYMENT_WHERE')
      expect(src).toContain('from "@/lib/laundry-payment-correction"')
    }
    expect(LIVE_PAYMENT_WHERE).toEqual({ status: { not: 'CORRECTED' } })
  })

  it('the Payment Details panel still shows it, marked and struck through', () => {
    expect(PANEL).toContain('Corrected / Invalid')
    expect(PANEL).toContain('line-through')
    expect(PANEL).toContain('Corrected by {p.correctedByName')
  })

  it('the audit row names who, when and why', () => {
    expect(PAYMENT_CORRECTION_ACTION).toBe('PAYMENT_CORRECTION')
    expect(LIB).toContain('tx.laundryOrderEvent.create')
    const ev = LIB.slice(LIB.indexOf('tx.laundryOrderEvent.create'))
    for (const f of ['paymentId', 'amount', 'method', 'previousAmountPaid', 'reason', 'user', 'role']) {
      expect(ev).toContain(f)
    }
  })

  it('row, order and audit are written in one transaction', () => {
    expect(LIB).toContain('prisma.$transaction')
    const tx = LIB.slice(LIB.indexOf('prisma.$transaction'))
    expect(tx).toContain('tx.laundryPayment.update')
    expect(tx).toContain('tx.laundryOrder.update')
    expect(tx).toContain('tx.laundryOrderEvent.create')
  })
})

describe('7 — the order does not move', () => {
  it('LaundryOrder.status is never written', () => {
    const write = LIB.slice(LIB.indexOf('tx.laundryOrder.update'), LIB.indexOf('tx.laundryOrderEvent.create'))
    expect(write).not.toMatch(/\bstatus:/)
  })

  it('and the audit row records the order standing still', () => {
    expect(LIB).toContain('fromStatus: order.status, toStatus: order.status')
  })

  it('no workflow transition is invoked', () => {
    expect(LIB).not.toMatch(/transitionOrder|assertTransition|laundry-order-state|markOrderDelivered/)
    expect(API).not.toMatch(/transitionOrder|assertTransition/)
  })
})

describe('8 — arithmetic holds in the awkward cases', () => {
  it('a partial correction leaves the rest paid', () => {
    expect(applyCorrection({ grandTotal: 900, amountPaid: 900 }, 400))
      .toEqual({ amountPaid: 500, balanceDue: 400, paymentStatus: 'PARTIAL' })
  })

  it('paid can never go below zero', () => {
    expect(applyCorrection({ grandTotal: 441, amountPaid: 100 }, 900))
      .toEqual({ amountPaid: 0, balanceDue: 441, paymentStatus: 'UNPAID' })
  })

  it('a fully covered order reads as covered, not as cash paid', () => {
    expect(applyCorrection({ grandTotal: 0, amountPaid: 900 }, 900))
      .toEqual({ amountPaid: 0, balanceDue: 0, paymentStatus: 'SUBSCRIPTION' })
  })

  it('paise survive the round trip', () => {
    expect(applyCorrection({ grandTotal: 441.55, amountPaid: 900.35 }, 900.35))
      .toEqual({ amountPaid: 0, balanceDue: 441.55, paymentStatus: 'UNPAID' })
    expect(applyCorrection({ grandTotal: 100, amountPaid: 99.99 }, 33.33).amountPaid).toBe(66.66)
  })

  it('the engine uses that same arithmetic', () => {
    expect(LIB).toContain('r2(Math.max(0, (order.amountPaid || 0) - amount))')
    expect(LIB).toContain('r2(Math.max(0, order.grandTotal - amountPaid))')
  })
})

describe('9 — the schema change is additive', () => {
  it('all four columns are nullable, so no backfill is needed', () => {
    const model = read('prisma/schema.prisma').match(/model LaundryPayment \{[\s\S]*?\n\}/)![0]
    for (const c of ['correctedAt      DateTime?', 'correctedBy      String?', 'correctedByName  String?', 'correctionReason String?']) {
      expect(model).toContain(c)
    }
  })

  it('and nothing existing on the model changed', () => {
    const model = read('prisma/schema.prisma').match(/model LaundryPayment \{[\s\S]*?\n\}/)![0]
    for (const c of ['amount           Float', 'method           String', 'createdAt        DateTime @default(now())', 'status           String   @default("SUCCESS")']) {
      expect(model).toContain(c)
    }
  })
})
