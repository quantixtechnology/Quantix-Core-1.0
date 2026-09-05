import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { summarise, financialSummary, isVoided, type AdjustmentRow } from '@/lib/laundry-adjustment'
import { canCorrectDealValue } from '@/lib/laundry-dv-correction'

// ============================================================================
// A DISCOUNT GIVEN IN ERROR IS VOIDED, NOT DELETED AND NOT OFFSET.
//
// An order was corrected with DV Correction — ₹900 down to ₹441 — but the ₹459
// manual discount applied earlier by mistake was still attached, so the panel
// showed a ₹441 invoice with ₹0 payable: the old discount was cancelling out
// the corrected value.
//
// The adjustment model has no reversal of its own. Its documented rule is that
// an adjustment never edits the invoice, and by extension the row itself is a
// record of what a person did — so it is not edited and not deleted here
// either. Four nullable columns say it was voided, and summarise(), the one
// place adjustment money is added up, stops counting it. Nothing is offset: no
// second adjustment is created, which would have been a second discount.
//
// AdjustmentRow.voidedAt is REQUIRED rather than optional so that any query
// which forgets to select it fails to compile instead of silently counting a
// voided row. That is what caught all four call sites when this was written.
//
// Verified in the real browser on ORD-VOID-001 (DV already ₹441, ₹459 manual
// discount attached):
//   before  Invoice ₹441 · Amount Payable ₹0.00   <- the bug
//   void    200, reason recorded
//   after   Invoice ₹441 · Amount Payable ₹441.00 · Paid ₹0 · Balance ₹441
//           Discount row absent (₹0) · Refund Due ₹0
//   row     "- ₹459.00 · Manual Discount | Voided | … | Voided by Local Owner ·
//            05 Sept 2026, 12:41 pm · Removed previous manual discount; DV
//            corrected to ₹441." — kept, struck through, still auditable
//   DB      1 adjustment row (original, untouched amount/reason/author), no
//           offsetting row; order 441/0/441
//   empty reason -> 400 · voiding twice -> 409 alreadyVoided
// ============================================================================

const UNPAID = { grandTotal: 441, amountPaid: 0, balanceDue: 441 }
const row = (o: Partial<AdjustmentRow>): AdjustmentRow =>
  ({ amount: 459, appliedToDue: 459, refundable: 0, refundStatus: 'NOT_REQUIRED', voidedAt: null, ...o })

describe('1 · a voided adjustment stops counting', () => {
  it('the live discount suppresses what is payable', () => {
    const f = financialSummary({ ...UNPAID }, [row({})])
    expect(f.discount).toBe(459)
    expect(f.netPayable).toBe(0)          // 441 − 459, floored — the reported bug
  })

  it('once voided, the order is priced on its Deal Value alone', () => {
    const f = financialSummary({ ...UNPAID }, [row({ voidedAt: new Date() })])
    expect(f.invoiceTotal).toBe(441)
    expect(f.discount).toBe(0)
    expect(f.netPayable).toBe(441)
  })

  it('a void neither owes a refund nor claims one was paid', () => {
    const s = summarise({ grandTotal: 441, amountPaid: 441, balanceDue: 0 },
      [row({ refundable: 459, appliedToDue: 0, refundStatus: 'PENDING', voidedAt: new Date() })])
    expect(s.refundDue).toBe(0)
    expect(s.refunded).toBe(0)
    expect(s.compensation).toBe(0)
  })

  it('and it does not disturb the other adjustments on the order', () => {
    const f = financialSummary({ grandTotal: 1000, amountPaid: 0, balanceDue: 1000 }, [
      row({ amount: 459, voidedAt: new Date() }),
      row({ amount: 100, appliedToDue: 100 }),
    ])
    expect(f.discount).toBe(100)
    expect(f.netPayable).toBe(900)
  })

  it('a string timestamp counts as voided too — the API returns JSON', () => {
    expect(isVoided({ voidedAt: '2026-09-05T12:41:00.000Z' })).toBe(true)
    expect(isVoided({ voidedAt: null })).toBe(false)
    expect(isVoided({})).toBe(false)
  })
})

describe('2 · the record survives the void', () => {
  const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/adjustments/[adjustmentId]/void/route.ts'), 'utf8')

  it('the row is updated with void metadata, never deleted', () => {
    expect(API).toContain('laundryOrderAdjustment.update')
    expect(API).not.toMatch(/laundryOrderAdjustment\.(delete|deleteMany)/)
  })

  it('and its original figures are never rewritten', () => {
    const data = API.slice(API.indexOf('data: {'), API.indexOf('})', API.indexOf('data: {')))
    for (const field of ['amount', 'reason:', 'note', 'appliedToDue', 'refundable', 'kind', 'createdBy']) {
      expect(data).not.toContain(field)
    }
    for (const field of ['voidedAt', 'voidedBy', 'voidedByName', 'voidReason']) expect(data).toContain(field)
  })

  it('who, when and why are all recorded', () => {
    expect(API).toContain('voidedAt: new Date()')
    expect(API).toContain('voidedBy: guard.ctx.userId')
    expect(API).toContain('voidedByName: guard.ctx.userName')
    expect(API).toContain('voidReason: reason')
  })

  it('a reason is required', () => {
    expect(API).toContain('A reason is required to void an adjustment.')
    expect(API).toContain('{ status: 400 }')
  })

  it('and no second discount is invented to offset the first', () => {
    expect(API).not.toContain('laundryOrderAdjustment.create')
    expect(LIB).not.toMatch(/offset|reversal amount|negative adjustment/i)
  })
})

describe('3 · it refuses what it should refuse', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/adjustments/[adjustmentId]/void/route.ts'), 'utf8')

  it('voiding twice is a no-op, not a second void', () => {
    expect(API).toContain('if (adj.voidedAt)')
    expect(API).toContain('alreadyVoided: true')
    expect(API).toContain('{ status: 409 }')
  })

  it('money already refunded cannot be voided away', () => {
    expect(API).toContain('adj.refundStatus === "REFUNDED" || adj.refundStatus === "PROCESSING"')
  })

  it('the adjustment must belong to the order in the URL', () => {
    expect(API).toContain('where: { id: adjustmentId, orderId: id }')
  })

  it('and it needs edit rights on the Payments screen', () => {
    expect(API).toContain('requireLaundryLevel(request, order.businessId, "store_ops.payment_collection", Level.EDIT)')
  })

  it('held to the same three roles as a Deal Value correction', () => {
    // Voiding a discount changes what the customer owes as directly as
    // correcting the DV does, so it reuses that predicate rather than
    // restating the rule — the two cannot drift apart.
    expect(API).toContain('canCorrectDealValue({ platformRole: guard.ctx.role, isOwner: !!guard.resolved.isOwner, roleCode: guard.resolved.roleCode })')
    expect(API).toContain('import { canCorrectDealValue } from "@/lib/laundry-dv-correction"')
    expect(API).toContain('Only the Quantix Super Admin, the Owner or an Accountant can void a discount.')
    expect(API).toContain('{ status: 403 }')
  })

  it('scoping runs before the role gate, so another tenant learns nothing', () => {
    expect(API.indexOf('requireLaundryLevel')).toBeLessThan(API.indexOf('canCorrectDealValue({'))
  })

  it('screen rights alone are not enough', () => {
    // The roles that can take payment on this screen but must not void:
    for (const code of ['STORE_MANAGER', 'STORE_SUPERVISOR', 'COUNTER_EXECUTIVE', 'PROCESSING_MANAGER', 'VIEWER']) {
      expect(canCorrectDealValue({ platformRole: null, isOwner: false, roleCode: code })).toBe(false)
    }
    expect(canCorrectDealValue({ platformRole: 'QUANTIX_SUPER_ADMIN', isOwner: false, roleCode: 'VIEWER' })).toBe(true)
    expect(canCorrectDealValue({ platformRole: null, isOwner: true, roleCode: 'BUSINESS_OWNER' })).toBe(true)
    expect(canCorrectDealValue({ platformRole: null, isOwner: false, roleCode: 'ACCOUNTANT' })).toBe(true)
  })
})

describe('4 · every reader of the money honours the void', () => {
  it('voidedAt is required, so a query that omits it cannot compile', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
    const iface = LIB.slice(LIB.indexOf('export interface AdjustmentRow'), LIB.indexOf('export const isVoided'))
    expect(iface).toContain('voidedAt: Date | string | null')
    expect(iface).not.toContain('voidedAt?')
  })

  it('and the server queries that feed it select the column', () => {
    for (const p of ['src/app/api/laundry/orders/[id]/adjustments/route.ts',
                     'src/app/api/laundry/payments-ledger/route.ts']) {
      expect(readFileSync(join(process.cwd(), p), 'utf8')).toContain('voidedAt: true')
    }
  })

  it('the filter lives once, in summarise', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
    // maxCompensation is declared BEFORE summarise, so slice to the next
    // declaration that actually follows it.
    const from = LIB.indexOf('export function summarise(')
    const fn = LIB.slice(from, LIB.indexOf('export function', from + 10))
    expect(fn).toContain('const live = adjustments.filter((a) => !isVoided(a))')
    expect(fn).not.toMatch(/adjustments\.(reduce|filter)\(\(a\) => isSettled/)
  })
})

describe('5 · nothing else was touched', () => {
  it('the DV Correction feature is unchanged', () => {
    // Comments are prose — the DV module's own note explains that it writes no
    // adjustment, which is not a use of one. Compare code.
    const DV = readFileSync(join(process.cwd(), 'src/lib/laundry-dv-correction.ts'), 'utf8')
      .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(DV).not.toMatch(/void|adjustment/i)
  })

  it('TODAY does not know or care about voids', () => {
    const TODAY = readFileSync(join(process.cwd(), 'src/lib/laundry-today-transactions.ts'), 'utf8')
    expect(TODAY).not.toMatch(/voidedAt|isVoided/)
  })

  it('and no subscription or processing logic is involved', () => {
    const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/adjustments/[adjustmentId]/void/route.ts'), 'utf8')
      .replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(API).not.toMatch(/subscription|processingStatus|laundryOrderItem|grandTotal/i)
  })
})
