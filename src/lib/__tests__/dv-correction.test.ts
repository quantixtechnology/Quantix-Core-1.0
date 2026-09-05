import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { canCorrectDealValue, roleLabelFor, validateDvCorrection, DV_CORRECTION_ACTION } from '@/lib/laundry-dv-correction'

// ============================================================================
// CORRECTING A DEAL VALUE IS NOT DISCOUNTING ONE.
//
// A discount says the price was ₹900 and ₹459 of it is being given back, and it
// leaves both numbers on the invoice. A correction says the price was never
// ₹900 — it is ₹441, and that is the only figure there is. So this writes no
// LaundryOrderAdjustment, no payment and no refund, consumes no subscription
// allowance and moves no garment: it sets LaundryOrder.grandTotal, the Deal
// Value the whole financial stack already reads, and re-derives balanceDue with
// the arithmetic every payment path already uses.
//
// Three roles may do it — Quantix Super Admin, Owner, Accountant — and that is
// enforced in the endpoint, not by hiding the button.
//
// Audit is LaundryOrderEvent, the order's existing append-only log, so a second
// correction adds a row and never touches the first. No schema change.
//
// Verified against the running app, signed in as the Owner, on ORD-DV-001:
//   comment ""/"   "/absent -> 400 "A comment is required…"
//   newDv -5 -> 400 negative · newDv "abc" -> 400 invalid
//   ₹900 → ₹441  balance 441  · then ₹441 → ₹450  balance 450
//   order row: total 450, paid 0, discount 0, adjustments 0, payments 0
//   audit: 2 DV_CORRECTION events, both retained, newest first
// ============================================================================

const SUPER = { platformRole: 'QUANTIX_SUPER_ADMIN', isOwner: false, roleCode: 'VIEWER' }
const OWNER = { platformRole: null, isOwner: true, roleCode: 'BUSINESS_OWNER' }
const ACCOUNTANT = { platformRole: null, isOwner: false, roleCode: 'ACCOUNTANT' }

describe('1 · only three roles may correct a Deal Value', () => {
  it('Quantix Super Admin may', () => expect(canCorrectDealValue(SUPER)).toBe(true))
  it('the Owner may', () => expect(canCorrectDealValue(OWNER)).toBe(true))
  it('an Accountant may', () => expect(canCorrectDealValue(ACCOUNTANT)).toBe(true))

  it('nobody else may — including roles that can take money on the same screen', () => {
    for (const code of ['COUNTER_EXECUTIVE', 'STORE_MANAGER', 'STORE_SUPERVISOR', 'PROCESSING_MANAGER', 'DELIVERY_EXECUTIVE', 'CRM_MANAGER', 'VIEWER', '', null]) {
      expect(canCorrectDealValue({ platformRole: null, isOwner: false, roleCode: code })).toBe(false)
    }
  })

  it('the accountant check is exact, not a prefix or a guess', () => {
    expect(canCorrectDealValue({ isOwner: false, roleCode: ' accountant ' })).toBe(true)   // trimmed + cased
    expect(canCorrectDealValue({ isOwner: false, roleCode: 'ACCOUNTANT_ASSISTANT' })).toBe(false)
    expect(canCorrectDealValue({ isOwner: false, roleCode: 'JUNIOR_ACCOUNTANT' })).toBe(false)
  })

  it('and the role recorded against the correction names which of the three acted', () => {
    expect(roleLabelFor(SUPER)).toBe('Quantix Super Admin')
    expect(roleLabelFor(OWNER)).toBe('Owner')
    expect(roleLabelFor(ACCOUNTANT)).toBe('Accountant')
  })
})

describe('2 · a comment is mandatory', () => {
  it('empty, whitespace, absent and non-string are all refused', () => {
    for (const c of ['', '   ', '\n\t', undefined, null, 42]) {
      const v = validateDvCorrection(441, c)
      expect(v.ok).toBe(false)
      expect(v.error).toContain('comment is required')
    }
  })

  it('a real comment passes, trimmed', () => {
    const v = validateDvCorrection(441, '  Super Saver pricing correction  ')
    expect(v.ok).toBe(true)
    expect(v.comment).toBe('Super Saver pricing correction')
  })
})

describe('3 · the new value has to be a value', () => {
  it('₹900 → ₹441 is accepted', () => {
    const v = validateDvCorrection(441, 'ok')
    expect(v.ok).toBe(true); expect(v.value).toBe(441)
  })

  it('zero is allowed, negative is not', () => {
    expect(validateDvCorrection(0, 'ok').ok).toBe(true)
    expect(validateDvCorrection(-1, 'ok').error).toContain('negative')
  })

  it('nonsense is refused', () => {
    for (const n of ['abc', undefined, null, NaN, Infinity]) expect(validateDvCorrection(n, 'ok').ok).toBe(false)
  })

  it('and it is rounded to paise, like every other money value', () => {
    expect(validateDvCorrection(441.005, 'ok').value).toBe(441.01)
  })
})

describe('4 · what it writes, and what it refuses to write', () => {
  const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-dv-correction.ts'), 'utf8')
  const fn = LIB.slice(LIB.indexOf('export async function correctDealValue('))

  it('it sets the Deal Value and re-derives the balance the usual way', () => {
    expect(fn).toContain('data: { grandTotal: newDv, balanceDue, paymentStatus }')
    expect(fn).toContain('const balanceDue = r2(Math.max(0, newDv - order.amountPaid))')
  })

  it('it never touches what the customer has paid', () => {
    // It READS amountPaid to derive the balance (`amountPaid: true` in the
    // select); what it must never do is assign one, so the check is on the
    // update payload rather than on the identifier appearing at all.
    const update = fn.slice(fn.indexOf('data: { grandTotal'), fn.indexOf('laundryOrderEvent.create'))
    expect(update).not.toContain('amountPaid')
    expect(fn).toContain('amountPaid: true')   // read, for the balance
  })

  it('no discount, no payment, no refund, no allowance', () => {
    expect(fn).not.toMatch(/laundryOrderAdjustment|laundryPayment|refund/i)
    expect(fn).not.toMatch(/customerSubscription|subscriptionLedgerEntry|remainingPieces|applySubscription/i)
  })

  it('and no processing state moves — the order stays where it is', () => {
    expect(fn).toContain('fromStatus: order.status, toStatus: order.status')
    expect(fn).not.toMatch(/laundryOrderItem|processingStatus/)
  })

  it('the value change and its audit row are written together', () => {
    expect(fn).toContain('prisma.$transaction')
    expect(fn.indexOf('prisma.$transaction')).toBeLessThan(fn.indexOf('laundryOrder.update'))
    expect(fn.indexOf('laundryOrder.update')).toBeLessThan(fn.indexOf('laundryOrderEvent.create'))
  })
})

describe('5 · the audit is append-only and complete', () => {
  const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-dv-correction.ts'), 'utf8')

  it('every field the history table needs is recorded', () => {
    const note = LIB.slice(LIB.indexOf('note: JSON.stringify({'), LIB.indexOf('note: JSON.stringify({') + 260)
    for (const field of ['orderNumber', 'previousDv', 'newDv', 'comment', 'user', 'role']) expect(note).toContain(field)
    // actorId/actorName and createdAt come from the event row itself.
    expect(LIB).toContain('actorId: input.actorId ?? null')
    expect(LIB).toContain('actorName: input.actorName ?? null')
  })

  it('history is only ever created — never updated or deleted', () => {
    expect(LIB).toContain('laundryOrderEvent.create')
    expect(LIB).not.toMatch(/laundryOrderEvent\.(update|delete|deleteMany|upsert)/)
  })

  it('and it reads back newest first, under its own action', () => {
    expect(LIB).toContain(`export const DV_CORRECTION_ACTION = "DV_CORRECTION"`)
    expect(DV_CORRECTION_ACTION).toBe('DV_CORRECTION')
    expect(LIB).toContain('orderBy: { createdAt: "desc" }')
  })

  it('a malformed row never breaks the history', () => {
    expect(LIB).toContain('catch { return null }')
  })
})

describe('6 · the permission is enforced on the server', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/dv-correction/route.ts'), 'utf8')

  it('POST refuses anyone outside the three roles with a 403', () => {
    expect(API).toContain('if (!a.allowed)')
    expect(API).toContain('{ status: 403 }')
    expect(API).toContain('Only the Quantix Super Admin, the Owner or an Accountant can correct a Deal Value.')
  })

  it('the gate is the shared predicate, not a second rule written here', () => {
    expect(API).toContain('canCorrectDealValue(who)')
    expect(API).toContain('import { canCorrectDealValue, roleLabelFor, correctDealValue, dvCorrectionHistory }')
  })

  it('business scoping still runs first, so another tenant learns nothing', () => {
    expect(API).toContain('requireLaundryPermission(request, ord.businessId, "store_ops.payment_collection.view")')
    expect(API.indexOf('requireLaundryPermission')).toBeLessThan(API.indexOf('canCorrectDealValue'))
  })

  it('and the role comes from the guard, never from the request body', () => {
    const auth = API.slice(API.indexOf('async function authorise('), API.indexOf('export async function GET'))
    expect(auth).toContain('platformRole: guard.ctx.role')
    expect(auth).toContain('isOwner: !!guard.resolved.isOwner')
    expect(auth).toContain('roleCode: guard.resolved.roleCode')
    expect(auth).not.toMatch(/b\.role|body\.role/)
  })
})

describe('7 · the normal engines are not involved', () => {
  const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-dv-correction.ts'), 'utf8')
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/dv-correction/route.ts'), 'utf8')

  it('neither file imports the pricing or subscription engines', () => {
    for (const src of [LIB, API]) {
      expect(src).not.toMatch(/laundry-billing|resolveOrderBilling|computeQuote|laundry-subscription/)
    }
  })

  it('and TODAY / the ledger classifier are untouched by this feature', () => {
    const ADJ = readFileSync(join(process.cwd(), 'src/lib/laundry-adjustment.ts'), 'utf8')
    expect(ADJ).not.toContain('DV_CORRECTION')
    const TODAY = readFileSync(join(process.cwd(), 'src/lib/laundry-today-transactions.ts'), 'utf8')
    expect(TODAY).not.toContain('DV_CORRECTION')
  })
})
