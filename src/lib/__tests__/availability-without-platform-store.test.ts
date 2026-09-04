import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// A MISSING PLATFORM STORE ROW IS NOT A CLOSED SHOP.
//
// Store status, the weekly StoreTiming schedule and the Temporarily Closed
// window (closedReason / closedUntil) all live on the platform `Store` row.
// The laundry ordering guard read that row to answer "is the shop open", and
// when a tenant had no such row it answered "Store is currently unavailable" —
// a provisioning gap reaching the customer as a closure, at every hour of
// every day, in both ordering modes.
//
// Nothing on the ORDER path needed that row. The three guard callers read only
// `ok` and `error`; branch, serviceability and the order's own store come from
// LaundryStore, resolved separately by the order routes.
//
// So the guard now answers from the level that still exists. With no store row
// there is no schedule to be outside of and no closure to be under — the owner
// cannot even declare one, the settings endpoint refuses without a store — and
// what remains is Business.isOnline, which still closes the shop. That is the
// SAME answer checkStoreOpen() already gives a store that exists with no
// StoreTiming rows, so this is the existing hierarchy's bottom rung, not a new
// concept. A business that cannot be identified is still unavailable.
//
// Verified in a real browser against the running app at 13:47 IST Friday.
//
//   TENANT A — Business + 4 LaundryStores, ZERO platform Store rows:
//     24/7 + Open        isOpen=true  status=open   PWA ALLOWED  slots=7
//                        order guard passed (HTTP 400 on a later field,
//                        no longer 409 "Store is currently unavailable")
//     business offline   isOpen=false status=offline PWA BLOCKED
//                        "Store is currently offline"
//
//   TENANT B — has a platform Store; every case byte-identical to before:
//     24/7  inside hours 09:00-21:00   open,   ALLOWED, 7 slots
//     24/7  outside hours 09:00-13:00  open,   ALLOWED, 7 slots
//     24/7  TEMPORARILY CLOSED         closed, BLOCKED, "Stock take"
//     24/7  Open Store again           open,   ALLOWED
//     HOURS outside hours              closed, BLOCKED, "Opens Tomorrow at 09:00"
//     HOURS inside hours               open,   ALLOWED, 6 slots (clipped)
// ============================================================================

const AVAIL = readFileSync(join(process.cwd(), 'src/lib/laundry-availability.ts'), 'utf8')
const SETTINGS = readFileSync(join(process.cwd(), 'src/app/api/laundry/availability/route.ts'), 'utf8')
const ORDER = readFileSync(join(process.cwd(), 'src/app/api/core/storefront/laundry-order/route.ts'), 'utf8')

const fallback = AVAIL.slice(AVAIL.indexOf('async function businessLevelAvailability('), AVAIL.indexOf('export async function getLaundryAvailability('))
const storeOpen = AVAIL.slice(AVAIL.indexOf('export async function assertLaundryStoreOpen('), AVAIL.indexOf('export function assertLaundryDateAvailable('))
const bookingOpen = AVAIL.slice(AVAIL.indexOf('export async function assertLaundryBookingOpen('))

describe('1 · the fallback answers from the level that still exists', () => {
  it('it reads Business.isOnline and nothing else', () => {
    // `settings` joined it later, carrying the owner's closure wording — text
    // that goes WITH the isOnline decision, never one that makes it.
    expect(fallback).toContain('select: { isOnline: true, settings: true }')
    // No schedule and no clock: those live on the store row and do not exist
    // without it. The owner's closure text IS read now — that is the whole of
    // the business-level control — but it is text beside the isOnline decision,
    // not a schedule and not a second state.
    expect(fallback).not.toMatch(/storeTimings|getHours|Date\.now|openTime|closeTime/)
  })

  it('offline still closes the shop', () => {
    // The owner's own wording is preferred when they wrote one; the generic
    // line is the fallback, not the only message.
    expect(fallback).toContain('reason: closedReason || "Store is currently offline"')
    expect(fallback).toContain('isOnline ?? false')   // unreadable business = offline, not open
  })
})

describe('2 · identity is still required', () => {
  it('an unidentifiable business is still "unavailable"', () => {
    expect(storeOpen).toContain('if (!platformBusinessId) return { ok: false, error: "Store is currently unavailable"')
    expect(bookingOpen).toContain('if (!storeId && !platformBusinessId) return { ok: false, error: "Store is currently unavailable" }')
  })

  it('but a missing store row alone no longer produces that message', () => {
    // Each remaining use of the phrase is now guarded by a business check.
    for (const block of [storeOpen, bookingOpen]) {
      const at = block.indexOf('Store is currently unavailable')
      expect(at).toBeGreaterThan(-1)
      expect(block.slice(Math.max(0, at - 120), at)).toContain('platformBusinessId')
    }
  })
})

describe('3 · the date and slot rules are still RUN, and unchanged', () => {
  it('no store row means an empty schedule and no closure — not a skipped check', () => {
    expect(bookingOpen).toContain('const schedule = store?.storeTimings ?? []')
    expect(bookingOpen).toContain('const closedUntil = store?.closedUntil ?? null')
    expect(bookingOpen).toContain('assertLaundryDateAvailable(schedule, c.date, c.label, closedUntil')
    expect(bookingOpen).toContain('laundrySlotsForDate([c.slot], schedule, c.date, closedUntil')
  })

  it('the mode flag still governs both, exactly as before', () => {
    expect(bookingOpen.match(/ignoreWorkingHours: bypassesStoreHours\(ordering\)/g)?.length).toBe(3)
  })

  it('the guard grew no slot, capacity or serviceability logic', () => {
    // Comments are prose; strip them so the word "serviceability" in the note
    // explaining where serviceability DOES live is not read as an import of it.
    const code = bookingOpen.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/deliverySlotCapacity|serviceab|latitude|pincode|generateSlots/i)
  })
})

describe('4 · nothing on the order path needed the platform store row', () => {
  it('the order assigns a LaundryStore, resolved by the route itself', () => {
    expect(ORDER).toContain('prisma.laundryStore.findUnique')
    expect(ORDER).toContain('storeId: store.id')
  })

  it('and the caller reads only ok/error from the guard', () => {
    const call = ORDER.slice(ORDER.indexOf('const guard = await assertLaundryBookingOpen('), ORDER.indexOf('const guard = await assertLaundryBookingOpen(') + 700)
    expect(call).toContain('if (!guard.ok)')
    expect(call).not.toContain('guard.storeId')
  })

  it('so the guard reports null rather than inventing a store id', () => {
    expect(bookingOpen).toContain('return { ok: true, storeId }')
    expect(AVAIL).toContain('Promise<{ ok: true; storeId: string | null } | { ok: false; error: string }>')
  })
})

describe('5 · a store-less tenant CAN now hold a closure, and it is honoured', () => {
  // This described the opposite until the owner-closure gap was closed. The
  // safety argument changed with it: it used to be "no closure can exist to be
  // missed", and is now "the closure exists at business level and every path
  // already honours it". Kept, restated, rather than deleted — the behaviour it
  // guards is the same one, seen from the other side.
  it('the settings endpoint records it instead of refusing', () => {
    const branch = SETTINGS.slice(SETTINGS.indexOf('if (!storeId) {'), SETTINGS.indexOf('const businessIdEff', SETTINGS.indexOf('if (!storeId) {')))
    expect(branch).toContain('isOnline: !closing')
    expect(branch).toContain('writeBusinessClosure(')
  })

  it('and only an owner with no status to set is still refused', () => {
    const branch = SETTINGS.slice(SETTINGS.indexOf('if (!storeId) {'), SETTINGS.indexOf('const businessIdEff', SETTINGS.indexOf('if (!storeId) {')))
    expect(branch).toContain('if (availability.status !== "open" && availability.status !== "closed")')
    expect(branch).toContain('No online store configured for this business')
  })

  it('isOnline is honoured ahead of every clock check, so no mode bypasses it', () => {
    const CORE = readFileSync(join(process.cwd(), 'src/lib/core/store.ts'), 'utf8')
    const fn = CORE.slice(CORE.indexOf('export async function checkStoreOpen('), CORE.indexOf('function _findNextOpenDay('))
    expect(fn.indexOf('!business.isOnline')).toBeLessThan(fn.indexOf('if (!opts.ignoreWorkingHours'))
  })
})

describe('6 · availability reports the business, not a phantom store', () => {
  it('getLaundryAvailability answers open/offline instead of "Store unavailable"', () => {
    const fn = AVAIL.slice(AVAIL.indexOf('export async function getLaundryAvailability('), AVAIL.indexOf('export async function resolveBranchSchedule('))
    expect(fn).toContain('if (!platformBusinessId) return empty')
    expect(fn).toContain('const { isOnline, result, closedReason, closedUntil } = await businessLevelAvailability(platformBusinessId)')
    // A declared closure reports as "closed", the same word a store-level
    // closure reports, so the screens cannot tell the two apart.
    expect(fn).toContain('status: result.isOpen ? "open" : "closed"')
  })
})
