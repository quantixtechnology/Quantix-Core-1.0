import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { matchesLedgerFilter, type LedgerFilter } from '@/lib/laundry-adjustment'

// ============================================================================
// PAID MEANS MONEY MOVED.
//
// The Paid bucket asked one question — is the balance clear — and an order that
// never owed anything answers yes. So Payments & Ledger showed rows reading
// Total ₹0 / Paid ₹0 / Balance ₹0, whose own payment status said UNPAID, under
// Paid. On the live data that was 87 of 96 rows in the bucket.
//
// Paid is the third of three states the balance and the receipt decide
// together, and the other two already read both numbers:
//
//   nothing paid, something owed  -> Pending
//   something paid, something owed -> Partial
//   something paid, nothing owed   -> Paid
//
// An order that owes nothing and paid nothing is none of the three. It is not
// reclassified and not hidden — it stays in All, which is the complete ledger.
//
// Only the PAID arm changed. DISCOUNTED, REFUNDED and ALL keep the definitions
// they had, and TODAY is a different question answered by a different branch
// that never calls this function.
//
// Verified against the running app, signed in, on the real dataset:
//   ALL 124 rows · PAID was 96, is 9 · 87 removed, every one of them paid=0
//   (78 zero-total, 9 whose balance was cleared with no payment recorded)
//   nothing the new rule keeps was outside the old set — the bucket only shrank
//   fixtures: PENDING->Pending, PARTIAL->Partial, ZERO->neither,
//             PAID/DISCOUNT/REFUND->Paid, DISCOUNT+REFUND->Discounted,
//             REFUND->Refunded
// ============================================================================

type Row = { paid: number; balance: number; discount: number; refunded: number; refundDue: number }
const row = (o: Partial<Row>): Row => ({ paid: 0, balance: 0, discount: 0, refunded: 0, refundDue: 0, ...o })

/** The six rows a laundry ledger actually contains. */
const PAID_IN_FULL = row({ paid: 200, balance: 0 })
const UNPAID = row({ paid: 0, balance: 200 })
const PARTIALLY_PAID = row({ paid: 120, balance: 80 })
const ZERO_VALUE = row({ paid: 0, balance: 0 })                        // the reported bug
const DISCOUNTED_AND_PAID = row({ paid: 180, balance: 0, discount: 20 })
const REFUNDED_ROW = row({ paid: 200, balance: 0, refunded: 50 })
const REFUND_DUE_ROW = row({ paid: 200, balance: 0, refundDue: 50 })

describe('1 · a genuinely settled order is Paid', () => {
  it('paid > 0 and balance = 0 appears in PAID', () => {
    expect(matchesLedgerFilter('PAID', PAID_IN_FULL)).toBe(true)
  })

  it('an overpaid order (negative balance) is still Paid', () => {
    expect(matchesLedgerFilter('PAID', row({ paid: 220, balance: -20 }))).toBe(true)
  })
})

describe('2 · an unpaid order is never Paid', () => {
  it('paid = 0 and balance > 0 does NOT appear in PAID', () => {
    expect(matchesLedgerFilter('PAID', UNPAID)).toBe(false)
  })
})

describe('3 · a zero-value order is not a payment', () => {
  it('total 0 / paid 0 / balance 0 does NOT appear in PAID', () => {
    // The exact shape from the screenshot: ORD-…00173, ORD-…00160, ORD-…00156,
    // ORD-…00148 — every one of them displaying UNPAID.
    expect(matchesLedgerFilter('PAID', ZERO_VALUE)).toBe(false)
  })

  it('and it is not silently moved into Pending or Partial either', () => {
    expect(matchesLedgerFilter('PENDING', ZERO_VALUE)).toBe(false)
    expect(matchesLedgerFilter('PARTIAL', ZERO_VALUE)).toBe(false)
  })

  it('it remains in ALL, which is the complete ledger', () => {
    expect(matchesLedgerFilter('ALL', ZERO_VALUE)).toBe(true)
  })

  it('a balance cleared with no payment recorded is likewise not Paid', () => {
    // total > 0, nothing received, nothing owed: settled in the column without
    // any money having been taken.
    expect(matchesLedgerFilter('PAID', row({ paid: 0, balance: 0 }))).toBe(false)
  })
})

describe('4 · a partial payment is not Paid', () => {
  it('paid > 0 with balance still owing does NOT appear in PAID', () => {
    expect(matchesLedgerFilter('PAID', PARTIALLY_PAID)).toBe(false)
  })
})

describe('5 · PENDING is unchanged', () => {
  it('is exactly "nothing paid, something owed"', () => {
    expect(matchesLedgerFilter('PENDING', UNPAID)).toBe(true)
    expect(matchesLedgerFilter('PENDING', PARTIALLY_PAID)).toBe(false)
    expect(matchesLedgerFilter('PENDING', PAID_IN_FULL)).toBe(false)
    expect(matchesLedgerFilter('PENDING', ZERO_VALUE)).toBe(false)
  })
})

describe('6 · PARTIAL is unchanged', () => {
  it('is exactly "something paid, something owed"', () => {
    expect(matchesLedgerFilter('PARTIAL', PARTIALLY_PAID)).toBe(true)
    expect(matchesLedgerFilter('PARTIAL', UNPAID)).toBe(false)
    expect(matchesLedgerFilter('PARTIAL', PAID_IN_FULL)).toBe(false)
    expect(matchesLedgerFilter('PARTIAL', ZERO_VALUE)).toBe(false)
  })
})

describe('7 · DISCOUNTED is unchanged', () => {
  it('is any row carrying a discount, whatever its payment state', () => {
    expect(matchesLedgerFilter('DISCOUNTED', DISCOUNTED_AND_PAID)).toBe(true)
    expect(matchesLedgerFilter('DISCOUNTED', row({ paid: 0, balance: 180, discount: 20 }))).toBe(true)
    expect(matchesLedgerFilter('DISCOUNTED', PAID_IN_FULL)).toBe(false)
  })

  it('and a discounted order that was actually paid is still Paid too', () => {
    expect(matchesLedgerFilter('PAID', DISCOUNTED_AND_PAID)).toBe(true)
  })
})

describe('8 · REFUNDED is unchanged', () => {
  it('is a settled refund OR one still owed', () => {
    expect(matchesLedgerFilter('REFUNDED', REFUNDED_ROW)).toBe(true)
    expect(matchesLedgerFilter('REFUNDED', REFUND_DUE_ROW)).toBe(true)
    expect(matchesLedgerFilter('REFUNDED', PAID_IN_FULL)).toBe(false)
  })
})

describe('9 · ALL is unchanged — it returns everything', () => {
  it('every row, in every state', () => {
    for (const r of [PAID_IN_FULL, UNPAID, PARTIALLY_PAID, ZERO_VALUE, DISCOUNTED_AND_PAID, REFUNDED_ROW, REFUND_DUE_ROW]) {
      expect(matchesLedgerFilter('ALL', r)).toBe(true)
    }
  })

  it('and an unknown filter still falls through to everything', () => {
    expect(matchesLedgerFilter('NOPE' as LedgerFilter, ZERO_VALUE)).toBe(true)
  })
})

describe('10 · TODAY is a different branch and is untouched', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/payments-ledger/route.ts'), 'utf8')
  const today = API.slice(API.indexOf('if ((u.searchParams.get("filter") || "") === "TODAY")'), API.indexOf('const q = (u.searchParams.get("search")'))

  it('it returns before the order query is ever built', () => {
    expect(today).toContain('return NextResponse.json(')
    expect(today).toContain('summary: summariseToday(rows)')
    expect(today).toContain('data: rows.filter(isMoneyTransaction)')
  })

  it('and it never calls this filter', () => {
    expect(today).not.toContain('matchesLedgerFilter')
    // Still exactly the two non-TODAY call sites: orders and subscriptions.
    expect((API.match(/matchesLedgerFilter\(filter, r\)/g) || []).length).toBe(2)
  })

  it('TODAY is not even a value this filter accepts', () => {
    const ADJ = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
    expect(ADJ).toContain('export type LedgerFilter = "ALL" | "PENDING" | "PARTIAL" | "PAID" | "DISCOUNTED" | "REFUNDED"')
    expect(ADJ).not.toContain('"TODAY"')
  })
})
