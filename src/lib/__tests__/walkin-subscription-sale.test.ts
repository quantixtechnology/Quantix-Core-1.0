import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// SELLING A SUBSCRIPTION AT THE COUNTER, THROUGH THE PATHS THAT ALREADY EXIST.
//
// The storefront already raises a pending SubscriptionPurchase and the counter
// already collects against one — /api/laundry/subscriptions/collect has called
// applyPaymentToPurchase since it was written. The only thing missing for a
// walk-in was a way for staff to RAISE the purchase, so that is all the new
// endpoint does: it validates the tenant, then calls the same
// createSubscriptionPurchase() the storefront calls. Pricing, the
// already-subscribed refusal, partial settlement, activation, the allowance
// grant and the membership number are untouched and unduplicated.
//
// The money then has to be visible. LaundryPayment.orderId is a required
// String, so a subscription sold on its own cannot be written there, and
// inventing an order to carry it would be worse than the gap. Instead the
// ledger reads SubscriptionPurchase alongside the orders and marks each row
// with its kind. SubscriptionPurchase stays the source of truth and no
// LaundryPayment row is fabricated.
//
// Driven end to end against the running app: purchase 201 (₹2000 due) →
// ₹500 CASH leaves it PROCESSING at balance ₹1500 → ₹1500 UPI activates
// SUB-LND-202609-000001 → the ledger shows one SUBSCRIPTION row, orderNumber
// null, paid 2000, balance 0, beside 100 unchanged ORDER rows.
// ============================================================================

const PURCHASE_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/subscriptions/purchase/route.ts'), 'utf8')
const COLLECT_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/subscriptions/collect/route.ts'), 'utf8')
const LEDGER_API = readFileSync(join(process.cwd(), 'src/app/api/laundry/payments-ledger/route.ts'), 'utf8')
const LEDGER_UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-payments-ledger.tsx'), 'utf8')
const CUSTOMERS_UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-customers-view.tsx'), 'utf8')
const PURCHASE_LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription-purchase.ts'), 'utf8')
const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
const STOREFRONT = readFileSync(join(process.cwd(), 'src/app/api/core/storefront/laundry-subscription/purchase/route.ts'), 'utf8')

describe('1 · staff raise the SAME purchase the storefront raises', () => {
  it('the endpoint calls createSubscriptionPurchase and nothing else creates one', () => {
    expect(PURCHASE_API).toContain('import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"')
    expect(PURCHASE_API).toContain('await createSubscriptionPurchase({ businessId: platformId, customerId: customer.id, planId: plan.id })')
    // No second creation path: it never writes the row itself.
    expect(PURCHASE_API).not.toContain('subscriptionPurchase.create')
    expect(PURCHASE_API).not.toContain('customerSubscription.create')
  })

  it('customerId, businessId and planId are the tenant-checked ones, not the caller’s', () => {
    // Subscriptions are keyed on the platform business id.
    expect(PURCHASE_API).toContain('const platformId = biz.platformBusinessId')
    expect(PURCHASE_API).toContain('prisma.customer.findFirst({ where: { id: customerId, businessId: platformId }')
    expect(PURCHASE_API).toContain('where: { id: planId, businessId: platformId, serviceType: "LAUNDRY", isActive: true },')
  })

  it('price comes off the plan, never from the request body', () => {
    // The body carries only ids; amount is set by createSubscriptionPurchase.
    expect(PURCHASE_API).toContain('const { businessId, customerId, planId } =')
    expect(PURCHASE_API).not.toMatch(/body\.(amount|price)/)
    expect(PURCHASE_LIB).toContain('data: { businessId, customerId, planId, amount: plan.price,')
  })

  it('activation, allowance and membership stay in the shared library', () => {
    expect(PURCHASE_API).not.toContain('grantAllowance')
    expect(PURCHASE_API).not.toContain('generateMembershipNumber')
    expect(PURCHASE_LIB).toContain('await grantAllowance(tx,')
    expect(PURCHASE_LIB).toContain('const membershipId = await generateMembershipNumber()')
  })
})

describe('2 · collection is the endpoint that was already there', () => {
  it('it still applies through applyPaymentToPurchase', () => {
    expect(COLLECT_API).toContain('import { applyPaymentToPurchase } from "@/lib/laundry-subscription-purchase"')
    expect(COLLECT_API).toContain('const res = await applyPaymentToPurchase(purchaseId, pay)')
  })

  it('the existing methods are unchanged', () => {
    expect(COLLECT_API).toContain('const METHODS = ["CASH", "UPI", "CARD", "LINK", "BANK", "OTHER"]')
  })

  it('partial settlement still leaves it pending, full payment still activates', () => {
    expect(PURCHASE_LIB).toContain('const fullyPaid = newPaid >= purchase.amount - 0.001')
    expect(PURCHASE_LIB).toContain('data: { amountPaid: newPaid, paymentStatus: "PROCESSING" }')
    expect(PURCHASE_LIB).toContain('status: "ACTIVATED", paymentStatus: "COMPLETED"')
  })

  it('the staff UI collects through that endpoint, not a new one', () => {
    expect(CUSTOMERS_UI).toContain('fetch("/api/laundry/subscriptions/collect"')
    expect(CUSTOMERS_UI).toContain('fetch("/api/laundry/subscriptions/purchase"')
    expect(CUSTOMERS_UI).not.toContain('/api/laundry/subscriptions/activate')
  })
})

describe('3 · the ledger shows the money without inventing an order', () => {
  it('standalone purchases are read, and only standalone ones', () => {
    expect(LEDGER_API).toContain('prisma.subscriptionPurchase.findMany')
    // One bought with an order is settled through that order — counting it here
    // would double it.
    expect(LEDGER_API).toContain('laundryOrderId: null,')
    expect(LEDGER_API).toContain('status: { notIn: ["CANCELLED", "INITIATED"] },')
  })

  it('a subscription row carries no order number, and none is fabricated', () => {
    expect(LEDGER_API).toContain('orderNumber: null,')
    expect(LEDGER_API).toContain('kind: "SUBSCRIPTION" as const')
    expect(LEDGER_UI).toContain('kind?: "ORDER" | "SUBSCRIPTION"')
  })

  it('no LaundryPayment row is written to make it appear', () => {
    expect(LEDGER_API).not.toContain('laundryPayment.create')
    expect(PURCHASE_API).not.toContain('laundryPayment')
    expect(COLLECT_API).not.toContain('laundryPayment')
  })

  it('SubscriptionPurchase remains the source of truth — the ledger only reads', () => {
    expect(LEDGER_API).not.toMatch(/subscriptionPurchase\.(create|update|delete)/)
  })

  it('the financial fields an operator needs are all carried', () => {
    for (const f of ['planName:', 'customerName:', 'orderTotal:', 'paid,', 'balance,', 'paymentMethod:', 'paymentStatus:', 'reference:', 'paidAt:']) {
      expect(LEDGER_API, f).toContain(f)
    }
  })

  it('both kinds are filtered by the one existing filter function', () => {
    expect((LEDGER_API.match(/matchesLedgerFilter\(filter, r\)/g) || []).length).toBe(2)
  })

  it('order rows are unchanged and still marked as orders', () => {
    expect(LEDGER_API).toContain('kind: "ORDER" as const')
    expect(LEDGER_API).toContain('const rows = orders.map((o) => {')
  })

  it('the UI distinguishes them and does not open an order sheet for a purchase', () => {
    expect(LEDGER_UI).toContain('Subscription</span>')
    expect(LEDGER_UI).toContain('onClick={() => { if (r.kind !== "SUBSCRIPTION") setOpenOrder(r) }}')
  })
})

/** A whole `model X { … }` block, however long. */
function model(name: string): string {
  const start = SCHEMA.indexOf(`model ${name} {`)
  return start < 0 ? '' : SCHEMA.slice(start, SCHEMA.indexOf('\n}', start) + 2)
}

describe('4 · no schema change was needed or made', () => {
  it('LaundryPayment.orderId is still required', () => {
    const m = model('LaundryPayment')
    expect(m).toMatch(/orderId\s+String\s*$/m)          // not String?
    expect(m).toContain('order LaundryOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)')
  })

  it('a standalone subscription needs no order at all', () => {
    expect(model('SubscriptionPurchase')).toMatch(/laundryOrderId\s+String\?/)  // nullable, as before
  })
})

describe('5 · tenant and permission', () => {
  it('the same permission the counter needs to take the money', () => {
    expect(PURCHASE_API).toContain('requireLaundryPermission(request, businessId, "store_ops.payment_collection.operate")')
    expect(COLLECT_API).toContain('requireLaundryPermission(request, businessId, "store_ops.payment_collection.operate")')
  })

  it('the guard runs before anything is read or created', () => {
    const guard = PURCHASE_API.indexOf('requireLaundryPermission')
    expect(guard).toBeLessThan(PURCHASE_API.indexOf('prisma.customer.findFirst'))
    expect(guard).toBeLessThan(PURCHASE_API.indexOf('createSubscriptionPurchase('))
  })
})

describe('6 · the customer storefront purchase is untouched', () => {
  it('it still creates through the same function, unchanged', () => {
    expect(STOREFRONT).toContain('import { createSubscriptionPurchase } from "@/lib/laundry-subscription-purchase"')
    expect(STOREFRONT).toContain('requiredRoles: ["CUSTOMER"]')
  })

  it('confirmation still refuses to activate without a verified payment', () => {
    expect(PURCHASE_LIB).toContain('return { ok: false as const, pending: true, error: "Payment not verified — subscription not activated." }')
    expect(PURCHASE_LIB).toContain('export function verifyRazorpaySignature(')
  })

  it('and refunds were not introduced here', () => {
    for (const src of [PURCHASE_API, COLLECT_API]) {
      expect(src).not.toContain('REFUND')
      expect(src).not.toContain('refund')
    }
  })
})
