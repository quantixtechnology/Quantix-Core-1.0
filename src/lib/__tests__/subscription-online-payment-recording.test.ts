import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A VERIFIED ONLINE PAYMENT IS RECORDED AS MONEY RECEIVED.
//
// confirmSubscriptionPurchase activated the membership, stamped paidAt, the
// gateway and both Razorpay ids — and left amountPaid at 0. So a paid, active
// membership carried a financial record saying nothing had been paid:
//   · Payments & Ledger showed it fully outstanding and filed it under PENDING
//     rather than PAID
//   · subscription revenue, which is SUM(amountPaid) over ACTIVATED rows,
//     counted every online sale as zero
//
// This path verifies a Razorpay signature over the whole purchase, has no
// partial concept, and refuses to activate anything unverified — so a
// confirmation IS the full amount, and recording it states what happened. It is
// fixed at the source: the ledger, the filters and the revenue aggregate all
// read amountPaid, and none of them infers payment from paymentStatus.
//
// The staff path was always correct — applyPaymentToPurchase has written
// amountPaid since it was added — and is unchanged here.
// ============================================================================

const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription-purchase.ts'), 'utf8')
const LEDGER = readFileSync(join(process.cwd(), 'src/app/api/laundry/payments-ledger/route.ts'), 'utf8')
const REPORTS = readFileSync(join(process.cwd(), 'src/app/api/laundry/subscriptions/reports/route.ts'), 'utf8')
const CONFIRM_ROUTE = readFileSync(join(process.cwd(), 'src/app/api/core/storefront/laundry-subscription/purchase/confirm/route.ts'), 'utf8')
const COLLECT_ROUTE = readFileSync(join(process.cwd(), 'src/app/api/laundry/subscriptions/collect/route.ts'), 'utf8')

/** The single update a verified confirmation performs. */
const confirmUpdate = (() => {
  const at = LIB.indexOf('const updated = await tx.subscriptionPurchase.update({')
  return LIB.slice(at, LIB.indexOf('})', LIB.indexOf('data: {', at)) + 2)
})()

describe('1 · a verified Razorpay confirmation records the money', () => {
  it('amountPaid is the purchase amount, not left at zero', () => {
    expect(confirmUpdate).toContain('amountPaid: purchase.amount')
  })

  it('the method is recorded explicitly as RAZORPAY', () => {
    expect(confirmUpdate).toContain('paymentMethod: "RAZORPAY"')
  })

  it('and the fields that were already right are untouched', () => {
    expect(confirmUpdate).toContain('status: "ACTIVATED"')
    expect(confirmUpdate).toContain('paymentStatus: "COMPLETED"')
    expect(confirmUpdate).toContain('paidAt: start')
    expect(confirmUpdate).toContain('gateway: payment?.gateway || purchase.gateway')
    expect(confirmUpdate).toContain('paymentTransactionId: payment?.paymentId')
    expect(confirmUpdate).toContain('paymentReference: payment?.orderId || purchase.paymentReference')
    expect(confirmUpdate).toContain('customerSubscriptionId: sub.id')
  })

  it('nothing is recorded unless the signature verified', () => {
    // The guard above the update is what makes "confirmation = full amount" true.
    expect(LIB).toContain('return { ok: false as const, pending: true, error: "Payment not verified — subscription not activated." }')
    expect(LIB).toContain('const verified = !!payment?.paymentId && verifyRazorpaySignature(')
  })

  it('there is no partial concept on this path to contradict it', () => {
    const fn = LIB.slice(LIB.indexOf('export async function confirmSubscriptionPurchase'), LIB.indexOf('export async function applyPaymentToPurchase'))
    expect(fn).not.toContain('amountPaid + ')
    expect(fn).not.toContain('PROCESSING')
  })
})

describe('2 · the ledger reads the recorded amount, it never infers one', () => {
  it('paid and balance come from amountPaid', () => {
    expect(LEDGER).toContain('const paid = r2(p.amountPaid)')
    expect(LEDGER).toContain('const balance = r2(Math.max(0, p.amount - p.amountPaid))')
  })

  it('paymentStatus is never used to decide that money arrived', () => {
    // Reported as a field; never a substitute for amountPaid.
    expect(LEDGER).not.toMatch(/paymentStatus\s*===\s*["']COMPLETED["']/)
    expect(LEDGER).not.toMatch(/paid\s*[:=][^\n]*paymentStatus/)
  })

  it('the shared filter classifies both channels off the same numbers', () => {
    expect((LEDGER.match(/matchesLedgerFilter\(filter, r\)/g) || []).length).toBe(2)
  })
})

describe('3 · subscription revenue picks it up for free', () => {
  it('revenue is SUM(amountPaid) over activated purchases', () => {
    expect(REPORTS).toContain('prisma.subscriptionPurchase.aggregate({ where: { businessId: platformId, status: "ACTIVATED" }, _sum: { amountPaid: true } })')
    expect(REPORTS).toContain('revenue: r2(revenueAgg._sum.amountPaid || 0)')
  })
})

describe('4 · the ledger scope decision is unchanged', () => {
  it('order-linked purchases stay out, so nothing is double counted', () => {
    expect(LEDGER).toContain('laundryOrderId: null,')
  })

  it('INITIATED and CANCELLED stay out — they never took money', () => {
    expect(LEDGER).toContain('status: { notIn: ["CANCELLED", "INITIATED"] },')
  })
})

describe('5 · nothing else about subscriptions moved', () => {
  it('the staff collection path is untouched and still the partial one', () => {
    expect(COLLECT_ROUTE).toContain('const res = await applyPaymentToPurchase(purchaseId, pay)')
    expect(LIB).toContain('data: { amountPaid: newPaid, paymentStatus: "PROCESSING" }')
    expect(LIB).toContain('const fullyPaid = newPaid >= purchase.amount - 0.001')
  })

  it('the storefront confirm route is unchanged', () => {
    expect(CONFIRM_ROUTE).toContain('const res = await confirmSubscriptionPurchase({')
    expect(CONFIRM_ROUTE).toContain('requiredRoles: ["CUSTOMER"]')
  })

  it('creation, activation, allowance, membership and plan rules are as they were', () => {
    expect(LIB).toContain('await grantAllowance(tx,')
    expect(LIB).toContain('const membershipId = await generateMembershipNumber()')
    expect(LIB).toContain('data: { businessId, customerId, planId, amount: plan.price,')
    expect(LIB).toContain('return { ok: false as const, error: "You already have an active subscription to this plan.", alreadyActive: true, subscriptionId: activeSub.id }')
  })

  it('delivery COD was not touched — it is still order-only', () => {
    const REC = readFileSync(join(process.cwd(), 'src/lib/laundry-payment-record.ts'), 'utf8')
    expect(REC).toContain('orderId: string')
    expect(REC).not.toContain('SubscriptionPurchase')
    expect(REC).not.toContain('subscriptionPurchase')
  })
})
