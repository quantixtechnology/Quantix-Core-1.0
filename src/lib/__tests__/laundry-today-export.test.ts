import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  toCsv, toWorkbookAoa, exportRow, exportFilename, exportMethod, exportTime,
  EXPORT_COLUMNS, TXN_LABEL, AMOUNT_COLUMN, summariseToday,
  type TodayTransaction, type TodaySummary,
} from '@/lib/laundry-today-transactions'

// ============================================================================
// THE DAY'S TAKINGS, AS A FILE.
//
// A book-keeper wants the same thing the counter sees, in a spreadsheet. So the
// export takes the rows the Today API already returned and the totals it
// already computed — it runs no query of its own and recomputes nothing, which
// is the only way a file and the screen it came from cannot disagree.
//
// Allowance coverage never reaches the transaction rows because the API does
// not put it there; it appears once, in the summary block, where it is labelled
// as covered orders rather than money. Refunds keep their negative sign so a
// spreadsheet still reads them as money out.
// ============================================================================

const UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-payments-ledger.tsx'), 'utf8')
const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/payments-ledger/route.ts'), 'utf8')
const ADJ = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')

const txn = (o: Partial<TodayTransaction>): TodayTransaction => ({
  id: 'x', at: '2026-09-04T06:30:00.000Z', kind: 'LAUNDRY', customerName: 'Asha',
  reference: 'ORD-1', transactionRef: null, method: 'CASH', online: false, amount: 100, status: 'SUCCESS', ...o,
})

describe('1 · CSV headers are exactly the agreed columns', () => {
  it('in order, quoted', () => {
    expect(toCsv([]).split('\n')[0])
      .toBe('"Time","Customer","Order / Subscription","Type","Method","Amount","Status"')
  })

  it('and the screen renders that same list', () => {
    expect(EXPORT_COLUMNS).toEqual(['Time', 'Customer', 'Order / Subscription', 'Type', 'Method', 'Amount', 'Status'])
    expect(UI).toContain('{EXPORT_COLUMNS.map((h, i) => (')
  })
})

describe('2 · CSV escaping survives real customer data', () => {
  it('a comma does not split a field', () => {
    const line = toCsv([txn({ customerName: 'Rao, Asha' })]).split('\n')[1]
    expect(line).toContain('"Rao, Asha"')
    // 7 quoted fields, whatever they contain.
    expect(line.match(/"(?:[^"]|"")*"/g)).toHaveLength(7)
  })

  it('a quote is doubled', () => {
    expect(toCsv([txn({ customerName: 'Asha "Bittu" Rao' })])).toContain('"Asha ""Bittu"" Rao"')
  })

  it('a newline stays inside its field', () => {
    const line = toCsv([txn({ reference: 'ORD-1\nline2' })])
    expect(line).toContain('"ORD-1\nline2"')
    expect(line.match(/"(?:[^"]|"")*"/g)!.length).toBe(14) // header 7 + row 7
  })
})

describe('3 · Excel carries the summary then the table', () => {
  const summary: TodaySummary = {
    transactions: 2, collected: 2100, refunds: 75, net: 2025,
    subscriptionCovered: 70, subscriptionCoveredOrders: 1, byMethod: { CASH: 2100 },
  }
  const rows = [txn({ id: 'a', amount: 100 }), txn({ id: 'b', kind: 'SUBSCRIPTION', reference: 'Gold Plan', amount: 2000 })]
  const aoa = toWorkbookAoa(rows, summary, '2026-09-04')

  it('the summary block uses the API figures verbatim', () => {
    expect(aoa[0]).toEqual(["Today's Transactions", '2026-09-04'])
    expect(aoa.slice(2, 8)).toEqual([
      ['Transactions', 2], ['Collected', 2100], ['Refunds', 75],
      ['Net Collected', 2025], ['Subscription Covered', 70], ['Subscription Covered Orders', 1],
    ])
  })

  it('the table header follows, then one row per transaction', () => {
    expect(aoa[9]).toEqual([...EXPORT_COLUMNS])
    expect(aoa).toHaveLength(10 + rows.length)
  })

  it('amounts are numbers, so a spreadsheet can total them', () => {
    expect(typeof aoa[10][AMOUNT_COLUMN]).toBe('number')
    expect(AMOUNT_COLUMN).toBe(5)
  })

  it('the sheet is named and the amount column formatted', () => {
    expect(UI).toContain(`book_append_sheet(wb, ws, "Today's Transactions")`)
    expect(UI).toContain("cell.z = \"#,##0.00\"")
  })
})

describe('4 · only today’s money rows, exactly as the API returned them', () => {
  it('the export is handed the state the API filled — no second query', () => {
    expect(UI).toContain('toCsv(today)')
    expect(UI).toContain('toWorkbookAoa(today, todaySummary, todayKey)')
    // No fetch inside either handler.
    // Just the two handlers — the slice must not run on into load(), which
    // legitimately fetches.
    const handlers = UI.slice(UI.indexOf('const downloadCsv'), UI.indexOf('XLSX.writeFile(wb, exportFilename(todayKey, "xlsx"))'))
    expect(handlers).not.toContain('fetch(')
    expect(handlers).not.toContain('summariseToday')   // totals are not recomputed
  })

  it('and the API already excludes allowance coverage from those rows', () => {
    expect(API).toContain('data: rows.filter(isMoneyTransaction),')
  })
})

describe('5 · subscription payments are exported', () => {
  it('with the plan as the reference and the label Subscription', () => {
    const r = exportRow(txn({ kind: 'SUBSCRIPTION', reference: 'Gold Plan', method: 'CASH', amount: 2000 }))
    expect(r[2]).toBe('Gold Plan')
    expect(r[3]).toBe('Subscription')
    expect(r[5]).toBe(2000)
  })

  it('an online one keeps the screen’s wording', () => {
    expect(exportMethod({ method: 'RAZORPAY', online: true })).toBe('RAZORPAY (Online / Razorpay)')
    expect(exportMethod({ method: 'UPI', online: true })).toBe('UPI (Online / Razorpay)')
    expect(exportMethod({ method: 'CASH', online: false })).toBe('CASH')
  })
})

describe('6 · a refund exports as money out', () => {
  it('the amount stays negative', () => {
    const r = exportRow(txn({ kind: 'REFUND', method: 'REFUND', amount: -75 }))
    expect(r[5]).toBe(-75)
    expect(r[3]).toBe('Refund')
    expect(toCsv([txn({ kind: 'REFUND', amount: -75 })])).toContain('"-75"')
  })
})

describe('7 · allowance coverage is never a transaction row', () => {
  it('the API never lists it, so it cannot reach the file', () => {
    expect(API).toContain('isMoneyTransaction')
    // And were one ever passed, it would still be labelled, never silently
    // relabelled as a payment.
    expect(TXN_LABEL.SUBSCRIPTION_COVERED).toBe('Subscription Covered')
  })

  it('it appears only in the summary block, as covered orders', () => {
    const aoa = toWorkbookAoa([], summariseToday([
      txn({ id: 'c', kind: 'SUBSCRIPTION_COVERED', method: 'SUBSCRIPTION', amount: 70 }),
    ]), '2026-09-04')
    expect(aoa.some((r) => r[0] === 'Subscription Covered' && r[1] === 70)).toBe(true)
    expect(aoa.some((r) => r[0] === 'Subscription Covered Orders' && r[1] === 1)).toBe(true)
    // …and contributes no transaction row and no transaction count.
    expect(aoa.some((r) => r[0] === 'Transactions' && r[1] === 0)).toBe(true)
    expect(aoa).toHaveLength(10)
  })
})

describe('8 · summary values are the API’s, not recomputed', () => {
  it('the workbook prints whatever summary it is given', () => {
    const s: TodaySummary = { transactions: 9, collected: 1234.5, refunds: 34.5, net: 1200, subscriptionCovered: 12, subscriptionCoveredOrders: 3, byMethod: {} }
    const aoa = toWorkbookAoa([], s, '2026-09-04')
    expect(aoa.slice(2, 8).map((r) => r[1])).toEqual([9, 1234.5, 34.5, 1200, 12, 3])
  })

  it('the component passes the API summary straight through', () => {
    expect(UI).toContain('setTodaySummary(j.summary ?? null)')
  })
})

describe('9 · the filename carries the business day', () => {
  it('not the browser’s date', () => {
    expect(exportFilename('2026-09-04', 'csv')).toBe('payments-today-2026-09-04.csv')
    expect(exportFilename('2026-09-04', 'xlsx')).toBe('payments-today-2026-09-04.xlsx')
    expect(UI).toContain('setTodayKey(j.dayKey || "")')
    expect(UI).toContain('exportFilename(todayKey, "csv")')
    expect(UI).toContain('exportFilename(todayKey, "xlsx")')
  })

  it('times print on the business clock', () => {
    // 06:30Z is 12:00 IST.
    expect(exportTime('2026-09-04T06:30:00.000Z')).toMatch(/12:00/)
  })
})

describe('10 · nothing else about the ledger moved', () => {
  it('the six original filters are intact', () => {
    expect(ADJ).toContain('export type LedgerFilter = "ALL" | "PENDING" | "PARTIAL" | "PAID" | "DISCOUNTED" | "REFUNDED"')
    for (const f of ['"ALL", label: "All"', '"PENDING", label: "Pending"', '"PAID", label: "Paid"',
                     '"PARTIAL", label: "Partial"', '"DISCOUNTED", label: "Discounted"', '"REFUNDED", label: "Refunded"']) {
      expect(UI, f).toContain(f)
    }
  })

  it('the buttons belong to the Today view only', () => {
    const today = UI.indexOf('{filter === "TODAY" && (')
    expect(UI.indexOf('Download CSV')).toBeGreaterThan(today)
    expect(UI.indexOf('Download Excel')).toBeGreaterThan(today)
    expect(UI).toContain('disabled={today.length === 0}')
  })

  it('no payment, subscription or ledger calculation was touched', () => {
    for (const w of ['laundryPayment.create', 'laundryPayment.update', 'subscriptionPurchase.update', 'applyPaymentToPurchase']) {
      expect(API, w).not.toContain(w)
    }
    expect((API.match(/matchesLedgerFilter\(filter, r\)/g) || []).length).toBe(2)
  })
})
