import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { membershipState, type MembershipSubscription } from '@/lib/laundry-subscription'

// ============================================================================
// A LOYALTY TIER IS NOT A SUBSCRIPTION.
//
// The Customers list showed "BRONZE" and nothing else, so a paying member, a
// member whose plan lapsed last month and someone who has never subscribed all
// looked identical. The tier is a loyalty band; it is never evidence of a
// subscription, and this is deliberately not derived from it.
//
// The state comes from CustomerSubscription, and the rule mirrors
// processExpiry() in laundry-subscription-renewal.ts branch for branch:
//
//   CANCELLED / SUSPENDED / PAUSED   settled decisions, reported as they are
//   now <= currentPeriodEnd          within the cycle -> the stored status
//   lapsed + plan.autoRenew          the sweep renews it -> ACTIVE
//   lapsed + graceDays > 0 && now < graceEnd  -> GRACE
//   otherwise                        EXPIRED
//
// The boundary is `now <= currentPeriodEnd` — inclusive of the end instant, and
// comparing instants rather than calendar days, exactly as processExpiry does.
//
// Reading the clock as well as the status matters because processExpiry runs as
// a SWEEP: a row can still read ACTIVE with its period already past. Status
// alone would call that customer Active when their plan ran out days ago.
//
// Verified in the real browser on the running app, Customers list:
//   MSTATE Active     ACTIVE     (period ends in 10 days)
//   MSTATE EndsToday  ACTIVE     (period ends later today — the boundary)
//   MSTATE Lapsed     EXPIRED    (row still says ACTIVE, period passed 2 days ago)
//   MSTATE Expired    EXPIRED
//   MSTATE Cancelled  CANCELLED
//   MSTATE None       NOT SUBSCRIBED
//   MSTATE TierNoSub  NOT SUBSCRIBED  (GOLD tier, no subscription)
//   row height 53–55px · search 7 rows for "MSTATE", 10 when cleared
// ============================================================================

const NOW = new Date('2026-09-05T12:00:00.000Z')
const at = (days: number, hours = 0) => new Date(NOW.getTime() + days * 86400000 + hours * 3600000)
const sub = (o: Partial<MembershipSubscription>): MembershipSubscription =>
  ({ status: 'ACTIVE', currentPeriodEnd: at(10), autoRenew: false, graceDays: 0, ...o })

describe('1 · a currently valid subscription is ACTIVE', () => {
  it('inside the cycle', () => {
    expect(membershipState(sub({ status: 'ACTIVE', currentPeriodEnd: at(10) }), NOW)).toBe('ACTIVE')
  })
})

describe('2 · a subscription past its validity is EXPIRED', () => {
  it('a row already marked EXPIRED', () => {
    expect(membershipState(sub({ status: 'EXPIRED', currentPeriodEnd: at(-5) }), NOW)).toBe('EXPIRED')
  })

  it('and a row still marked ACTIVE whose period has passed — the sweep has not run', () => {
    // This is the case status alone gets wrong.
    expect(membershipState(sub({ status: 'ACTIVE', currentPeriodEnd: at(-2) }), NOW)).toBe('EXPIRED')
  })
})

describe('3 · no subscription record is NOT SUBSCRIBED', () => {
  it('null and undefined both read as NONE', () => {
    expect(membershipState(null, NOW)).toBe('NONE')
    expect(membershipState(undefined, NOW)).toBe('NONE')
  })
})

describe('4 · the date boundary is the one processExpiry uses', () => {
  it('now <= currentPeriodEnd is still inside the cycle', () => {
    expect(membershipState(sub({ currentPeriodEnd: at(0, 6) }), NOW)).toBe('ACTIVE')   // later today
    expect(membershipState(sub({ currentPeriodEnd: NOW }), NOW)).toBe('ACTIVE')        // the exact instant
  })

  it('one millisecond past it is not', () => {
    expect(membershipState(sub({ currentPeriodEnd: new Date(NOW.getTime() - 1) }), NOW)).toBe('EXPIRED')
  })

  it('it compares instants, not calendar days', () => {
    // Earlier the same calendar day, but already past: expired, not "today so active".
    expect(membershipState(sub({ currentPeriodEnd: at(0, -3) }), NOW)).toBe('EXPIRED')
  })
})

describe('5 · a membership tier never implies a subscription', () => {
  it('the helper is given a subscription, never a tier', () => {
    const SRC = readFileSync(join(process.cwd(), 'src/lib/laundry-subscription.ts'), 'utf8')
    const fn = SRC.slice(SRC.indexOf('export function membershipState('))
    expect(fn).not.toMatch(/loyaltyTier|BRONZE|SILVER|GOLD|tier/i)
  })

  it('and a tiered customer with no subscription is NOT SUBSCRIBED', () => {
    expect(membershipState(null, NOW)).toBe('NONE')
  })
})

describe('6 · the other authoritative statuses are reported, not rounded', () => {
  it('cancelled, suspended and paused keep their own meaning', () => {
    // Rounding these to "Expired" would tell staff something untrue about why
    // the subscription stopped. None of the three is re-judged by the clock —
    // processExpiry returns them untouched too.
    expect(membershipState(sub({ status: 'CANCELLED', currentPeriodEnd: at(10) }), NOW)).toBe('CANCELLED')
    expect(membershipState(sub({ status: 'CANCELLED', currentPeriodEnd: at(-10) }), NOW)).toBe('CANCELLED')
    expect(membershipState(sub({ status: 'SUSPENDED', currentPeriodEnd: at(-10) }), NOW)).toBe('SUSPENDED')
    expect(membershipState(sub({ status: 'PAUSED', currentPeriodEnd: at(-10) }), NOW)).toBe('PAUSED')
  })

  it('grace is a live state, exactly while the grace window is open', () => {
    expect(membershipState(sub({ status: 'ACTIVE', currentPeriodEnd: at(-1), graceDays: 3 }), NOW)).toBe('GRACE')
    expect(membershipState(sub({ status: 'ACTIVE', currentPeriodEnd: at(-5), graceDays: 3 }), NOW)).toBe('EXPIRED')
    // An explicit graceEndsAt wins over the computed one, as in processExpiry.
    expect(membershipState(sub({ status: 'GRACE', currentPeriodEnd: at(-9), graceDays: 1, graceEndsAt: at(2) }), NOW)).toBe('GRACE')
  })

  it('a lapsed cycle on an auto-renewing plan is renewed by the sweep, so it stays ACTIVE', () => {
    expect(membershipState(sub({ status: 'ACTIVE', currentPeriodEnd: at(-2), autoRenew: true }), NOW)).toBe('ACTIVE')
  })

  it('the live pair is the same one the rest of the system uses', () => {
    const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/route.ts'), 'utf8')
    expect(API).toContain('status: { in: ["ACTIVE", "GRACE"] }')   // the pre-existing subscriber filter
  })
})

describe('7 · the list gets it from one query, and writes nothing', () => {
  const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/customers/route.ts'), 'utf8')
  const GET = API.slice(API.indexOf('export async function GET'), API.indexOf('export async function POST'))

  // Comments are prose; the note explaining which branches this mirrors names
  // processExpiry, which is not a call to it. Strip them before asserting.
  const CODE = GET.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

  it('one findMany for the whole page, not one per row', () => {
    expect(CODE).toContain('customerId: { in: pageIds }')
    // Two in this handler: the pre-existing subscriber filter, and this one.
    // What matters is that neither sits inside a loop over the rows.
    expect((CODE.match(/prisma\.customerSubscription\.findMany/g) || []).length).toBe(2)
    // The row mapping itself must not await anything — that is what "one query
    // for the page" means. (`pageIds = rows.map(...)` precedes the query, which
    // is why the guard is scoped to the mapping block rather than to `rows.map`.)
    const mapping = CODE.slice(CODE.indexOf('const data = rows.map('))
    expect(mapping.slice(0, mapping.indexOf('})'))).not.toContain('await')
  })

  it('it is read-only — no subscription is created, renewed, expired or cancelled', () => {
    expect(CODE).not.toMatch(/customerSubscription\.(create|update|delete|upsert)/)
    expect(CODE).not.toMatch(/renewSubscription|processExpiry|cancelSubscription|suspendSubscription/)
  })

  it('the state is computed by the shared helper, not inline', () => {
    expect(GET).toContain('membershipState(')
    expect(API).toContain('import { membershipState } from "@/lib/laundry-subscription"')
  })

  it('and the existing list behaviour is untouched', () => {
    for (const kept of ['includeArchived', 'where.isActive = true', 'customerCode: { contains: q }', 'summary: { totalCustomers, activeCustomers, activeMemberships }']) {
      expect(GET).toContain(kept)
    }
  })
})

describe('8 · the cell shows the tier and the state as two facts', () => {
  const VIEW = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-customers-view.tsx'), 'utf8')

  it('the tier badge is unchanged where a subscription exists', () => {
    expect(VIEW).toContain('<Badge variant="outline" className={`text-[11px] ${tierStyle(c.loyaltyTier)}`}>{c.loyaltyTier || "Bronze"}</Badge>')
  })

  it('the state is read from the API field, never from the tier', () => {
    const cell = VIEW.slice(VIEW.indexOf('{c.membershipState !== "NONE" && ('), VIEW.indexOf('<TableCell className="text-right tabular-nums">{inr(c.walletBalance)}'))
    expect(cell).toContain('M_ROW_STATE[c.membershipState || "NONE"].label')
    expect(cell).not.toMatch(/loyaltyTier.*(ACTIVE|Active|EXPIRED)/)
  })

  it('every state the enum can hold has a label', () => {
    for (const s of ['ACTIVE', 'GRACE', 'EXPIRED', 'CANCELLED', 'PAUSED', 'SUSPENDED', 'NONE']) {
      expect(VIEW).toMatch(new RegExp(`\\b${s}: \\{ label:`))
    }
    expect(VIEW).toContain('NONE: { label: "Not Subscribed"')
  })
})
