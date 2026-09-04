import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  businessDayBounds, summariseToday, isOnlinePayment, isCollected, isMoneyTransaction,
  LEDGER_TIMEZONE, SUBSCRIPTION_COVERAGE, REFUND, type TodayTransaction,
} from '@/lib/laundry-today-transactions'

// ============================================================================
// TODAY'S TRANSACTIONS — WHAT MONEY MOVED, NOT WHAT WAS ORDERED.
//
// The rest of Payments & Ledger answers "what is owed on each order?". This
// answers what a counter asks at closing, so it is keyed on the moment a
// payment was recorded: an order raised yesterday and paid today belongs here,
// an order raised today and unpaid does not. Nothing is inferred from order
// status or balance — a row exists only where a payment record does.
//
// Two existing timestamps carry that, and no new record was created:
//   LaundryPayment.createdAt     written in the same transaction that moves
//                                amountPaid, by every payment path.
//   SubscriptionPurchase.paidAt  a subscription settled on its own.
//
// The three totals are kept honest by what they exclude. Subscription allowance
// is a ledger entry with no money behind it, so it is shown separately and
// never summed as collection. Refunds are stored negative by the refund writer
// and are reported as an outflow, not hidden. Collected excludes both; Net is
// Collected minus Refunds.
//
// Allowance coverage is not a transaction either: no money arrived and no
// instrument was used, so it is kept out of the list and the count as well as
// the totals, and reported on a line of its own with the number of orders it
// covered. Five payments, one subscription payment, one refund and one covered
// order read as SEVEN transactions, not eight.
//
// Measured against the running app: 5 payments + 1 subscription payment + 1
// refund + 1 covered order → transactions 7, collected ₹3500, refunds ₹75,
// net ₹3425, subscriptionCovered ₹70 across 1 order, and no SUBSCRIPTION key
// in byMethod.
// ============================================================================

const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/payments-ledger/route.ts'), 'utf8')
const UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-payments-ledger.tsx'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

const txn = (o: Partial<TodayTransaction>): TodayTransaction => ({
  id: 'x', at: new Date().toISOString(), kind: 'LAUNDRY', customerName: null,
  reference: null, transactionRef: null, method: 'CASH', online: false, amount: 0, status: 'SUCCESS', ...o,
})

describe('1 · the day boundary is the business day, not UTC', () => {
  it('an IST day starts at 18:30 UTC the evening before', () => {
    const b = businessDayBounds(new Date('2026-09-04T10:00:00Z'))
    expect(b.dayKey).toBe('2026-09-04')
    expect(b.start.toISOString()).toBe('2026-09-03T18:30:00.000Z')
    expect(b.end.toISOString()).toBe('2026-09-04T18:30:00.000Z')
  })

  it('23:00 IST is still today, though UTC already calls it tomorrow', () => {
    // 17:30Z on the 4th is 23:00 IST on the 4th.
    expect(businessDayBounds(new Date('2026-09-04T17:30:00Z')).dayKey).toBe('2026-09-04')
  })

  it('00:30 IST is already tomorrow, though UTC still calls it today', () => {
    // 19:00Z on the 4th is 00:30 IST on the 5th.
    expect(businessDayBounds(new Date('2026-09-04T19:00:00Z')).dayKey).toBe('2026-09-05')
  })

  it('the zone is the platform default, not a second definition', () => {
    expect(LEDGER_TIMEZONE).toBe('Asia/Kolkata')
  })

  it('the offset is measured, never hardcoded, so another zone still works', () => {
    const utc = businessDayBounds(new Date('2026-09-04T10:00:00Z'), 'UTC')
    expect(utc.start.toISOString()).toBe('2026-09-04T00:00:00.000Z')
  })
})

describe('2 · what counts as collected money', () => {
  it('order payments and subscription payments do', () => {
    expect(isCollected(txn({ kind: 'LAUNDRY' }))).toBe(true)
    expect(isCollected(txn({ kind: 'SUBSCRIPTION' }))).toBe(true)
  })

  it('allowance coverage and refunds do not', () => {
    expect(isCollected(txn({ kind: 'SUBSCRIPTION_COVERED' }))).toBe(false)
    expect(isCollected(txn({ kind: 'REFUND' }))).toBe(false)
  })

  it('subscription allowance never inflates the totals', () => {
    const s = summariseToday([
      txn({ id: 'a', kind: 'LAUNDRY', method: 'CASH', amount: 300 }),
      txn({ id: 'b', kind: 'SUBSCRIPTION_COVERED', method: SUBSCRIPTION_COVERAGE, amount: 70 }),
    ])
    expect(s.collected).toBe(300)
    expect(s.subscriptionCovered).toBe(70)
    expect(s.byMethod[SUBSCRIPTION_COVERAGE]).toBeUndefined()
  })

  it('nor the transaction COUNT — it is not a payment', () => {
    const s = summariseToday([
      txn({ id: 'a', kind: 'LAUNDRY', method: 'CASH', amount: 300 }),
      txn({ id: 'b', kind: 'SUBSCRIPTION_COVERED', method: SUBSCRIPTION_COVERAGE, amount: 70 }),
      txn({ id: 'c', kind: 'SUBSCRIPTION_COVERED', method: SUBSCRIPTION_COVERAGE, amount: 30 }),
    ])
    expect(s.transactions).toBe(1)                 // the payment only
    expect(s.subscriptionCoveredOrders).toBe(2)    // reported on its own line
    expect(s.subscriptionCovered).toBe(100)
  })

  it('and it is not a money transaction, so it stays out of the list', () => {
    expect(isMoneyTransaction(txn({ kind: 'SUBSCRIPTION_COVERED' }))).toBe(false)
    for (const k of ['LAUNDRY', 'SUBSCRIPTION', 'REFUND'] as const) {
      expect(isMoneyTransaction(txn({ kind: k })), k).toBe(true)
    }
  })

  it('a refund is an outflow: excluded from Collected, netted off', () => {
    const s = summariseToday([
      txn({ id: 'a', kind: 'LAUNDRY', method: 'CASH', amount: 300 }),
      txn({ id: 'r', kind: 'REFUND', method: REFUND, amount: -50 }),
    ])
    expect(s.collected).toBe(300)
    expect(s.refunds).toBe(50)          // reported as a magnitude
    expect(s.net).toBe(250)             // net = collected − refunds
    expect(s.byMethod[REFUND]).toBeUndefined()
  })

  it('the worked example: five payments, one subscription, one refund, one covered', () => {
    const s = summariseToday([
      txn({ id: '1', kind: 'LAUNDRY', method: 'CASH', amount: 100 }),
      txn({ id: '2', kind: 'LAUNDRY', method: 'UPI', amount: 200 }),
      txn({ id: '3', kind: 'LAUNDRY', method: 'CARD', amount: 300 }),
      txn({ id: '4', kind: 'LAUNDRY', method: 'BANK', amount: 400 }),
      txn({ id: '5', kind: 'LAUNDRY', method: 'LINK', amount: 500 }),
      txn({ id: '6', kind: 'SUBSCRIPTION', method: 'CASH', amount: 2000 }),
      txn({ id: '7', kind: 'REFUND', method: REFUND, amount: -75 }),
      txn({ id: '8', kind: 'SUBSCRIPTION_COVERED', method: SUBSCRIPTION_COVERAGE, amount: 70 }),
    ])
    // Eight rows, SEVEN transactions — the covered order is not one.
    expect(s.transactions).toBe(7)
    expect(s).toMatchObject({
      collected: 3500, refunds: 75, net: 3425,
      subscriptionCovered: 70, subscriptionCoveredOrders: 1,
    })
    expect(s.byMethod).toEqual({ CASH: 2100, UPI: 200, CARD: 300, BANK: 400, LINK: 500 })
  })

  it('an online payment is grouped under Online, keeping its own method off the tiles', () => {
    const s = summariseToday([
      txn({ id: 'a', kind: 'LAUNDRY', method: 'UPI', online: true, amount: 150 }),
      txn({ id: 'b', kind: 'SUBSCRIPTION', method: 'RAZORPAY', online: true, amount: 1500 }),
    ])
    expect(s.byMethod).toEqual({ ONLINE: 1650 })
  })
})

describe('3 · online payments are recognised, never invented', () => {
  it('a Razorpay reference or note identifies one', () => {
    expect(isOnlinePayment({ reference: 'pay_ABC123' })).toBe(true)
    expect(isOnlinePayment({ note: 'Online payment (Razorpay) via storefront' })).toBe(true)
  })

  it('a counter payment is not mistaken for one', () => {
    expect(isOnlinePayment({ reference: 'TXN-8891', note: 'UPI at counter' })).toBe(false)
    expect(isOnlinePayment({})).toBe(false)
  })

  it('the recorded method is preserved — no gateway value is persisted', () => {
    // The storefront records Razorpay as UPI; the indicator is display only.
    expect(API).not.toMatch(/data:\s*\{[^}]*gateway/)
    expect(API).not.toContain('laundryPayment.update')
  })
})

describe('4 · the query reads only real payment records', () => {
  it('order money comes from LaundryPayment.createdAt, successful rows only', () => {
    expect(API).toContain('status: "SUCCESS", createdAt: { gte: start, lt: end }')
  })

  it('subscription money comes from paidAt', () => {
    expect(API).toContain('paidAt: { gte: start, lt: end }')
  })

  it('an order-linked subscription is left out, so nothing is double-counted', () => {
    expect(API).toContain('laundryOrderId: null, paidAt: { gte: start, lt: end }')
  })

  it('the returned list carries money transactions only', () => {
    expect(API).toContain('data: rows.filter(isMoneyTransaction),')
    // The summary still sees every row, so coverage is reported, just not listed.
    expect(API).toContain('summary: summariseToday(rows),')
  })

  it('nothing is inferred from order status or balance', () => {
    const branch = API.slice(API.indexOf('if ((u.searchParams.get("filter") || "") === "TODAY")'), API.indexOf('const q = (u.searchParams.get("search")'))
    expect(branch).not.toContain('balanceDue')
    expect(branch).not.toContain('paymentStatus:')
    expect(branch).not.toContain('financialSummary')
  })

  it('it only reads — no payment writer is touched anywhere in the route', () => {
    for (const w of ['laundryPayment.create', 'laundryPayment.update', 'subscriptionPurchase.create', 'subscriptionPurchase.update', 'applyPaymentToPurchase']) {
      expect(API, w).not.toContain(w)
    }
  })
})

describe('5 · the existing ledger is untouched', () => {
  it('TODAY is an added branch that returns before the order query', () => {
    const today = API.indexOf('=== "TODAY"')
    const orders = API.indexOf('const orders = await prisma.laundryOrder.findMany(')
    expect(today).toBeGreaterThan(-1)
    expect(today).toBeLessThan(orders)
  })

  it('every original filter still exists and still uses matchesLedgerFilter', () => {
    expect((API.match(/matchesLedgerFilter\(filter, r\)/g) || []).length).toBe(2)
    const ADJ = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
    expect(ADJ).toContain('export type LedgerFilter = "ALL" | "PENDING" | "PARTIAL" | "PAID" | "DISCOUNTED" | "REFUNDED"')
  })

  it('the UI keeps all six and adds Today alongside them', () => {
    for (const f of ['"ALL", label: "All"', '"PENDING", label: "Pending"', '"PAID", label: "Paid"',
                     '"PARTIAL", label: "Partial"', '"DISCOUNTED", label: "Discounted"', '"REFUNDED", label: "Refunded"']) {
      expect(UI, f).toContain(f)
    }
    expect(UI).toContain('{ key: "TODAY", label: "Today" }')
  })

  it('the order table is preserved, not replaced', () => {
    // Still the order table, service column and all — guarded for the
    // subscription rows added earlier, not removed.
    expect(UI).toContain('orderServiceLabel(r.services)')
    expect(UI).toContain('orderWeightLabel(r.totalWeightKg)')
    expect(UI).toContain('onClick={() => { if (r.kind !== "SUBSCRIPTION") setOpenOrder(r) }}')
  })

  it('times are shown on the business clock', () => {
    expect(UI).toContain('timeZone: LEDGER_TIMEZONE')
  })

  it('coverage is displayed apart from the money tiles, with its order count', () => {
    expect(UI).toContain('Subscription Covered</p>')
    expect(UI).toContain('{todaySummary.subscriptionCoveredOrders} order')
    expect(UI).toContain('allowance consumed, not money received')
  })
})

describe('6 · no schema change', () => {
  it('LaundryPayment still has only createdAt as its time field', () => {
    const m = SCHEMA.slice(SCHEMA.indexOf('model LaundryPayment {'), SCHEMA.indexOf('\n}', SCHEMA.indexOf('model LaundryPayment {')))
    expect(m).toContain('createdAt        DateTime @default(now())')
    expect(m).not.toContain('paidAt')
    expect(m).not.toContain('settledAt')
  })

  it('SubscriptionPurchase is unchanged', () => {
    const m = SCHEMA.slice(SCHEMA.indexOf('model SubscriptionPurchase {'), SCHEMA.indexOf('\n}', SCHEMA.indexOf('model SubscriptionPurchase {')))
    expect(m).toContain('paidAt                 DateTime?')
    expect(m).toContain('amountPaid             Float     @default(0)')
  })

  it('the documented limitation is recorded where it will be found', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-today-transactions.ts'), 'utf8')
    expect(LIB).toContain('KNOWN LIMITATION')
    expect(LIB).toContain('PARTIAL subscription collection')
  })
})
