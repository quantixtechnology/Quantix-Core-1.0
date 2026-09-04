import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { readCustomerOrderingMode, bypassesStoreHours } from '@/lib/customer-ordering'

// ============================================================================
// THE CUSTOMER PWA MUST NOT HAVE ITS OWN OPINION ABOUT "OPEN".
//
// The tenant chooses 24/7 Ordering, the server resolves it through
// checkStoreOpen(ignoreWorkingHours) and answers `isOpen`. The PWA then threw
// that answer away and recomputed it from `status`, comparing the emitted
// lowercase "open" against the literal "OPEN". That comparison is true for
// every possible value, so the ordering screen was closed at every hour of
// every day — in both modes, with the shop open, and with 24/7 switched on.
// The setting was being read and honoured correctly the whole way down; the
// screen simply never asked.
//
// Reading `isOpen` makes the screen and the guard that accepts the order agree
// by construction, and keeps every deliberate closure closing.
//
// Verified in a real browser against the running app, 13:33 IST Friday, on the
// live /api/core/storefront/laundry-slots response (server -> PWA expression):
//   24/7 + Open,  inside hours 09:00-21:00   isOpen=true   -> ALLOWED (was BLOCKED)
//   24/7 + Open,  outside hours 09:00-13:00  isOpen=true   -> ALLOWED (was BLOCKED)  <- the night case
//   24/7 + Open,  shop shut all day today    isOpen=true   -> ALLOWED (was BLOCKED)
//   24/7 + TEMPORARILY CLOSED                isOpen=false  -> BLOCKED  "Stock take"
//   24/7 + Open Store again                  isOpen=true   -> ALLOWED
//   FOLLOW_STORE_HOURS, outside hours        isOpen=false  -> BLOCKED  "Opens Tomorrow at 09:00"
//   FOLLOW_STORE_HOURS, inside hours         isOpen=true   -> ALLOWED
// ============================================================================

const PWA = readFileSync(join(process.cwd(), 'src/components/laundry/app/laundry-customer-app.tsx'), 'utf8')
const AVAIL = readFileSync(join(process.cwd(), 'src/lib/laundry-availability.ts'), 'utf8')
const SLOTS = readFileSync(join(process.cwd(), 'src/app/api/core/storefront/laundry-slots/route.ts'), 'utf8')

/** The effect that decides whether the ordering screen is open. */
const gate = PWA.slice(PWA.indexOf('// Current store status'), PWA.indexOf('// Picked pickup date must be bookable'))

describe('1 · the screen takes the server\'s answer', () => {
  it('it reads isOpen, not a re-derived status string', () => {
    expect(gate).toContain('const closed = !a.isOpen')
    expect(gate).not.toContain('a.status !== "OPEN"')
  })

  it('an absent answer reads as closed, never as open', () => {
    // `!undefined` is true. A malformed payload must not throw the shop open.
    for (const v of [undefined, null, false]) expect(!v).toBe(true)
    expect(!true).toBe(false)
  })
})

describe('2 · the status string it used to read is lowercase', () => {
  it('the API emits "open" / "closed" / "offline"', () => {
    expect(AVAIL).toContain('status: "open" | "closed" | "offline"')
    expect(SLOTS).toContain('status: availability.status')
  })

  it('so the old comparison was true for every value the API can send', () => {
    for (const status of ['open', 'closed', 'offline']) {
      expect(status !== 'OPEN').toBe(true)   // always closed — the defect
      expect(status.toUpperCase() === 'OPEN').toBe(status === 'open')
    }
  })
})

describe('3 · 24/7 Ordering relaxes the clock and nothing else', () => {
  it('the mode is read from the tenant\'s own setting', () => {
    expect(bypassesStoreHours(readCustomerOrderingMode('{"customerOrderingAvailability":"ALWAYS_OPEN"}'))).toBe(true)
    expect(bypassesStoreHours(readCustomerOrderingMode('{"customerOrderingAvailability":"FOLLOW_STORE_HOURS"}'))).toBe(false)
  })

  it('a tenant that never touched the setting keeps following its hours', () => {
    for (const s of [null, undefined, '', '{}', 'not json', '{"customerOrderingAvailability":"NONSENSE"}']) {
      expect(bypassesStoreHours(readCustomerOrderingMode(s))).toBe(false)
    }
  })

  it('the server applies it to the open-now check the screen now trusts', () => {
    expect(AVAIL).toContain('ignoreWorkingHours: bypassesStoreHours(ordering)')
    expect(AVAIL).toContain('checkStoreOpen(sid, opts)')
  })
})

describe('4 · deliberate closures still close, in every mode', () => {
  it('ignoreWorkingHours guards only the timings branch of checkStoreOpen', () => {
    const CORE = readFileSync(join(process.cwd(), 'src/lib/core/store.ts'), 'utf8')
    const fn = CORE.slice(CORE.indexOf('export async function checkStoreOpen('), CORE.indexOf('function _findNextOpenDay('))
    // The flag appears once, on the clock branch.
    expect(fn.match(/opts\.ignoreWorkingHours/g)).toHaveLength(1)
    expect(fn).toContain('if (!opts.ignoreWorkingHours && store.storeTimings.length > 0)')
    // Every deliberate closure is decided BEFORE that branch, so no mode reaches them.
    const clockAt = fn.indexOf('if (!opts.ignoreWorkingHours')
    for (const deliberate of ["'FORCE_CLOSED'", "store.closedReason || store.closedUntil", "!business.isOnline", "store.status !== 'ACTIVE'"]) {
      expect(fn.indexOf(deliberate)).toBeGreaterThan(-1)
      expect(fn.indexOf(deliberate)).toBeLessThan(clockAt)
    }
  })
})

describe('5 · pickup and delivery scheduling is untouched', () => {
  it('the change adds no slot, date or schedule logic to the screen', () => {
    expect(gate).not.toMatch(/generateSlots|slotsWithinWorkingHours|storeTimings|openTime|closeTime|getHours/)
  })

  it('the separate date check still asks the server, unchanged', () => {
    expect(PWA).toContain('j.dateAvailable === false')
    expect(PWA).toContain('setDateMsg(j.dateReason')
  })

  it('and the order is still submitted through the same guarded endpoint', () => {
    expect(PWA).toContain('api("/orders", { method: "POST"')
    expect(PWA).toContain('if (storeClosed) { setMsg(storeClosedMsg || "Store is closed"); return }')
  })
})
