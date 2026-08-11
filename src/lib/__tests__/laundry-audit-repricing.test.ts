import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeQuote } from '@/lib/laundry-billing'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RULES: any = [
  { id: 'r-shirt-wf', businessId: 'b', serviceId: 's-wf', garmentId: 'g-shirt', categoryId: null, storeId: null, customerType: null, pricingType: 'PER_PIECE', price: 70, gstPercent: 0, isActive: true, minWeightKg: null, weekendPrice: null, priority: 0 },
  { id: 'r-blanket-wf', businessId: 'b', serviceId: 's-wf', garmentId: 'g-blanket', categoryId: null, storeId: null, customerType: null, pricingType: 'PER_KG', price: 50, gstPercent: 0, isActive: true, minWeightKg: null, weekendPrice: null, priority: 0 },
  { id: 'r-blanket-dc', businessId: 'b', serviceId: 's-dc', garmentId: 'g-blanket', categoryId: null, storeId: null, customerType: null, pricingType: 'PER_KG', price: 99, gstPercent: 0, isActive: true, minWeightKg: null, weekendPrice: null, priority: 0 },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const price = (items: any[], totalWeightKg: number) => computeQuote(RULES, items as any, { totalWeightKg } as any)
const shirt = { serviceId: 's-wf', garmentId: 'g-shirt', categoryId: null, quantity: 1, weightKg: 0 }
const blanket = (serviceId: string, weightKg: number) => ({ serviceId, garmentId: 'g-blanket', categoryId: null, quantity: 1, weightKg })

// THE ROOT CAUSE, pinned. computeQuote GROUPS per-kg lines and prices them from
// ctx.totalWeightKg. The rule resolves and the ₹/kg is right either way — only
// the AMOUNT collapses to zero when the context omits the weight.
describe('root cause: per-kg lines price from the order total weight', () => {
  it('resolves the Dry Clean rule and rate even with no weight context', () => {
    const l = price([blanket('s-dc', 1)], 0).lines[0]
    expect(l.matchedRuleId).toBe('r-blanket-dc')
    expect(l.unitPrice).toBe(99)
  })

  it('but amounts it at ZERO — the reported symptom', () => {
    expect(price([blanket('s-dc', 1)], 0).lines[0].baseAmount).toBe(0)
  })

  it('and prices correctly once the total weight is supplied', () => {
    expect(price([blanket('s-dc', 1)], 1).lines[0].baseAmount).toBe(99)
  })

  it('flags that the weight is what is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((price([blanket('s-dc', 1)], 0).lines[0] as any).weightRequired).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((price([blanket('s-dc', 1)], 1).lines[0] as any).weightRequired).toBe(false)
  })
})

describe('the exact production scenario', () => {
  it('Shirt + Wash & Fold prices at its piece rate', () => {
    expect(price([shirt], 0).lines[0].baseAmount).toBe(70)
  })

  // Booked Wash & Fold, audited to Dry Clean: the rate must FOLLOW the service.
  it('Blanket moved Wash & Fold → Dry Clean reprices ₹50/kg → ₹99/kg', () => {
    const before = price([shirt, blanket('s-wf', 1)], 1)
    const after = price([shirt, blanket('s-dc', 1)], 1)
    expect(before.lines[1].unitPrice).toBe(50)
    expect(before.lines[1].baseAmount).toBe(50)
    expect(after.lines[1].unitPrice).toBe(99)
    expect(after.lines[1].baseAmount).toBe(99)
  })

  it('the order total follows: ₹70 + ₹99 = ₹169', () => {
    const q = price([shirt, blanket('s-dc', 1)], 1)
    expect(r2(q.lines.reduce((s, l) => s + l.baseAmount, 0))).toBe(169)
  })

  // Changing it back must restore the original rate.
  it('Dry Clean → Wash & Fold restores ₹50/kg', () => {
    expect(price([shirt, blanket('s-wf', 1)], 1).lines[1].baseAmount).toBe(50)
  })

  it('the shirt is untouched by the blanket edit', () => {
    expect(price([shirt, blanket('s-dc', 1)], 1).lines[0].baseAmount).toBe(70)
  })
})

function r2(n: number) { return Math.round(n * 100) / 100 }

describe('the recompute passes the weight it previously omitted', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/[id]/items/[itemId]/route.ts'), 'utf8')

  it('sums the items and supplies totalWeightKg to the resolver', () => {
    expect(API).toContain('const totalWeightKg = r2(items.reduce((n, it) => n + (it.weightKg || 0), 0))')
    expect(API).toContain('delivery: false, totalWeightKg }')
  })

  it('the NA probe prices the line the same way it will be billed', () => {
    expect(API).toContain('totalWeightKg: weightKg }')
  })

  it('reports per-kg lines that cannot be priced yet', () => {
    expect(API).toContain('const needsWeight = items')
    expect(API).toContain('l.pricingType === "PER_KG" && (it.weightKg || 0) <= 0')
  })

  it('still re-prices from the CURRENT items and never a stored snapshot', () => {
    expect(API).toContain('laundryOrderItem.findMany')
    expect(API).not.toMatch(/order\.grandTotal\s*\+/)
  })

  it('runs subscription AFTER pricing, in that order', () => {
    // Scoped to recomputeOrder — the import sits at the top of the file.
    const fn = API.slice(API.indexOf('async function recomputeOrder'))
    expect(fn.indexOf('tx.laundryOrder.update')).toBeLessThan(fn.indexOf('applySubscriptionToOrder(orderId'))
  })

  it('never writes a payment row', () => {
    expect(API).not.toContain('laundryPayment')
  })
})

describe('the audit screen explains an unpriced per-kg line', () => {
  const UI = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-audit.tsx'), 'utf8')
  it('asks for the weight instead of showing a silent zero', () => {
    expect(UI).toContain('Enter the weight to price this garment')
    expect(UI).toContain('it.pricingType === "PER_KG" && !(it.weightKg > 0)')
  })
})
