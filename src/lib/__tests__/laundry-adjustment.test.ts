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
