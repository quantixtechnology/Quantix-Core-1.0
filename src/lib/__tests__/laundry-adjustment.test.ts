import { describe, it, expect } from 'vitest'
import {
  splitAdjustment, maxCompensation, summarise, validateCompensation, canRefund,
  isSettled, reasonLabel,
} from '@/lib/laundry-adjustment'

const PAID = { grandTotal: 500, amountPaid: 500, balanceDue: 0 }
const UNPAID = { grandTotal: 500, amountPaid: 0, balanceDue: 500 }

describe('acceptance: paid order — compensation becomes a refund', () => {
  const split = splitAdjustment(PAID, [], 100)
  const rows = [{ amount: 100, ...split, refundStatus: 'PENDING' }]
  const s = summarise(PAID, rows)

  it('the whole amount is refundable, none applied to a balance', () => {
    expect(split).toEqual({ refundable: 100, appliedToDue: 0 })
  })

  it('reports Refund Due ₹100', () => {
    expect(s.refundDue).toBe(100)
    expect(s.refunded).toBe(0)
  })

  // The single most important guarantee.
  it('does NOT pretend the invoice was ₹400', () => {
    expect(s.invoiceTotal).toBe(500)
    expect(s.paid).toBe(500)
  })
})

describe('acceptance: unpaid order — compensation reduces what is owed', () => {
  const split = splitAdjustment(UNPAID, [], 100)
  it('nothing is refundable; it comes off the balance', () => {
    expect(split).toEqual({ refundable: 0, appliedToDue: 100 })
  })

  it('the invoice still reads ₹500 while ₹400 is payable', () => {
    const s = summarise({ ...UNPAID, balanceDue: 400 }, [{ amount: 100, ...split, refundStatus: 'NOT_REQUIRED' }])
    expect(s.invoiceTotal).toBe(500)
    expect(s.balance).toBe(400)
    expect(s.refundDue).toBe(0)
  })
})

describe('partly paid orders split correctly', () => {
  it('₹300 paid of ₹500, ₹200 compensation → ₹200 refundable', () => {
    expect(splitAdjustment({ grandTotal: 500, amountPaid: 300, balanceDue: 200 }, [], 200))
      .toEqual({ refundable: 200, appliedToDue: 0 })
  })

  it('₹100 paid of ₹500, ₹200 compensation → ₹100 back, ₹100 off the balance', () => {
    expect(splitAdjustment({ grandTotal: 500, amountPaid: 100, balanceDue: 400 }, [], 200))
      .toEqual({ refundable: 100, appliedToDue: 100 })
  })
})

describe('multiple adjustments cannot over-refund', () => {
  it('a second adjustment cannot claim paid money the first already took', () => {
    const first = { amount: 100, ...splitAdjustment(PAID, [], 100), refundStatus: 'PENDING' }
    // Only ₹400 of the ₹500 payment is still unclaimed.
    const second = splitAdjustment({ ...PAID, balanceDue: 0 }, [first], 450)
    expect(second.refundable).toBe(400)
    expect(second.appliedToDue).toBe(50)
  })

  it('refuses compensation beyond the order value', () => {
    expect(validateCompensation(PAID, [], 501)).toContain('cannot exceed')
    expect(validateCompensation(UNPAID, [], 501)).toContain('cannot exceed')
  })

  it('counts what was already given when capping', () => {
    const rows = [{ amount: 400, refundable: 400, appliedToDue: 0, refundStatus: 'PENDING' }]
    expect(maxCompensation(PAID, rows)).toBe(100)
    expect(validateCompensation(PAID, rows, 150)).toContain('cannot exceed')
    expect(validateCompensation(PAID, rows, 100)).toBeNull()
  })

  it('refuses a fully compensated order outright', () => {
    const rows = [{ amount: 500, refundable: 500, appliedToDue: 0, refundStatus: 'PENDING' }]
    expect(validateCompensation(PAID, rows, 1)).toContain('already been fully compensated')
  })

  it('refuses zero and negative amounts', () => {
    expect(validateCompensation(PAID, [], 0)).toBeTruthy()
    expect(validateCompensation(PAID, [], -50)).toBeTruthy()
    expect(validateCompensation(PAID, [], NaN)).toBeTruthy()
  })
})

describe('money is never described as returned before it is', () => {
  it('a pending refund counts as due, not refunded', () => {
    const s = summarise(PAID, [{ amount: 100, refundable: 100, appliedToDue: 0, refundStatus: 'PENDING' }])
    expect(s.refundDue).toBe(100)
    expect(s.refunded).toBe(0)
  })

  it('processing is still not refunded', () => {
    const s = summarise(PAID, [{ amount: 100, refundable: 100, appliedToDue: 0, refundStatus: 'PROCESSING' }])
    expect(s.refunded).toBe(0)
    expect(s.refundDue).toBe(100)
  })

  it('a failed refund is still owed', () => {
    const s = summarise(PAID, [{ amount: 100, refundable: 100, appliedToDue: 0, refundStatus: 'FAILED' }])
    expect(s.refundDue).toBe(100)
    expect(s.refunded).toBe(0)
  })

  it('only REFUNDED counts as settled', () => {
    expect(isSettled('REFUNDED')).toBe(true)
    for (const s of ['PENDING', 'PROCESSING', 'FAILED', 'NOT_REQUIRED']) expect(isSettled(s)).toBe(false)
  })

  it('a completed refund moves from due to refunded', () => {
    const s = summarise(PAID, [{ amount: 100, refundable: 100, appliedToDue: 0, refundStatus: 'REFUNDED' }])
    expect(s.refunded).toBe(100)
    expect(s.refundDue).toBe(0)
  })

  it('a settled refund cannot be refunded again', () => {
    expect(canRefund('PENDING')).toBe(true)
    expect(canRefund('FAILED')).toBe(true)   // retry is legitimate
    expect(canRefund('REFUNDED')).toBe(false)
    expect(canRefund('PROCESSING')).toBe(false)
    expect(canRefund('NOT_REQUIRED')).toBe(false)
  })
})

describe('presentation', () => {
  it('reasons read as business language', () => {
    expect(reasonLabel('EXPRESS_DELAY')).toBe('Express delivery delayed')
    expect(reasonLabel('GOODWILL')).toBe('Goodwill')
  })

  it('rounds to paise rather than accumulating float error', () => {
    const s = summarise(PAID, [
      { amount: 33.33, refundable: 33.33, appliedToDue: 0, refundStatus: 'PENDING' },
      { amount: 33.33, refundable: 33.33, appliedToDue: 0, refundStatus: 'PENDING' },
    ])
    expect(s.compensation).toBe(66.66)
  })
})

// ── Discounts and schemes (Payments & Ledger) ───────────────────────────────
import { discountAmount, schemeRefusal, financialSummary, matchesLedgerFilter, discountHint, type OrderMoney } from '@/lib/laundry-adjustment'

describe('acceptance: discount arithmetic', () => {
  it('TEST 1 — ₹500 invoice, ₹100 discount → ₹400 payable', () => {
    const f = financialSummary({ grandTotal: 500, amountPaid: 0, balanceDue: 400 },
      [{ amount: 100, appliedToDue: 100, refundable: 0, refundStatus: 'NOT_REQUIRED' }])
    expect(f.invoiceTotal).toBe(500)
    expect(f.discount).toBe(100)
    expect(f.netPayable).toBe(400)
  })

  it('TEST 2 — subscription ₹300 + ₹50 discount on ₹500 → ₹150 payable', () => {
    const f = financialSummary(
      { grandTotal: 500, amountPaid: 0, balanceDue: 150, subscriptionCoveredAmount: 300 },
      [{ amount: 50, appliedToDue: 50, refundable: 0, refundStatus: 'NOT_REQUIRED' }])
    expect(f.subscriptionCovered).toBe(300)
    expect(f.discount).toBe(50)
    expect(f.netPayable).toBe(150)
    // Coverage and discount stay separate lines, never netted into one.
    expect(f.subscriptionCovered + f.discount + f.netPayable).toBe(f.invoiceTotal)
  })

  it('TEST 3 — paid ₹500, later ₹100 discount → ₹100 refund due, payment intact', () => {
    const f = financialSummary({ grandTotal: 500, amountPaid: 500, balanceDue: 0 },
      [{ amount: 100, appliedToDue: 0, refundable: 100, refundStatus: 'PENDING' }])
    expect(f.paid).toBe(500)
    expect(f.refundDue).toBe(100)
    expect(f.invoiceTotal).toBe(500)
  })

  it('TEST 4 — a ₹100 fixed scheme gives ₹100', () => {
    expect(discountAmount('FIXED', 100, 500)).toBe(100)
  })

  it('TEST 5 — a 10% scheme on ₹500 gives ₹50', () => {
    expect(discountAmount('PERCENT', 10, 500)).toBe(50)
  })

  it('honours the scheme cap and never exceeds the order', () => {
    expect(discountAmount('PERCENT', 50, 500, 100)).toBe(100)
    expect(discountAmount('FIXED', 900, 500)).toBe(500)
  })
})

describe('TEST 6 — an unusable scheme is refused, with the reason', () => {
  const now = new Date('2026-08-11T10:00:00')
  it('expired', () => {
    expect(schemeRefusal({ status: 'ACTIVE', endAt: '2026-08-01' }, 500, now)).toContain('expired')
  })
  it('not started', () => {
    expect(schemeRefusal({ status: 'SCHEDULED', startAt: '2026-09-01' }, 500, now)).toContain('not started')
  })
  it('switched off', () => {
    expect(schemeRefusal({ status: 'ACTIVE', enabled: false }, 500, now)).toContain('switched off')
  })
  it('paused or cancelled', () => {
    expect(schemeRefusal({ status: 'PAUSED' }, 500, now)).toContain('paused')
  })
  it('below the minimum order value', () => {
    expect(schemeRefusal({ status: 'ACTIVE', minOrderValue: 1000 }, 500, now)).toContain('minimum order')
  })
  it('accepts a live scheme', () => {
    expect(schemeRefusal({ status: 'ACTIVE', enabled: true, startAt: '2026-08-01', endAt: '2026-12-31', minOrderValue: 100 }, 500, now)).toBeNull()
  })
})

describe('ledger filters', () => {
  const row = (o: Partial<{ paid: number; balance: number; discount: number; refunded: number; refundDue: number }>) =>
    ({ paid: 0, balance: 0, discount: 0, refunded: 0, refundDue: 0, ...o })

  it('separates pending, partial and paid', () => {
    expect(matchesLedgerFilter('PENDING', row({ balance: 500 }))).toBe(true)
    expect(matchesLedgerFilter('PENDING', row({ balance: 200, paid: 300 }))).toBe(false)
    expect(matchesLedgerFilter('PARTIAL', row({ balance: 200, paid: 300 }))).toBe(true)
    expect(matchesLedgerFilter('PAID', row({ paid: 500 }))).toBe(true)
  })

  it('finds discounted and refunded orders', () => {
    expect(matchesLedgerFilter('DISCOUNTED', row({ discount: 50 }))).toBe(true)
    expect(matchesLedgerFilter('REFUNDED', row({ refundDue: 100 }))).toBe(true)
    expect(matchesLedgerFilter('REFUNDED', row({ refunded: 100 }))).toBe(true)
  })

  // TEST 7: a delivered, fully paid order still belongs in the ledger.
  it('ALL keeps every order, whatever its position', () => {
    expect(matchesLedgerFilter('ALL', row({ paid: 500 }))).toBe(true)
    expect(matchesLedgerFilter('ALL', row({}))).toBe(true)
  })
})

// ── The wording on the discount form ────────────────────────────────────────
// The reported case: invoice ₹42, fully covered by subscription, ₹42 paid, ₹10
// already discounted — and the form said "Up to ₹32.00 may still be given",
// which is maxCompensation() and means nothing at a counter.
describe('discount guidance is plain language', () => {
  it('a fully paid order says what was paid and what a discount will do', () => {
    const h = discountHint({ grandTotal: 42, amountPaid: 42, balanceDue: 0 },
      [{ amount: 10, appliedToDue: 0, refundable: 10, refundStatus: 'PENDING' }])
    expect(h.status).toBe('Already paid: ₹42.00')
    expect(h.effect).toBe('A discount now will create a refund due to the customer.')
    // ₹42 taken minus the ₹10 already claimed.
    expect(h.refundLimit).toBe('Maximum refund available: ₹32.00')
  })

  it('an unpaid order talks about what the customer pays, not refunds', () => {
    const h = discountHint({ grandTotal: 500, amountPaid: 0, balanceDue: 500 }, [])
    expect(h.status).toBe('Amount payable: ₹500.00')
    expect(h.effect).toBe('A discount will reduce what the customer pays.')
    expect(h.refundLimit).toBeNull()
  })

  it('a part-paid order explains the order the discount is applied in', () => {
    const h = discountHint({ grandTotal: 500, amountPaid: 300, balanceDue: 200 }, [])
    expect(h.status).toBe('Paid ₹300.00 · ₹200.00 still to pay')
    expect(h.effect).toContain('reduces what is still to pay first')
    expect(h.refundLimit).toBe('Maximum refund available: ₹300.00')
  })

  it('drops the refund line once nothing more can come back', () => {
    const h = discountHint({ grandTotal: 500, amountPaid: 500, balanceDue: 0 },
      [{ amount: 500, appliedToDue: 0, refundable: 500, refundStatus: 'PENDING' }])
    expect(h.refundLimit).toBeNull()
  })

  // No internal terminology may reach the user.
  it('never uses internal vocabulary', () => {
    const cases: OrderMoney[] = [
      { grandTotal: 42, amountPaid: 42, balanceDue: 0 },
      { grandTotal: 500, amountPaid: 0, balanceDue: 500 },
      { grandTotal: 500, amountPaid: 300, balanceDue: 200 },
    ]
    for (const m of cases) {
      const all = Object.values(discountHint(m, [])).join(' ')
      for (const word of ['compensation', 'maxCompensation', 'appliedToDue', 'refundable', 'balanceDue', 'grandTotal', 'adjustment']) {
        expect(all.toLowerCase()).not.toContain(word.toLowerCase())
      }
    }
  })
})
