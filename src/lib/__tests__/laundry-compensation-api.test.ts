import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const POST_ADJ = read('src/app/api/laundry/orders/[id]/adjustments/route.ts')
const REFUND = read('src/app/api/laundry/orders/[id]/adjustments/[adjustmentId]/refund/route.ts')
const PANEL = read('src/components/laundry/invoice/laundry-compensation-panel.tsx')
const INVOICE_PANEL = read('src/components/laundry/invoice/laundry-invoice-panel.tsx')

describe('the original invoice and payments are never rewritten', () => {
  it('the adjustment endpoint never writes grandTotal or amountPaid', () => {
    // Reading them is required (the split depends on them); WRITING them is the
    // thing that would rewrite history, so assert on the data: blocks only.
    const writes = (POST_ADJ.match(/data:\s*\{[\s\S]*?\n\s*\}/g) || []).join("\n")
    expect(writes).not.toContain("grandTotal")
    expect(writes).not.toContain("amountPaid")
    expect(writes).toContain("balanceDue")
  })

  it('it touches balanceDue and nothing else on the order', () => {
    const updates = POST_ADJ.match(/laundryOrder\.update\(\{[\s\S]*?\}\)/g) || []
    expect(updates).toHaveLength(1)
    expect(updates[0]).toContain('balanceDue')
  })

  it('it never edits an existing payment row', () => {
    expect(POST_ADJ).not.toContain('laundryPayment.update')
    expect(REFUND).not.toContain('laundryPayment.update')
  })

  it('a refund is added as its own ledger row, negative', () => {
    expect(REFUND).toContain('laundryPayment.create')
    expect(REFUND).toContain('amount: -adj.refundable')
    expect(REFUND).toContain('method: "REFUND"')
  })
})

describe('money is only called refunded once it is', () => {
  it('a new adjustment on paid money starts PENDING, never REFUNDED', () => {
    expect(POST_ADJ).toContain('refundStatus: refundable > 0 ? "PENDING" : "NOT_REQUIRED"')
    expect(POST_ADJ).not.toContain('"REFUNDED"')
  })

  it('refundedAt is stamped only on the completing transition', () => {
    expect(REFUND).toContain('refundedAt: status === "REFUNDED" ? new Date() : null')
  })

  it('a completed refund cannot be repeated', () => {
    expect(REFUND).toContain('already been completed')
    expect(REFUND).toContain('canRefund(adj.refundStatus)')
  })

  it('the ledger row is written only when the money actually moved', () => {
    expect(REFUND).toMatch(/if \(status === "REFUNDED"\) \{[\s\S]*?laundryPayment\.create/)
  })
})

describe('permissions reuse the existing financial screen', () => {
  // Corrected: the screen key is store_ops.payment_collection. These endpoints
  // named "laundry.payment_collection", which is not a registered screen, so
  // the guard could never be satisfied and every role but the owner was denied
  // Payments & Ledger and compensation.
  it('creating compensation needs EDIT on payment_collection', () => {
    expect(POST_ADJ).toContain('"store_ops.payment_collection", Level.EDIT')
    expect(REFUND).toContain('"store_ops.payment_collection", Level.EDIT')
  })

  it('viewing needs only VIEW', () => {
    expect(POST_ADJ).toContain('"store_ops.payment_collection", Level.VIEW')
  })

  it('the screen key is one the registry actually defines', async () => {
    const { isValidScreenKey } = await import('@/lib/laundry-rbac-registry')
    expect(isValidScreenKey('store_ops.payment_collection')).toBe(true)
    expect(isValidScreenKey('laundry.payment_collection')).toBe(false)
  })

  it('no new permission key or role was invented', () => {
    for (const src of [POST_ADJ, REFUND]) {
      expect(src).not.toMatch(/laundry\.(compensation|refund|adjustment)/)
    }
  })

  it('the panel hides itself for a user without the permission', () => {
    expect(PANEL).toContain('if (r.status === 403 || r.status === 401) { setAllowed(false); return null }')
    expect(PANEL).toContain('if (!allowed) return null')
  })
})

describe('over-compensation is refused server-side', () => {
  it('validation re-runs against current rows inside the write transaction', () => {
    expect(POST_ADJ).toContain('prisma.$transaction')
    expect(POST_ADJ).toMatch(/tx\.laundryOrderAdjustment\.findMany[\s\S]*?validateCompensation/)
  })

  it('the client is not trusted for the split', () => {
    expect(POST_ADJ).toContain('splitAdjustment(order, existing, amount)')
  })
})

describe('placement', () => {
  it('lives on Order Details, beside Payment History', () => {
    expect(INVOICE_PANEL).toContain('<LaundryCompensationPanel')
  })

  // Reachable after payment, processing and delivery are all done.
  it('is not gated on order status', () => {
    expect(POST_ADJ).not.toMatch(/status:\s*"(DELIVERED|PAYMENT_PENDING)"/)
    expect(INVOICE_PANEL).not.toMatch(/status === "DELIVERED" && <LaundryCompensationPanel/)
  })
})
