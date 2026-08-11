import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const API = read('src/app/api/laundry/orders/[id]/payment/route.ts')
const PANEL = read('src/components/laundry/views/laundry-payment-details-panel.tsx')
const LEDGER = read('src/app/api/laundry/payments-ledger/route.ts')

describe('Pay Later posts no money and advances the order', () => {
  it('creates no payment row', () => {
    const branch = API.slice(API.indexOf('if (body.action === "PAY_LATER")'), API.indexOf('payLater: true } })'))
    expect(branch).not.toContain('laundryPayment.create')
  })

  it('advances PAYMENT_PENDING → READY_FOR_PROCESSING', () => {
    expect(API).toContain('data: { status: "READY_FOR_PROCESSING" }')
    expect(API).toContain('advanceAfterPayment(orderPL.id, bizPL.id, "PAY_LATER"')
  })

  it('records an auditable event with the actor', () => {
    expect(API).toContain('action, actorName: actor || null')
    expect(API).toContain('fromStatus: "PAYMENT_PENDING", toStatus: "READY_FOR_PROCESSING"')
  })

  it('leaves the balance outstanding in the note', () => {
    expect(API).toContain('Balance ₹${orderPL.balanceDue.toFixed(2)} to collect at delivery')
  })

  // The workspace policy still governs the decision.
  it('refuses when the workspace requires advance payment', () => {
    expect(API).toContain('requires advance payment — pay-later is not allowed')
  })

  it('only applies while the order is awaiting payment', () => {
    expect(API).toContain('if (orderPL.status !== "PAYMENT_PENDING")')
  })
})

describe('collecting also advances the workflow', () => {
  it('a recorded payment moves the order on', () => {
    expect(API).toContain('advanceAfterPayment(d.order.id, biz.id, "COLLECT_PAYMENT"')
  })
})

describe('the panel offers both choices', () => {
  it('Collect Payment with Cash, UPI and Razorpay', () => {
    expect(PANEL).toContain('Collect Payment')
    expect(PANEL).toContain('const PAY_METHODS = ["CASH", "UPI", "RAZORPAY"] as const')
  })

  it('Pay Later, with the confirmation wording', () => {
    expect(PANEL).toContain('Pay Later')
    expect(PANEL).toContain('will remain outstanding. Allow this customer to pay later?')
    expect(PANEL).toContain('Confirm Pay Later')
  })

  it('calls the EXISTING payment endpoint, not a new one', () => {
    expect(PANEL).toContain('action: "PAY_LATER"')
    expect(PANEL).toMatch(/\/payment\?businessId=/)
  })

  it('both actions are hidden when nothing is owed', () => {
    expect(PANEL.match(/disabled=\{f\.balance <= 0\}/g)?.length).toBe(2)
  })

  // Razorpay is still refused rather than faked until it is configured.
  it('does not fabricate a Razorpay transaction', () => {
    expect(PANEL).toContain('Razorpay is not configured yet')
    expect(PANEL).not.toMatch(/rzp_|pay_test/)
  })
})

describe('the ledger keeps a pay-later order visible', () => {
  it('labels it from the event already written', () => {
    expect(LEDGER).toContain('action: "PAY_LATER"')
    expect(LEDGER).toContain('payLater.has(o.id) && f.balance > 0 ? "PAY LATER"')
  })

  it('reverts to the real status once collected', () => {
    expect(LEDGER).toContain('f.balance > 0 ? "PAY LATER" : o.paymentStatus')
  })

  // No new status column was introduced for this.
  it('adds no new status field', () => {
    expect(read('prisma/schema.prisma')).not.toContain('payLaterApproved')
  })
})
