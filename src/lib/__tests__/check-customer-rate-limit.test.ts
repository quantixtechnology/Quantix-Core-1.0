import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A shared IP is a shared street, not one person.
//
// The sign-in email box refused whole regions. check-customer allowed ten
// requests an hour PER IP, and an Indian carrier puts thousands of subscribers
// behind one public address — so ten sign-in attempts across all of them and
// every customer on that network was turned away at the first screen of the
// login, with no way round it and nothing they had done wrong.
//
// The limit exists to stop enumeration, which is real: this endpoint answers
// whether an address has an account. But enumeration is asking about MANY
// addresses. A customer asks about ONE, however many times they retype it.
// Counting DISTINCT emails separates those two, so the defence gets sharper
// while the shared street stops being punished.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const CHECK   = read('src/app/api/core/storefront/auth/check-customer/route.ts')
const SEND_OTP = read('src/app/api/core/storefront/auth/send-otp/route.ts')
const LOGIN_PW = read('src/app/api/core/storefront/auth/login-password/route.ts')

describe('the limit counts distinct addresses, not attempts', () => {
  it('it is distinct emails per IP', () => {
    expect(CHECK).toContain('const MAX_DISTINCT_EMAILS_PER_HOUR = 40;')
    expect(CHECK).toContain("distinct: ['email'],")
    expect(CHECK).not.toContain('MAX_CHECKS_PER_HOUR')
  })

  it('the old total-attempt counter is gone', () => {
    // db.oTPCode.count over the IP key was the thing that locked people out.
    expect(CHECK).not.toContain('const recentChecks = await db.oTPCode.count')
  })

  it('retyping the same address costs nothing and writes nothing', () => {
    // The same person retrying reveals nothing new, so it must not consume a
    // slot — otherwise one customer's fumbling still burns the shared budget.
    expect(CHECK).toContain('const repeat = await db.oTPCode.findFirst({')
    expect(CHECK).toContain("where: { phone: ipKey, email, channel: 'EMAIL_OTP', createdAt: { gte: oneHourAgo } },")
    expect(CHECK).toContain('if (!repeat) {')
  })

  it('the address is recorded, because the count depends on knowing which', () => {
    // The old row wrote email: null, which is exactly why distinct counting
    // was impossible before.
    const insert = CHECK.slice(CHECK.indexOf('await db.oTPCode.create({'))
    expect(insert).toContain('email,')
    expect(insert).not.toContain('email: null')
  })
})

describe('enumeration is still refused', () => {
  it('a source asking about many addresses still hits the wall', () => {
    expect(CHECK).toContain('if (distinct.length >= MAX_DISTINCT_EMAILS_PER_HOUR) {')
    expect(CHECK).toContain("{ status: 429 }")
  })

  it('the limit was not simply removed', () => {
    expect(CHECK).toContain('x-forwarded-for')
    expect(CHECK).toContain('CHECK_CUSTOMER_')
  })

  it('the reply still says the same thing whether the account exists or not', () => {
    expect(CHECK).toContain('Response structure is identical whether exists=true or false')
  })
})

describe('junk input cannot spend the budget', () => {
  it('both guards run before the limiter', () => {
    const required = CHECK.indexOf('email and businessId are required')
    const format = CHECK.indexOf('Invalid email format')
    const limiter = CHECK.indexOf('Rate limit: distinct emails per IP')
    expect(required).toBeLessThan(limiter)
    expect(format).toBeLessThan(limiter)
  })

  it('the lookup still happens after the limiter', () => {
    expect(CHECK.indexOf('Rate limit: distinct emails per IP')).toBeLessThan(CHECK.indexOf('Look up customer by email'))
  })
})

describe('the other login steps were already keyed to the person', () => {
  it('OTPs are limited per EMAIL, so a shared IP never mattered there', () => {
    expect(SEND_OTP).toContain('// Rate limit: 5 OTPs per email per hour')
    expect(SEND_OTP).toContain('where: { email, channel: ')
  })

  it('password attempts are limited per email and business', () => {
    expect(LOGIN_PW).toContain('`login-pw:${email}:${business.id}`')
  })

  it('so this fix is confined to the one endpoint that keyed on IP alone', () => {
    for (const src of [SEND_OTP, LOGIN_PW]) {
      expect(src).not.toContain('MAX_DISTINCT_EMAILS_PER_HOUR')
    }
  })
})
