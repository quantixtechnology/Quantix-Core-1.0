import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { subscriptionBalance } from '@/lib/laundry-subscription-balance'

// ============================================================================
// One subscription balance, everywhere.
//
// The failure this guards against is a customer reading "38 remaining" on the
// storefront and "42 remaining" while scheduling a pickup. Both now call the
// same function through the same endpoint.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const STATUS = read('src/app/api/core/storefront/laundry-subscription/status/route.ts')
const SHEET = read('src/components/storefront/web/subscription-usage-sheet.tsx')
const HOME = read('src/components/storefront/web/storefront-laundry-home.tsx')
const PURCHASE = read('src/lib/laundry-subscription-purchase.ts')

const usages = (...n: number[]) => n.map((creditsUsed) => ({ creditsUsed }))

describe('the balance arithmetic', () => {
  it('used + remaining = allowance for a part-used plan', () => {
    const b = subscriptionBalance({ totalCredits: 70, usages: usages(20, 12) })
    expect(b.allowance).toBe(70)
    expect(b.used).toBe(32)
    expect(b.remaining).toBe(38)
    expect(b.used + b.remaining).toBe(b.allowance)
    expect(b.fullyUsed).toBe(false)
    expect(b.percentUsed).toBe(46)
  })

  it('a fully consumed plan reads 0 remaining, not a negative', () => {
    const b = subscriptionBalance({ totalCredits: 70, usages: usages(70) })
    expect(b.used).toBe(70)
    expect(b.remaining).toBe(0)
    expect(b.fullyUsed).toBe(true)
    expect(b.percentUsed).toBe(100)
  })

  it('over-consumption never shows a negative remainder', () => {
    // Showing "-3 remaining" would read as a debt the customer does not owe.
    const b = subscriptionBalance({ totalCredits: 70, usages: usages(73) })
    expect(b.remaining).toBe(0)
    expect(b.used).toBe(73) // used stays truthful
    expect(b.percentUsed).toBe(100)
  })

  it('an untouched plan is fully available', () => {
    const b = subscriptionBalance({ totalCredits: 70, usages: [] })
    expect(b).toMatchObject({ allowance: 70, used: 0, remaining: 70, ordersUsed: 0, fullyUsed: false, percentUsed: 0 })
  })

  it('falls back to the plan allowance when the subscription carries none', () => {
    expect(subscriptionBalance({ totalCredits: 0, planTotalCredits: 50, usages: usages(10) }).allowance).toBe(50)
  })

  it('a plan with no allowance is not reported as fully used', () => {
    // 0 of 0 is "nothing to show", not "you have run out".
    const b = subscriptionBalance({ totalCredits: 0, planTotalCredits: 0, usages: [] })
    expect(b.allowance).toBe(0)
    expect(b.fullyUsed).toBe(false)
    expect(b.percentUsed).toBe(0)
  })

  it('counts orders from the same rows it sums', () => {
    const b = subscriptionBalance({ totalCredits: 70, usages: usages(4, 6, 2) })
    expect(b.ordersUsed).toBe(3)
    expect(b.used).toBe(12)
  })

  it('tolerates missing/blank credit values', () => {
    const b = subscriptionBalance({ totalCredits: 10, usages: [{ creditsUsed: null }, { creditsUsed: undefined }, { creditsUsed: 3 }] })
    expect(b.used).toBe(3)
    expect(b.remaining).toBe(7)
  })
})

describe('one source of truth', () => {
  it('pickup scheduling and the popup call the SAME endpoint', () => {
    // The checkbox in the pickup/checkout sheet and the usage popup both post
    // to laundry-subscription/status.
    expect(HOME).toContain('/api/core/storefront/laundry-subscription/status')
    expect(SHEET).toContain('/api/core/storefront/laundry-subscription/status')
  })

  it('that endpoint computes nothing of its own', () => {
    expect(STATUS).toContain('subscriptionBalance(')
    // No open-coded arithmetic left behind.
    expect(STATUS).not.toContain('reduce((s, u) => s + (u.creditsUsed || 0), 0)')
    expect(STATUS).not.toContain('Math.max(0, allowance - used)')
  })

  it('the storefront card reads the same function too', () => {
    // Otherwise the card could say one thing and the popup another on the very
    // same screen.
    expect(PURCHASE).toContain('subscriptionBalance(')
    expect(PURCHASE).not.toContain('Math.max(0, activeSub.totalCredits - used)')
  })

  it('the popup does no arithmetic — it renders what it is given', () => {
    expect(SHEET).not.toContain('reduce(')
    expect(SHEET).not.toMatch(/allowance\s*-\s*used/)
  })

  it('no second subscription model or ledger was introduced', () => {
    const lib = read('src/lib/laundry-subscription-balance.ts')
    expect(lib).not.toContain('prisma')
    expect(lib).not.toContain('@prisma/client')
  })
})

describe('used means counted, and the popup says when', () => {
  it('used is summed from the existing SubscriptionUsage rows', () => {
    // Written by the subscription engine when it applies coverage — this
    // endpoint only reads them and never consumes allowance.
    expect(STATUS).toContain('usages:')
    expect(STATUS).not.toContain('subscriptionUsage.create')
    expect(STATUS).not.toContain('update(')
  })

  it('prefers the order’s existing auditedAt as the last-updated stamp', () => {
    // Store Audit is where a service becomes officially counted. No new
    // timestamp is written for this popup.
    expect(STATUS).toContain('auditedAt: true')
    expect(STATUS).toContain('order.auditedAt ?? lastUsage.createdAt')
    expect(STATUS).toContain('audited: !!order.auditedAt')
  })

  it('does not claim a Store Audit that never happened', () => {
    expect(SHEET).toContain('data.lastUpdatedAfterAudit ? "Store Audit" : "Service update"')
  })

  it('reports the last service from the same usage row', () => {
    expect(STATUS).toContain('lastService')
    expect(SHEET).toContain('Last service')
  })
})

describe('the popup states', () => {
  it('shows a clear fully-used state', () => {
    expect(SHEET).toContain('Fully used for this cycle')
  })

  it('handles no active subscription without breaking', () => {
    expect(SHEET).toContain('You do not have an active subscription.')
    expect(STATUS).toContain('data: { active: false }')
  })

  it('says so plainly when the balance cannot be loaded', () => {
    expect(SHEET).toContain('Could not load your subscription just now.')
  })

  it('is a popup, not a management screen', () => {
    expect(SHEET).toContain('Close')
    expect(SHEET).not.toContain('Cancel Subscription')
    expect(SHEET).not.toContain('Upgrade')
  })

  it('only offers View Details when a route was supplied', () => {
    // No dead button pointing at a screen that does not exist.
    expect(SHEET).toContain('onViewOrder &&')
  })
})

describe('the storefront card', () => {
  it('keeps Active — View Plan as the entry point', () => {
    expect(HOME).toContain('✓ Active — View Plan')
    expect(HOME).toContain('setUsageOpen(true)')
  })

  it('adds one small remaining line, only when known', () => {
    expect(HOME).toContain('subSummary?.active?.remaining != null')
    expect(HOME).toContain('clothes remaining')
  })
})
