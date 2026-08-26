import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  readCustomerOrderingMode, writeCustomerOrderingMode, bypassesStoreHours,
  isCustomerOrderingMode, DEFAULT_CUSTOMER_ORDERING_MODE, CUSTOMER_ORDERING_KEY,
} from '@/lib/customer-ordering'

// ============================================================================
// Working hours answer a question about the shop. Whether a customer may place
// an order is a different question, and some businesses answer it differently:
// take the booking at midnight, do the work at nine.
//
// So this moves exactly one thing — whether the CLOCK closes ordering — and is
// opt-in, because every tenant already running on store hours is running
// correctly and must not notice this exists.
// ============================================================================

const ROOT = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const STORE     = read('src/lib/core/store.ts')
const AVAIL     = read('src/lib/laundry-availability.ts')
const API       = read('src/app/api/laundry/availability/route.ts')
const CONTEXT   = read('src/app/api/core/storefront/store-context/route.ts')
const WEBSITE   = read('src/components/storefront/web/storefront-website.tsx')
const FORM      = read('src/components/laundry/views/laundry-availability-settings-form.tsx')

describe('existing tenants change in no way at all', () => {
  it('absent means follow the working hours', () => {
    expect(readCustomerOrderingMode(null)).toBe('FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode(undefined)).toBe('FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode('{}')).toBe('FOLLOW_STORE_HOURS')
    expect(DEFAULT_CUSTOMER_ORDERING_MODE).toBe('FOLLOW_STORE_HOURS')
  })

  it('a settings blob about other things is still the default', () => {
    expect(readCustomerOrderingMode(JSON.stringify({ resourceOverrides: { storageGB: 5 } }))).toBe('FOLLOW_STORE_HOURS')
  })

  it('malformed or unrecognised never throws a shop open', () => {
    expect(readCustomerOrderingMode('not json')).toBe('FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode('[]')).toBe('FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode(JSON.stringify({ [CUSTOMER_ORDERING_KEY]: 'ALWAYS' }))).toBe('FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode(JSON.stringify({ [CUSTOMER_ORDERING_KEY]: true }))).toBe('FOLLOW_STORE_HOURS')
  })

  it('only the two real values are accepted', () => {
    expect(isCustomerOrderingMode('ALWAYS_OPEN')).toBe(true)
    expect(isCustomerOrderingMode('FOLLOW_STORE_HOURS')).toBe(true)
    expect(isCustomerOrderingMode('FORCE_OPEN')).toBe(false)
    expect(isCustomerOrderingMode(null)).toBe(false)
  })
})

describe('turning it on, and off again', () => {
  it('round-trips', () => {
    const on = writeCustomerOrderingMode(null, 'ALWAYS_OPEN')
    expect(readCustomerOrderingMode(on)).toBe('ALWAYS_OPEN')
    const off = writeCustomerOrderingMode(on, 'FOLLOW_STORE_HOURS')
    expect(readCustomerOrderingMode(off)).toBe('FOLLOW_STORE_HOURS')
  })

  it('never loses anything else in settings', () => {
    // resourceOverrides lives here too; saving this must not be how it vanishes.
    const before = JSON.stringify({ resourceOverrides: { storageGB: 25 }, somethingElse: 'keep me' })
    const after = writeCustomerOrderingMode(before, 'ALWAYS_OPEN')
    const parsed = JSON.parse(after)
    expect(parsed.resourceOverrides).toEqual({ storageGB: 25 })
    expect(parsed.somethingElse).toBe('keep me')
    expect(parsed[CUSTOMER_ORDERING_KEY]).toBe('ALWAYS_OPEN')
  })

  it('only the clock is relaxed', () => {
    expect(bypassesStoreHours('ALWAYS_OPEN')).toBe(true)
    expect(bypassesStoreHours('FOLLOW_STORE_HOURS')).toBe(false)
  })
})

describe('24/7 relaxes the hours and nothing else', () => {
  it('the store gate skips ONLY the timings branch', () => {
    expect(STORE).toContain('if (!opts.ignoreWorkingHours && store.storeTimings.length > 0) {')
  })

  it('every deliberate closure still closes the shop', () => {
    // Offline, temporarily closed and the operator's switch are someone saying
    // "not now" on purpose — unrelated to the hour of the day.
    // The body of checkStoreOpen only — not its signature, where the parameter
    // is declared, and not the other functions that share these phrases.
    const start = STORE.indexOf('export async function checkStoreOpen')
    const bodyStart = STORE.indexOf('if (!store) {', start)
    const fn = STORE.slice(bodyStart, STORE.indexOf('if (!opts.ignoreWorkingHours', bodyStart))
    expect(fn).toContain("if (override === 'FORCE_CLOSED')")
    expect(fn).toContain("if (store.status !== 'ACTIVE')")
    expect(fn).toContain('if (store.closedReason || store.closedUntil)')
    expect(fn).toContain('!business.isOnline')
    // …and none of them consults the flag.
    expect(fn).not.toContain('opts.ignoreWorkingHours')
  })

  it('pickup and delivery slots keep following the schedule regardless of ordering mode', () => {
    // The date/slot checks sit AFTER the open-now check.  The customer ordering
    // mode (ALWAYS_OPEN) only relaxes "is the store open right now".  Pickup
    // and delivery slots always follow the operating schedule — this was always
    // the contract (customer-ordering.ts:15-18) and is now enforced in code.
    const guard = AVAIL.slice(AVAIL.indexOf('export async function assertLaundryBookingOpen'))
    expect(guard).toContain('assertLaundryDateAvailable(store.storeTimings, c.date, c.label, store.closedUntil)')
    expect(guard).toContain('slotsWithinWorkingHours([c.slot], row.openTime, row.closeTime)')
    // The date/slot section does NOT reference bypassesStoreHours — the
    // schedule is always enforced for slots.
    expect(guard).not.toContain('dateOpts')
  })

  it('the working hours themselves are never rewritten', () => {
    const fn = AVAIL.slice(AVAIL.indexOf('export async function resolveCustomerOrderingMode'), AVAIL.indexOf('export async function assertLaundryBookingOpen'))
    expect(fn).toContain('select: { settings: true }')
    expect(fn).not.toContain('storeTimings')
    expect(fn).not.toContain('update')
  })

  it('it is not the operator Force Open switch', () => {
    // A different concept with a different lifetime; reusing it would have made
    // the override meaningless. The operator switch still exists and is still
    // handled — this simply is not it.
    const mine = AVAIL.slice(AVAIL.indexOf('export async function resolveCustomerOrderingMode'), AVAIL.indexOf('const checks:'))
    expect(mine).not.toContain('FORCE_OPEN')
    expect(mine).not.toContain('statusOverride')
    expect(readCustomerOrderingMode(JSON.stringify({ [CUSTOMER_ORDERING_KEY]: 'FORCE_OPEN' }))).toBe('FOLLOW_STORE_HOURS')
  })
})

describe('the button and the server agree', () => {
  it('the server gate reads the tenant mode', () => {
    expect(AVAIL).toContain('const ordering = await resolveCustomerOrderingMode(input)')
    expect(AVAIL).toContain('ignoreWorkingHours: bypassesStoreHours(ordering),')
  })

  it('the customer website reads the same mode', () => {
    expect(CONTEXT).toContain('customerOrderingMode: readCustomerOrderingMode(business.settings),')
    expect(WEBSITE).toContain('const alwaysOpen = biz.customerOrderingMode === "ALWAYS_OPEN"')
    expect(WEBSITE).toContain('} else if (isOnline && alwaysOpen) {')
  })

  it('the website skips only the hours branch too', () => {
    // The deliberate-closure branches sit above it and are reached first.
    const fn = WEBSITE.slice(WEBSITE.indexOf('const alwaysOpen ='), WEBSITE.indexOf('} else if (isOnline && store.storeTimings'))
    expect(fn).toContain('FORCE_CLOSED')
    expect(fn).toContain('temporarily closed')
  })

  it('the customer PWA gets its answer from the same server helper', () => {
    // It reads laundry-slots, which calls checkStoreOpen with the same flag —
    // so an app showing an open shop cannot meet a server that refuses.
    expect(AVAIL).toContain('checkStoreOpen(sid, { ignoreWorkingHours: bypassesStoreHours(readCustomerOrderingMode(b?.settings)) })')
  })
})

describe('it is a tenant setting, stored and generic', () => {
  it('saved per business, preserving the rest of settings', () => {
    expect(API).toContain('data: { settings: writeCustomerOrderingMode(current?.settings, b.customerOrderingMode) },')
    expect(API).toContain('if (!isCustomerOrderingMode(b.customerOrderingMode))')
  })

  it('read back so a refresh keeps it', () => {
    expect(API).toContain('const customerOrderingMode = readCustomerOrderingMode(bizRow?.settings)')
    expect(FORM).toContain('if (d.customerOrderingMode === "ALWAYS_OPEN" || d.customerOrderingMode === "FOLLOW_STORE_HOURS")')
  })

  it('changing it needs the settings permission', () => {
    expect(API).toContain('requireLaundryPermission(request, b.businessId, "laundry.settings.edit")')
  })

  it('no tenant is named anywhere', () => {
    for (const src of [STORE, AVAIL, API, CONTEXT, WEBSITE, FORM, read('src/lib/customer-ordering.ts')]) {
      expect(src.toLowerCase()).not.toContain('vastrasudha')
    }
  })

  it('the owner is told what it does and does not change', () => {
    expect(FORM).toContain('Customer Ordering Availability')
    expect(FORM).toContain('Follow Store Working Hours')
    expect(FORM).toContain('24/7 Ordering')
    expect(FORM).toContain('Pickup and delivery slots continue to follow your operational schedule.')
  })

  it('a failed save puts the control back', () => {
    // Optimistic, but not dishonest: the radio must not claim a setting the
    // server rejected.
    expect(FORM).toContain('setOrdering(previous)')
  })
})
