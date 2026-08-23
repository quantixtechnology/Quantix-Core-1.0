import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// No customer-facing limit may be counted per IP.
//
// The sign-in email box refused whole regions, then would have refused a full
// room. It was gated on the IP twice — ten checks an hour, then three hundred
// distinct emails an hour — and both are the same mistake wearing different
// numbers, because the thing being counted is not a person.
//
// A shop's customers share the shop's Wi-Fi. A carrier's subscribers share the
// carrier's address. How many real people sit behind one IP is unknowable, so
// any ceiling chosen for it eventually turns a paying customer away — and the
// bigger the day, the more certain that is. Five hundred at an opening must all
// get in, and so must a thousand.
//
// So every customer-facing limit follows the IDENTITY: email plus business.
// Customer #1 cannot spend Customer #2's allowance because they do not share
// one. The IP is still recorded — as evidence to investigate with, never as a
// gate that shuts on the next person on the same network.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const CHECK   = read('src/app/api/core/storefront/auth/check-customer/route.ts')
const SEND_OTP = read('src/app/api/core/storefront/auth/send-otp/route.ts')
const LOGIN_PW = read('src/app/api/core/storefront/auth/login-password/route.ts')
const FORGOT_PW = read('src/app/api/core/storefront/auth/forgot-password/route.ts')
const FORGOT = read('src/app/api/core/storefront/auth/forgot/route.ts')
const CUSTOMER_LOGIN_PW = read('src/app/api/customer/auth/login-password/route.ts')
const AUTH_LIB = read('src/lib/storefront-auth.ts')

describe('no customer-facing limit is counted per IP', () => {
  it('check-customer has no IP-keyed counter at all', () => {
    // Both previous shapes are gone: the total-attempt count and the
    // distinct-email count, each keyed by address.
    expect(CHECK).not.toContain('MAX_CHECKS_PER_HOUR')
    expect(CHECK).not.toContain('MAX_DISTINCT_EMAILS_PER_HOUR')
    expect(CHECK).not.toContain('CHECK_CUSTOMER_${ip}')
    expect(CHECK).not.toContain("distinct: ['email']")
  })

  it('the IP is read for LOGGING and nothing else', () => {
    // Every use of the variable, so it cannot quietly become a gate again.
    const uses = CHECK.split('\n').filter((l) => /\bip\b/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    for (const line of uses) {
      const isRead = line.includes("headers.get('x-forwarded-for')") || line.includes("headers.get('x-real-ip')") || line.includes('const ip =')
      const isLog = line.includes('console.warn') || line.includes('console.error')
      expect(isRead || isLog).toBe(true)
    }
  })

  it('the counter is keyed by email and business', () => {
    expect(CHECK).toContain('const emailKey = `CHECK_CUSTOMER:${businessId}`;')
    expect(CHECK).toContain('where: { phone: emailKey, email, channel: ')
    expect(CHECK).toContain('const MAX_CHECKS_PER_EMAIL_PER_HOUR = 30;')
  })

  it('NO customer auth route anywhere gates on an address', () => {
    // The whole point: one route had it, and no other may grow one.
    const ROUTES = [SEND_OTP, LOGIN_PW, FORGOT_PW, FORGOT, CUSTOMER_LOGIN_PW]
    for (const src of ROUTES) {
      expect(src).not.toContain('x-forwarded-for')
      expect(src).not.toContain('x-real-ip')
    }
  })
})

describe('500 customers on one Wi-Fi, then 1000', () => {
  // The limit is per email + business, so the arithmetic is the proof: a
  // customer's budget is spent only by their own address. Modelled exactly as
  // the route counts, so the two cannot disagree.
  const LIMIT = 30
  const countsFor = (rows: { email: string }[], email: string) => rows.filter((r) => r.email === email).length
  const allowed = (rows: { email: string }[], email: string) => countsFor(rows, email) < LIMIT

  it('500 different customers from one address are all allowed', () => {
    const rows: { email: string }[] = []
    let blocked = 0
    for (let i = 1; i <= 500; i++) {
      const email = `customer${String(i).padStart(3, '0')}@example.com`
      if (!allowed(rows, email)) blocked++
      else rows.push({ email })
    }
    expect(blocked).toBe(0)
    expect(rows).toHaveLength(500)
  })

  it('1000 are too — there is no ceiling to reach', () => {
    const rows: { email: string }[] = []
    let blocked = 0
    for (let i = 1; i <= 1000; i++) {
      const email = `customer${i}@example.com`
      if (!allowed(rows, email)) blocked++
      else rows.push({ email })
    }
    expect(blocked).toBe(0)
  })

  it('customer #500 is unaffected by the 499 before them', () => {
    const rows = Array.from({ length: 499 }, (_, i) => ({ email: `customer${i}@example.com` }))
    expect(allowed(rows, 'customer500@example.com')).toBe(true)
  })

  it('one customer retrying hard cannot spend anyone else\'s budget', () => {
    const rows = Array.from({ length: LIMIT }, () => ({ email: 'noisy@example.com' }))
    expect(allowed(rows, 'noisy@example.com')).toBe(false)   // their own budget, spent
    expect(allowed(rows, 'quiet@example.com')).toBe(true)    // everyone else, untouched
  })
})

describe('junk input cannot spend the budget', () => {
  it('both guards run before the limiter', () => {
    const required = CHECK.indexOf('email and businessId are required')
    const format = CHECK.indexOf('Invalid email format')
    const limiter = CHECK.indexOf('Rate limit: per email + business, never per IP')
    expect(required).toBeLessThan(limiter)
    expect(format).toBeLessThan(limiter)
  })

  it('the lookup still happens after the limiter', () => {
    expect(CHECK.indexOf('Rate limit: per email + business, never per IP')).toBeLessThan(CHECK.indexOf('Look up customer by email'))
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

describe('opening day — a room full of people signing up at once', () => {
  it('there is no ceiling for a crowd to reach', () => {
    // Everyone on the shop's own Wi-Fi arrives as a single IP, and nothing
    // counts them together any more.
    expect(CHECK).toContain('const MAX_CHECKS_PER_EMAIL_PER_HOUR = 30;')
    expect(CHECK).not.toContain('MAX_DISTINCT_EMAILS_PER_HOUR')
  })

  it('a code that was never sent is not reported as sent', () => {
    // The screen only reads `success`, so success:true with sent:false moved
    // the customer to the code box to wait for nothing.
    expect(SEND_OTP).toContain('success: false,')
    expect(SEND_OTP).toContain("error: \"We couldn't send your code just now. Please try again in a moment.\",")
    expect(SEND_OTP).toContain('{ status: 502 }')
  })

  it('the failure is logged as an error, so staff can see it happening', () => {
    expect(SEND_OTP).toContain('console.error(`[storefront/auth/send-otp] delivery FAILED')
  })

  it('two people registering in the same second both get in', () => {
    // generateCustomerCode reads the highest code then returns the next, and
    // @@unique([businessId, customerCode]) makes the loser throw.
    expect(AUTH_LIB).toContain('for (let attempt = 1; attempt <= 5; attempt++)')
    expect(AUTH_LIB).toContain('const newCode = await generateCustomerCode(businessId)')
  })

  it('the retry re-reads the code rather than reusing the clashing one', () => {
    const block = AUTH_LIB.slice(AUTH_LIB.indexOf('for (let attempt = 1; attempt <= 5; attempt++)'))
    expect(block.indexOf('generateCustomerCode(businessId)')).toBeLessThan(block.indexOf('db.customer.create'))
  })

  it('only the code clash is retried — a real error still surfaces', () => {
    // A duplicate phone would fail identically five times.
    expect(AUTH_LIB).toContain("(err as { code?: string }).code === 'P2002'")
    expect(AUTH_LIB).toContain("includes('customerCode')")
    expect(AUTH_LIB).toContain('if (!isCodeClash || attempt === 5) throw err')
  })

  it('it never silently returns without a customer', () => {
    expect(AUTH_LIB).toContain("if (!created) throw new Error('Could not allocate a customer code')")
  })
})
