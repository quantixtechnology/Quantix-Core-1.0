import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const SCHEMA = read('prisma/schema.prisma')
const ADJ_API = read('src/app/api/laundry/orders/[id]/adjustments/route.ts')
const REFUND = read('src/app/api/laundry/orders/[id]/adjustments/[adjustmentId]/refund/route.ts')
const LEDGER = read('src/components/laundry/views/laundry-payments-ledger.tsx')
const NAV = read('src/lib/laundry-nav-config.ts')

const model = (name: string) => {
  const i = SCHEMA.indexOf(`model ${name} {`)
  return SCHEMA.slice(i, SCHEMA.indexOf('\n}', i))
}

describe('Razorpay readiness — identifiers exist, none are invented', () => {
  it('a payment can carry its gateway ids', () => {
    const m = model('LaundryPayment')
    for (const f of ['gateway', 'gatewayOrderId', 'gatewayPaymentId', 'status']) expect(m).toContain(f)
  })

  it('they are optional, so nothing is fabricated before Razorpay is configured', () => {
    const m = model('LaundryPayment')
    expect(m).toMatch(/gatewayPaymentId\s+String\?/)
    expect(m).toMatch(/gatewayOrderId\s+String\?/)
  })

  it('a refund can reference the payment it reverses and the gateway refund', () => {
    const m = model('LaundryOrderAdjustment')
    for (const f of ['refundPaymentId', 'gatewayRefundId', 'refundError']) expect(m).toContain(f)
  })

  it('no placeholder gateway id is written anywhere', () => {
    for (const src of [ADJ_API, REFUND]) {
      expect(src).not.toMatch(/rzp_|pay_test|order_test/)
    }
  })

  it('REFUNDED is still only written on an explicit confirmation', () => {
    expect(REFUND).toContain('refundedAt: status === "REFUNDED" ? new Date() : null')
    expect(ADJ_API).not.toContain('"REFUNDED"')
  })
})

describe('discounts are computed server-side', () => {
  it('a scheme is resolved from the existing Promotion table', () => {
    expect(ADJ_API).toContain('prisma.promotion.findFirst')
    expect(ADJ_API).toContain('schemeRefusal(promo, order.grandTotal)')
    expect(ADJ_API).toContain('discountAmount(promo.discountType, promo.discountValue, order.grandTotal, promo.maxDiscount)')
  })

  it('a percentage is recomputed, never trusted from the client', () => {
    expect(ADJ_API).toContain('discountAmount("PERCENT", Number(b.discountValue) || 0, order.grandTotal, null)')
  })

  it('the derivation is recorded on the row', () => {
    expect(ADJ_API).toContain('kind, promotionId, promotionCode')
  })

  it('no second coupon model was created', () => {
    expect(SCHEMA).not.toContain('model LaundryCoupon')
    expect(SCHEMA).not.toContain('model LaundryScheme')
  })
})

describe('the ledger is permanent and read-only', () => {
  it('the nav item now lands on the ledger, under the SAME permission', () => {
    expect(NAV).toContain('"store_ops.payment_collection": "payments-ledger"')
  })

  it('the operational queue still exists and is reachable', () => {
    expect(read('src/components/laundry/laundry-page-router.tsx')).toContain('case "payment-queue": return <LaundryPaymentCollection />')
    expect(LEDGER).toContain('setLaundryPage("payment-queue")')
  })

  it('it filters by money, never by workflow status', () => {
    expect(LEDGER).not.toMatch(/status:\s*"PAYMENT_PENDING"/)
    // The comment names the queue it replaces; what matters is that the QUERY
    // never constrains status.
    const api = read('src/app/api/laundry/payments-ledger/route.ts')
    const where = api.slice(api.indexOf('const where:'), api.indexOf('const orders'))
    expect(where).not.toContain('status')
  })

  it('it writes nothing', () => {
    const api = read('src/app/api/laundry/payments-ledger/route.ts')
    for (const w of ['.update(', '.create(', '.delete(']) expect(api).not.toContain(w)
  })

  // Superseded: money actions moved INTO the ledger, so a row now opens the
  // Payment Details panel. Order Details stays the operational screen.
  it('opening a row opens Payment Details, not the order page', () => {
    expect(LEDGER).toContain('setOpenOrder(r)')
    expect(LEDGER).not.toContain('setLaundryPage("order-detail")')
  })

  it('search covers order, invoice, customer and mobile', () => {
    const api = read('src/app/api/laundry/payments-ledger/route.ts')
    expect(api).toContain('orderNumber: { contains: q }')
    expect(api).toContain('invoiceNumber: { contains: q }')
    expect(api).toContain('phone: { contains: q }')
    expect(api).toContain('name: { contains: q }')
  })
})

// ── The UI the previous pass left unfinished ────────────────────────────────
describe('Payment Details panel exposes the money actions', () => {
  const PANEL = read('src/components/laundry/views/laundry-payment-details-panel.tsx')
  const LEDGER2 = read('src/components/laundry/views/laundry-payments-ledger.tsx')

  it('a ledger row opens the panel, not the Order Details page', () => {
    // The ledger now also lists standalone subscription sales, which have no
    // order to open — so the same handler is guarded by row kind rather than
    // removed. An ORDER row still opens the panel and nothing else.
    expect(LEDGER2).toContain('onClick={() => { if (r.kind !== "SUBSCRIPTION") setOpenOrder(r) }}')
    expect(LEDGER2).toContain('<LaundryPaymentDetailsPanel')
    expect(LEDGER2).not.toContain('setLaundryPage("order-detail")')
  })

  it('shows both actions', () => {
    expect(PANEL).toContain('Add Discount')
    // Renamed to "Collect Payment", now sitting beside "Pay Later".
    expect(PANEL).toContain('Collect Payment')
    expect(PANEL).toContain('Pay Later')
  })

  it('offers Manual and Scheme, with fixed and percentage', () => {
    expect(PANEL).toContain('"MANUAL_DISCOUNT", "SCHEME_DISCOUNT"')
    expect(PANEL).toContain('"FIXED", "PERCENT"')
  })

  it('previews the effect before saving', () => {
    expect(PANEL).toContain('Current Payable')
    expect(PANEL).toContain('New Payable')
    // And the refund consequence when the order is already paid.
    expect(PANEL).toContain('Refund Due')
  })

  it('keeps subscription and discount on separate lines', () => {
    expect(PANEL).toContain('k="Subscription"')
    expect(PANEL).toContain('k="Discount"')
    expect(PANEL).toContain('financialSummary(money, adjustments)')
  })

  it('shows payment history with the gateway payment id when present', () => {
    expect(PANEL).toContain('Payment History')
    expect(PANEL).toContain('Payment ID: ${p.gatewayPaymentId}')
  })

  it('shows discounts and refunds as their own history', () => {
    expect(PANEL).toContain('Discounts & Refunds')
    expect(PANEL).toContain('Refund ID: ${a.gatewayRefundId}')
  })

  // Refusing is the honest behaviour until the gateway exists.
  it('refuses to record a Razorpay payment while it is unconfigured', () => {
    expect(PANEL).toContain('Razorpay is not configured yet')
    expect(PANEL).toMatch(/payMethod === "RAZORPAY"[\s\S]{0,400}return/)
  })

  it('collects through the EXISTING payment endpoint', () => {
    expect(PANEL).toContain('/payment?businessId=')
  })

  it('an unusable scheme stays visible but disabled, with its reason', () => {
    expect(PANEL).toContain('disabled={!!s.refusal}')
    expect(PANEL).toContain('s.refusal ? ` — ${s.refusal}`')
  })
})
