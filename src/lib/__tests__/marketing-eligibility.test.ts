import { describe, it, expect } from 'vitest'
import { checkEligibility, parseApplyTo } from '@/lib/marketing'
import type { PromotionLite, PromoContext } from '@/lib/marketing'
import { APPLY_TO_OPTIONS } from '@/components/laundry/views/marketing/marketing-shared'

// ============================================================================
// A refused coupon must say the ONE thing that is actually wrong.
//
// "This coupon is not currently active" covered five separate failures —
// expired, not yet started, paused, disabled, exhausted. A customer at a
// counter cannot act on that and the operator cannot explain it, so every
// branch now names its own cause and carries a machine-readable code.
// ============================================================================

const NOW = new Date('2026-08-10T12:00:00')
const day = (s: string) => new Date(`${s}T12:00:00`)

const promo = (o: Partial<PromotionLite> = {}): PromotionLite => ({
  id: 'p1', businessId: 'b1', workspaceType: null, kind: 'VOUCHER',
  title: 'Test', description: null, code: 'SAVE10',
  discountType: 'PERCENT', discountValue: 10, maxDiscount: null, minOrderValue: null,
  status: 'ACTIVE', enabled: true, startAt: null, endAt: null,
  maxUses: null, maxUsesPerCustomer: null, usedCount: 0,
  applyTo: JSON.stringify(['ORDER']), rules: [],
  ...o,
})

const ctx = (o: PromoContext = {}): PromoContext => ({ orderValue: 500, applyTo: 'ORDER', ...o })

describe('a valid coupon', () => {
  it('is eligible with no reason attached', () => {
    const r = checkEligibility(promo(), ctx(), NOW)
    expect(r.eligible).toBe(true)
    expect(r.reason).toBeUndefined()
  })
})

describe('each refusal names its own cause', () => {
  it('disabled', () => {
    const r = checkEligibility(promo({ enabled: false }), ctx(), NOW)
    expect(r.code).toBe('DISABLED')
    expect(r.reason).toMatch(/disabled/i)
  })

  it('paused reads as disabled rather than inactive', () => {
    expect(checkEligibility(promo({ status: 'PAUSED' }), ctx(), NOW).code).toBe('DISABLED')
  })

  it('not started yet, and says when it opens', () => {
    const r = checkEligibility(promo({ startAt: day('2026-08-20') }), ctx(), NOW)
    expect(r.code).toBe('NOT_STARTED')
    expect(r.reason).toContain('20 Aug 2026')
  })

  it('expired by end date, and says when it closed', () => {
    const r = checkEligibility(promo({ endAt: day('2026-08-01') }), ctx(), NOW)
    expect(r.code).toBe('EXPIRED')
    expect(r.reason).toContain('01 Aug 2026')
  })

  it('expired by status even with no end date', () => {
    expect(checkEligibility(promo({ status: 'EXPIRED' }), ctx(), NOW).code).toBe('EXPIRED')
  })

  it('global usage limit reached', () => {
    const r = checkEligibility(promo({ maxUses: 100, usedCount: 100 }), ctx(), NOW)
    expect(r.code).toBe('USAGE_LIMIT')
    expect(r.reason).toMatch(/usage limit/i)
  })

  // Distinct from the global cap: the coupon is fine, this customer is done.
  it('already redeemed by this customer', () => {
    const r = checkEligibility(promo({ maxUsesPerCustomer: 1 }), ctx({ customerRedemptions: 1 }), NOW)
    expect(r.code).toBe('ALREADY_REDEEMED')
    expect(r.reason).toMatch(/already redeemed/i)
  })

  it('minimum order value, quoted in rupees', () => {
    const r = checkEligibility(promo({ minOrderValue: 200 }), ctx({ orderValue: 150 }), NOW)
    expect(r.code).toBe('MIN_ORDER')
    expect(r.reason).toBe('Minimum order of ₹200 required.')
  })

  it('wrong workspace', () => {
    const r = checkEligibility(promo({ workspaceType: 'COMMERCE' }), ctx({ workspaceType: 'LAUNDRY' }), NOW)
    expect(r.code).toBe('WRONG_WORKSPACE')
  })

  it('fails a rule', () => {
    const r = checkEligibility(promo({ rules: [{ fact: 'firstOrder', op: 'isTrue', value: 'true' }] }), ctx({ firstOrder: false }), NOW)
    expect(r.code).toBe('RULES')
  })
})

// The refusal names what the coupon IS for, not only what this purchase is not.
describe('purchase-type refusals name the campaign', () => {
  it('for a single type', () => {
    const p = promo({ applyTo: JSON.stringify(['SUBSCRIPTION_PURCHASE']) })
    const r = checkEligibility(p, ctx({ applyTo: 'ORDER' }), NOW)
    expect(r.code).toBe('WRONG_PURCHASE_TYPE')
    expect(r.reason).toBe('Valid only for subscription purchase.')
  })

  it('for renewals', () => {
    const p = promo({ applyTo: JSON.stringify(['SUBSCRIPTION_RENEWAL']) })
    expect(checkEligibility(p, ctx({ applyTo: 'ORDER' }), NOW).reason).toBe('Valid only for subscription renewal.')
  })

  it('lists several types readably', () => {
    const p = promo({ applyTo: JSON.stringify(['SUBSCRIPTION_PURCHASE', 'SUBSCRIPTION_RENEWAL', 'ANNUAL_PLAN']) })
    expect(checkEligibility(p, ctx({ applyTo: 'ORDER' }), NOW).reason)
      .toBe('Valid only for subscription purchase, subscription renewal and annual plans.')
  })

  it('names a new campaign type without needing to be taught it', () => {
    const p = promo({ applyTo: JSON.stringify(['BIRTHDAY']) })
    expect(checkEligibility(p, ctx({ applyTo: 'ORDER' }), NOW).reason).toBe('Valid only for birthday rewards.')
  })
})

// The coupon's own state is judged before its fit with the cart: an expired
// coupon should say so, not complain about the order value.
describe('the most useful reason wins', () => {
  it('reports expiry ahead of a minimum-order failure', () => {
    const p = promo({ endAt: day('2026-08-01'), minOrderValue: 1000 })
    expect(checkEligibility(p, ctx({ orderValue: 10 }), NOW).code).toBe('EXPIRED')
  })

  it('reports the start date ahead of a purchase-type mismatch', () => {
    const p = promo({ startAt: day('2026-09-01'), applyTo: JSON.stringify(['SUBSCRIPTION_RENEWAL']) })
    expect(checkEligibility(p, ctx({ applyTo: 'ORDER' }), NOW).code).toBe('NOT_STARTED')
  })
})

describe('campaign types', () => {
  it('offers the subscription and marketing campaigns independently', () => {
    const values = APPLY_TO_OPTIONS.map((o) => o.value)
    for (const k of ['ORDER', 'FIRST_ORDER', 'SUBSCRIPTION_PURCHASE', 'SUBSCRIPTION_RENEWAL',
      'SUBSCRIPTION_UPGRADE', 'ANNUAL_PLAN', 'REFERRAL_REWARD', 'BIRTHDAY',
      'LOYALTY_REWARD', 'FESTIVAL_CAMPAIGN', 'RECOVERY']) {
      expect(values).toContain(k)
    }
  })

  // Existing rows contain these exact strings; renaming them would silently
  // invalidate live coupons.
  it('keeps the original keys intact', () => {
    const values = APPLY_TO_OPTIONS.map((o) => o.value)
    expect(values.slice(0, 1)).toEqual(['ORDER'])
    expect(values).toContain('SUBSCRIPTION_PURCHASE')
    expect(values).toContain('SUBSCRIPTION_RENEWAL')
  })

  it('an older coupon with no applyTo still means a normal order', () => {
    expect(parseApplyTo(null)).toEqual(['ORDER'])
    expect(parseApplyTo('not json')).toEqual(['ORDER'])
  })

  it('a coupon may carry several campaigns at once', () => {
    const p = promo({ applyTo: JSON.stringify(['BIRTHDAY', 'LOYALTY_REWARD']) })
    expect(checkEligibility(p, ctx({ applyTo: 'BIRTHDAY' }), NOW).eligible).toBe(true)
    expect(checkEligibility(p, ctx({ applyTo: 'LOYALTY_REWARD' }), NOW).eligible).toBe(true)
  })
})
