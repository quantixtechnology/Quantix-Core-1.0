import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================================
// Tests for LAUNDRY STORE AVAILABILITY + WORKING HOURS.
//
// The Laundry workspace reuses the Commerce platform Store/StoreTiming
// availability machinery (single source of truth). These tests pin the derived
// helpers: IST weekday mapping, per-date business hours, weekly-off / holiday /
// past-date availability, slot filtering to working hours, and the server-side
// booking guard used by the storefront checkout + customer app.
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    store: { findFirst: vi.fn(), findUnique: vi.fn() },
    business: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/laundry-business', () => ({
  resolveLaundryBusiness: vi.fn(async () => ({ id: 'lb1', platformBusinessId: 'pb1' })),
}))

vi.mock('@/lib/db', () => ({
  db: { store: { findUnique: vi.fn() }, business: { findUnique: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { db } from '@/lib/db'
import { istWeekday, timingForDate, slotsWithinWorkingHours, formatTimeLabel, formatReopenAt } from '@/lib/core/store'
import { isLaundryDateAvailable, laundrySlotsForDate, assertLaundryDateAvailable, assertLaundryBookingOpen, getLaundryAvailability } from '../laundry-availability'
import { generateSlots } from '@/lib/laundry-slots'
import type { StoreDayTiming } from '@/lib/core/store'

const mockPrismaStoreFindFirst = prisma.store.findFirst as ReturnType<typeof vi.fn>
const mockPrismaStoreFindUnique = prisma.store.findUnique as ReturnType<typeof vi.fn>
const mockPrismaBusinessFindUnique = prisma.business.findUnique as ReturnType<typeof vi.fn>
const mockDbStoreFindUnique = db.store.findUnique as ReturnType<typeof vi.fn>
const mockDbBusinessFindUnique = db.business.findUnique as ReturnType<typeof vi.fn>

// All days 00:00–23:59 → "open" regardless of when the test runs (IST-safe).
const OPEN_TIMINGS: StoreDayTiming[] = Array.from({ length: 7 }, (_, day) => ({ day, openTime: '00:00', closeTime: '23:59', isClosed: false }))
// Days 0–5 (Sun–Fri) 10:00–20:00, Saturday (6) weekly off. Used for the PURE
// date helpers only — the server guard's store-open check runs first, so it
// never sees these (today is Saturday in the fixture world).
const SATURDAY_OFF: StoreDayTiming[] = [
  ...Array.from({ length: 6 }, (_, day) => ({ day, openTime: '10:00', closeTime: '20:00', isClosed: false })),
  { day: 6, openTime: '10:00', closeTime: '20:00', isClosed: true },
]
// Guard fixtures: today (Wednesday, day 3) is always open 00:00–23:59 so the
// store-open check passes deterministically, while a specific future day is
// closed / has limited hours to exercise the date-based checks.
const SUNDAY_OFF: StoreDayTiming[] = [
  { day: 0, openTime: '10:00', closeTime: '20:00', isClosed: true },
  ...Array.from({ length: 6 }, (_, day) => ({ day: day + 1, openTime: '00:00', closeTime: '23:59', isClosed: false })),
]
const TUESDAY_HOURS: StoreDayTiming[] = Array.from({ length: 7 }, (_, day) => ({
  day, openTime: day === 2 ? '10:00' : '00:00', closeTime: day === 2 ? '20:00' : '23:59', isClosed: false,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── IST weekday mapping ────────────────────────────────────────────────────

describe('istWeekday', () => {
  it('maps calendar dates to IST weekday (0=Sun … 6=Sat)', () => {
    expect(istWeekday('2026-08-01')).toBe(6) // Saturday
    expect(istWeekday('2026-08-02')).toBe(0) // Sunday
    expect(istWeekday('2026-08-03')).toBe(1) // Monday
    expect(istWeekday('2026-08-07')).toBe(5) // Friday
  })

  it('shifts live timestamps to IST before reading the weekday', () => {
    // 2026-08-02 23:00 UTC = 2026-08-03 04:30 IST (Monday).
    expect(istWeekday(new Date('2026-08-02T23:00:00.000Z'))).toBe(1)
  })

  it('returns -1 for invalid dates', () => {
    expect(istWeekday('garbage')).toBe(-1)
    expect(istWeekday(new Date('nope'))).toBe(-1)
  })
})

// ── Time labels ────────────────────────────────────────────────────────────

describe('formatTimeLabel', () => {
  it('formats 24h → 12h AM/PM labels', () => {
    expect(formatTimeLabel('09:00')).toBe('9:00 AM')
    expect(formatTimeLabel('21:00')).toBe('9:00 PM')
    expect(formatTimeLabel('12:00')).toBe('12:00 PM')
    expect(formatTimeLabel('00:30')).toBe('12:30 AM')
    expect(formatTimeLabel('13:05')).toBe('1:05 PM')
  })
})

describe('formatReopenAt', () => {
  it('formats a re-open moment in IST', () => {
    // 04:30 UTC = 10:00 IST the same day.
    expect(formatReopenAt('2026-08-02T04:30:00.000Z')).toBe('2 Aug 2026, 10:00 AM')
  })
})

// ── Per-date business hours ────────────────────────────────────────────────

describe('timingForDate', () => {
  it('returns working hours for an open day', () => {
    const r = timingForDate(SATURDAY_OFF, '2026-08-03') // Monday
    expect(r.available).toBe(true)
    expect(r.openTime).toBe('10:00')
    expect(r.closeTime).toBe('20:00')
    expect(r.isClosed).toBe(false)
  })

  it('marks a weekly off-day unavailable', () => {
    const r = timingForDate(SATURDAY_OFF, '2026-08-01') // Saturday
    expect(r.available).toBe(false)
    expect(r.reason).toBe('Closed on Saturday')
  })

  it('marks a holiday-covered day unavailable', () => {
    const r = timingForDate(SATURDAY_OFF, '2026-08-02', new Date('2026-08-05T00:00:00.000Z'))
    expect(r.available).toBe(false)
    expect(r.reason).toBe('Closed for a holiday')
  })

  it('ignores a past closedUntil (auto-reopened)', () => {
    const r = timingForDate(SATURDAY_OFF, '2026-08-02', new Date('2026-08-01T00:00:00.000Z'))
    expect(r.available).toBe(true)
  })

  it('rejects invalid dates', () => {
    expect(timingForDate(SATURDAY_OFF, 'bad-date').available).toBe(false)
  })
})

// ── Date availability ──────────────────────────────────────────────────────

describe('isLaundryDateAvailable', () => {
  it('never offers a past date', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-07-31')
    expect(a.available).toBe(false)
    expect(a.reason).toContain('past')
  })

  it('blocks weekly off-days', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-29') // future Saturday
    expect(a.available).toBe(false)
    expect(a.reason).toContain('Saturday')
  })

  it('blocks temporary-closure dates', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-31', new Date('2026-09-01T00:00:00.000Z'))
    expect(a.available).toBe(false)
    expect(a.reason).toContain('holiday')
  })

  it('returns working hours for an available day', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-31')
    expect(a.available).toBe(true)
    expect(a.openTime).toBe('10:00')
    expect(a.closeTime).toBe('20:00')
  })

  it('requires a date', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, null)
    expect(a.available).toBe(false)
    expect(a.reason).toBe('Select a date')
  })

  describe('ignoreWorkingHours (24/7 ordering)', () => {
    // REVERSED: the weekly schedule decides which SLOTS a date has, never
    // whether the customer may order for it. laundrySlotsForDate() returns []
    // for this same date, which is what keeps pickups on the schedule.
    it('does not let a weekly off-day close ORDERING', () => {
      const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-29', undefined, { ignoreWorkingHours: true })
      expect(a.available).toBe(true)
      expect(a.reason).toBeNull()
      expect(laundrySlotsForDate(['10:00 - 12:00'], SATURDAY_OFF, '2026-08-29')).toEqual([])
    })

    it('still rejects past dates even with ignoreWorkingHours', () => {
      const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-07-31', undefined, { ignoreWorkingHours: true })
      expect(a.available).toBe(false)
      expect(a.reason).toContain('past')
    })

    it('still rejects invalid dates with ignoreWorkingHours', () => {
      const a = isLaundryDateAvailable(SATURDAY_OFF, 'bad-date', undefined, { ignoreWorkingHours: true })
      expect(a.available).toBe(false)
    })

    it('still rejects temporary closures even with ignoreWorkingHours', () => {
      const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-31', new Date('2026-09-01T00:00:00.000Z'), { ignoreWorkingHours: true })
      expect(a.available).toBe(false)
      expect(a.reason).toContain('holiday')
    })
  })
})

// ── Slot filtering to working hours ────────────────────────────────────────

describe('slotsWithinWorkingHours', () => {
  it('keeps only slots fully inside the working window', () => {
    const slots = ['07:00 - 09:00', '09:00 - 11:00', '10:00 - 12:00', '18:00 - 20:00', '19:00 - 21:00']
    expect(slotsWithinWorkingHours(slots, '10:00', '20:00')).toEqual(['10:00 - 12:00', '18:00 - 20:00'])
  })

  it('returns slots unchanged when hours are missing', () => {
    expect(slotsWithinWorkingHours(['07:00 - 09:00'], undefined, undefined)).toEqual(['07:00 - 09:00'])
  })
})

describe('laundrySlotsForDate', () => {
  it('intersects generated slots with the chosen day hours', () => {
    const slots = ['07:00 - 09:00', '09:00 - 11:00', '10:00 - 12:00', '18:00 - 20:00', '19:00 - 21:00']
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-31')).toEqual(['10:00 - 12:00', '18:00 - 20:00'])
  })

  it('returns [] on a weekly off / unavailable date', () => {
    const slots = ['07:00 - 09:00', '10:00 - 12:00']
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-29')).toEqual([])
  })

  it('returns slots unchanged when no date is given', () => {
    const slots = ['07:00 - 09:00']
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, null)).toEqual(slots)
  })

  describe('slots always follow working hours', () => {
    it('returns [] on an off-day regardless of ordering mode', () => {
      const slots = ['07:00 - 09:00', '10:00 - 12:00', '18:00 - 20:00']
      // Even with ignoreWorkingHours, off-day returns no slots — the
      // customer ordering mode only relaxes "is the store open right now".
      expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-29')).toEqual([])
    })

    it('filters to working hours on an available day', () => {
      const slots = ['07:00 - 09:00', '10:00 - 12:00']
      expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-31')).toEqual(['10:00 - 12:00'])
    })
  })
})

// ── assertLaundryDateAvailable (pure) ──────────────────────────────────────

describe('assertLaundryDateAvailable', () => {
  it('accepts an available date', () => {
    expect(assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-31', 'Pickup')).toEqual({ ok: true })
  })

  it('rejects an unavailable date with a label-prefixed message', () => {
    const r = assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-29', 'Pickup') // future Saturday
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Pickup')
    expect(r.error).toContain('Saturday')
  })

  describe('ignoreWorkingHours (24/7 ordering)', () => {
    it('does not let a weekly off-day close ORDERING', () => {
      const r = assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-29', 'Pickup', undefined, { ignoreWorkingHours: true })
      expect(r.ok).toBe(true)
    })

    it('still rejects a temporary closure — 24/7 relaxes the schedule, not a decision to shut', () => {
      const r = assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-31', 'Pickup', new Date('2026-09-05T00:00:00.000Z'), { ignoreWorkingHours: true })
      expect(r.ok).toBe(false)
    })
  })
})

// ── getLaundryAvailability (store status payload) ──────────────────────────

function setupOpenStore() {
  mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
  mockPrismaStoreFindUnique.mockResolvedValue({ closedReason: null, closedUntil: null, storeTimings: OPEN_TIMINGS })
  mockPrismaBusinessFindUnique.mockResolvedValue({ isOnline: true })
  mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: OPEN_TIMINGS })
  mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
}

describe('getLaundryAvailability', () => {
  it('reports an open store with timings and business hours', async () => {
    setupOpenStore()
    const a = await getLaundryAvailability('lb1')
    expect(a.storeId).toBe('s1')
    expect(a.isOpen).toBe(true)
    expect(a.status).toBe('open')
    expect(a.timings).toHaveLength(7)
  })

  it('reports temporary closure with reason + re-open time', async () => {
    setupOpenStore()
    mockPrismaStoreFindUnique.mockResolvedValue({ closedReason: 'Annual inventory', closedUntil: new Date('2026-09-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: 'Annual inventory', closedUntil: new Date('2026-09-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    const a = await getLaundryAvailability('lb1')
    expect(a.isOpen).toBe(false)
    expect(a.status).toBe('closed')
    expect(a.closedReason).toBe('Annual inventory')
    expect(a.opensAt).toContain('Sep 2026')
  })

  it('reports offline when the platform business is offline', async () => {
    setupOpenStore()
    mockPrismaBusinessFindUnique.mockResolvedValue({ isOnline: false })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: false })
    const a = await getLaundryAvailability('lb1')
    expect(a.isOpen).toBe(false)
    expect(a.status).toBe('offline')
  })
})

// ── Server-side booking guard (assertLaundryBookingOpen) ───────────────────

describe('assertLaundryBookingOpen', () => {
  it('accepts a booking when the store is open and the date is within hours', async () => {
    setupOpenStore()
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-31', pickupSlot: '10:00 - 12:00' })
    expect(r.ok).toBe(true)
  })

  it('rejects when the store is temporarily closed', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: 'Annual inventory', closedUntil: new Date('2026-09-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-09-03' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Annual inventory')
  })

  it('rejects a weekly off pickup date', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: SUNDAY_OFF })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: SUNDAY_OFF })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-30' }) // Sunday off
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Pickup is unavailable')
    expect(r.error).toContain('Sunday')
  })

  it('rejects a slot that falls outside the day working hours', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: TUESDAY_HOURS })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: TUESDAY_HOURS })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-09-01', pickupSlot: '07:00 - 09:00' }) // Tuesday 10–20
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('outside business hours')
  })

  it('rejects a temporary-closure holiday delivery date', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: OPEN_TIMINGS })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: new Date('2026-09-02T00:00:00.000Z'), storeTimings: OPEN_TIMINGS })
    // Pickup after the holiday passes; Standard delivery during it is rejected.
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-09-03', deliveryDate: '2026-09-01' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Standard delivery is unavailable')
  })

  it('accepts a booking with no dates (app auto-picks later)', async () => {
    setupOpenStore()
    const r = await assertLaundryBookingOpen('lb1', {})
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected acceptance')
    expect(r.storeId).toBe('s1')
  })

  // REVERSED, deliberately. A weekly off-day used to reject the ORDER outright
  // under 24/7 ordering, which is what put "Closed on Sunday" in front of a
  // customer who was only picking a date. The schedule is now enforced on the
  // SLOT (see the next test), so the date alone never closes ordering.
  it('accepts a weekly off pickup DATE when 24/7 ordering is enabled', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: SUNDAY_OFF })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: SUNDAY_OFF })
    mockPrismaBusinessFindUnique.mockResolvedValue({ settings: JSON.stringify({ customerOrderingAvailability: 'ALWAYS_OPEN' }) })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-30' }) // Sunday off
    expect(r.ok).toBe(true)
  })

  it('still rejects a SLOT on a weekly off-day when 24/7 ordering is enabled', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: SUNDAY_OFF })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: SUNDAY_OFF })
    mockPrismaBusinessFindUnique.mockResolvedValue({ settings: JSON.stringify({ customerOrderingAvailability: 'ALWAYS_OPEN' }) })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-30', pickupSlot: '10:00 - 12:00' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('outside business hours on 2026-08-30')
  })

  it('still rejects a weekly off pickup date when 24/7 ordering is disabled', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: SUNDAY_OFF })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true }) // no settings → FOLLOW_STORE_HOURS
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: SUNDAY_OFF })
    mockPrismaBusinessFindUnique.mockResolvedValue({}) // no settings → FOLLOW_STORE_HOURS
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-30' }) // Sunday off
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Pickup is unavailable')
    expect(r.error).toContain('Sunday')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER ORDERING AVAILABILITY vs PICKUP/DELIVERY SLOT AVAILABILITY
//
// Two separate questions, and the bug was answering the first with the second:
//
//   "May the customer place an order right now?"   → Customer Ordering mode
//   "Which pickup/delivery slots exist on a date?" → the operational schedule
//
// 24/7 ordering moves ONLY the first. The schedule keeps deciding the second,
// in every mode — so a 2 AM order is accepted and still has to take a slot the
// shop can actually work.
// ═══════════════════════════════════════════════════════════════════════════

// Store open 9 AM – 9 PM every day.
const NINE_TO_NINE: StoreDayTiming[] = Array.from({ length: 7 }, (_, day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }))
// Same, but Sunday (0) is the weekly off-day.
const NINE_TO_NINE_SUNDAY_OFF: StoreDayTiming[] = NINE_TO_NINE.map((t) => (t.day === 0 ? { ...t, isClosed: true } : t))

const ALWAYS_OPEN_SETTINGS = JSON.stringify({ customerOrderingAvailability: 'ALWAYS_OPEN' })

function setupStore(timings: StoreDayTiming[], settings: string | null) {
  mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
  mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: timings })
  mockPrismaBusinessFindUnique.mockResolvedValue(settings ? { isOnline: true, settings } : { isOnline: true })
  mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: timings })
  mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
}

// IST = UTC + 5:30, and the store clock is read in IST.
// 2026-09-02 is a Wednesday; 2026-08-30 is a Sunday.
const IST = {
  wed10am: new Date('2026-09-02T04:30:00.000Z'),
  wed10pm: new Date('2026-09-02T16:30:00.000Z'),
  wed2am:  new Date('2026-09-01T20:30:00.000Z'),
  sun10am: new Date('2026-08-30T04:30:00.000Z'),
}

describe('customer ordering availability — the store-open gate', () => {
  // Only Date is faked: the prisma mocks resolve through real microtasks.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  // ── Case 1: 9 AM–9 PM, normal ordering ───────────────────────────────────
  it('FOLLOW_STORE_HOURS: allows an order at 10 AM', async () => {
    vi.setSystemTime(IST.wed10am)
    setupStore(NINE_TO_NINE, null)
    expect((await assertLaundryBookingOpen('lb1', {})).ok).toBe(true)
  })

  it('FOLLOW_STORE_HOURS: blocks an order at 10 PM', async () => {
    vi.setSystemTime(IST.wed10pm)
    setupStore(NINE_TO_NINE, null)
    const r = await assertLaundryBookingOpen('lb1', {})
    expect(r.ok).toBe(false)
  })

  // ── Case 2: 9 AM–9 PM, 24/7 ordering ─────────────────────────────────────
  it('ALWAYS_OPEN: allows an order at 2 AM', async () => {
    vi.setSystemTime(IST.wed2am)
    setupStore(NINE_TO_NINE, ALWAYS_OPEN_SETTINGS)
    expect((await assertLaundryBookingOpen('lb1', {})).ok).toBe(true)
  })

  it('ALWAYS_OPEN: allows an order placed on a weekly off-day', async () => {
    vi.setSystemTime(IST.sun10am)
    setupStore(NINE_TO_NINE_SUNDAY_OFF, ALWAYS_OPEN_SETTINGS)
    expect((await assertLaundryBookingOpen('lb1', {})).ok).toBe(true)
  })

  it('FOLLOW_STORE_HOURS: still blocks an order placed on a weekly off-day', async () => {
    vi.setSystemTime(IST.sun10am)
    setupStore(NINE_TO_NINE_SUNDAY_OFF, null)
    expect((await assertLaundryBookingOpen('lb1', {})).ok).toBe(false)
  })

  // ── Case 4: picking a date must not close the STORE ──────────────────────
  it('ALWAYS_OPEN: choosing an off-day pickup date does not make the store unavailable', async () => {
    vi.setSystemTime(IST.wed2am)
    setupStore(NINE_TO_NINE_SUNDAY_OFF, ALWAYS_OPEN_SETTINGS)
    // Store itself still reports open…
    expect((await getLaundryAvailability('lb1')).isOpen).toBe(true)
    // …and the booking guard does not answer with a store/closure error.
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-09-06' }) // Sunday
    expect(r.ok).toBe(true)
  })

  it('ALWAYS_OPEN: no error mentions the store being closed/unavailable for an off-day date', async () => {
    vi.setSystemTime(IST.wed2am)
    setupStore(NINE_TO_NINE_SUNDAY_OFF, ALWAYS_OPEN_SETTINGS)
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-09-06', pickupSlot: '10:00 - 12:00' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    // Rejected as a SLOT problem, never as "Store is currently unavailable"
    // or "Closed on Sunday".
    expect(r.error).toContain('outside business hours on 2026-09-06')
    expect(r.error).not.toMatch(/store/i)
    expect(r.error).not.toMatch(/closed on/i)
  })
})

describe('customer ordering availability — pickup/delivery slots stay on the schedule', () => {
  // Case 3: 24/7 ordering + a 2 PM–11 PM pickup schedule.
  const PICKUP_2PM_11PM = generateSlots({ start: '14:00', end: '23:00', durationMin: 60 })
  // Store hours wide enough not to clip the pickup window (clipping is existing
  // behaviour and is exercised by the slotsWithinWorkingHours tests above).
  const OPEN_ALL_DAY_SUNDAY_OFF: StoreDayTiming[] = [
    { day: 0, openTime: '00:00', closeTime: '23:59', isClosed: true },
    ...Array.from({ length: 6 }, (_, i) => ({ day: i + 1, openTime: '00:00', closeTime: '23:59', isClosed: false })),
  ]

  it('generates the configured 2 PM–11 PM pickup window', () => {
    expect(PICKUP_2PM_11PM[0]).toBe('14:00 - 15:00')
    expect(PICKUP_2PM_11PM[PICKUP_2PM_11PM.length - 1]).toBe('22:00 - 23:00')
  })

  it('slots on a working day are the schedule, unchanged by the ordering mode', () => {
    // laundrySlotsForDate takes no ordering mode at all — that is the point.
    // 24/7 ordering cannot reach this function, so it cannot widen the window.
    const slots = laundrySlotsForDate(PICKUP_2PM_11PM, OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-02') // Wednesday
    expect(slots).toEqual(PICKUP_2PM_11PM)
    expect(slots.every((s) => s >= '14:00' && s <= '23:00')).toBe(true)
  })

  // ── Case 5: a date with no slots is not a closed STORE ────────────────────
  it('a weekly off-day yields no slots but does NOT report the store closed (24/7)', () => {
    const slots = laundrySlotsForDate(PICKUP_2PM_11PM, OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-06') // Sunday
    expect(slots).toEqual([])

    const date = isLaundryDateAvailable(OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-06', null, { ignoreWorkingHours: true })
    expect(date.available).toBe(true)
    expect(date.reason).toBeNull()
  })

  it('a weekly off-day still reports its reason under FOLLOW_STORE_HOURS', () => {
    const date = isLaundryDateAvailable(OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-06', null)
    expect(date.available).toBe(false)
    expect(date.reason).toBe('Closed on Sunday')
  })

  it('a past date is rejected in BOTH modes — 24/7 never resurrects one', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-02T04:30:00.000Z'))
    for (const opts of [undefined, { ignoreWorkingHours: true }]) {
      const r = isLaundryDateAvailable(OPEN_ALL_DAY_SUNDAY_OFF, '2026-08-01', null, opts)
      expect(r.available).toBe(false)
      expect(r.reason).toBe('This date is in the past')
    }
    vi.useRealTimers()
  })

  // A declared closure is a decision not to trade, so unlike the weekly
  // schedule it still closes the date in BOTH modes.
  it('a holiday closure yields no slots and still closes the date in both modes', () => {
    const holiday = new Date('2026-09-10T00:00:00.000Z')
    expect(laundrySlotsForDate(PICKUP_2PM_11PM, OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-08', holiday)).toEqual([])
    for (const opts of [undefined, { ignoreWorkingHours: true }]) {
      const r = isLaundryDateAvailable(OPEN_ALL_DAY_SUNDAY_OFF, '2026-09-08', holiday, opts)
      expect(r.available).toBe(false)
      expect(r.reason).toBe('Closed for a holiday')
    }
  })
})

// ── A day set to 24 hours in Working Hours ─────────────────────────────────
// The settings form writes 00:00–23:59 for a "24h" day. That is an ordinary
// working window, so nothing downstream needs a special case — these pin that
// it really does behave as a full day.
describe('24-hour working day (00:00–23:59)', () => {
  const FULL_DAY: StoreDayTiming[] = Array.from({ length: 7 }, (_, day) => ({ day, openTime: '00:00', closeTime: '23:59', isClosed: false }))

  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('clips nothing off the configured pickup window', () => {
    const slots = generateSlots({ start: '14:00', end: '23:00', durationMin: 60 })
    expect(laundrySlotsForDate(slots, FULL_DAY, '2026-09-02')).toEqual(slots)
  })

  it('keeps the earliest and latest slots of an all-day pickup window', () => {
    const slots = generateSlots({ start: '00:00', end: '23:00', durationMin: 60 })
    const kept = laundrySlotsForDate(slots, FULL_DAY, '2026-09-02')
    expect(kept[0]).toBe('00:00 - 01:00')
    expect(kept[kept.length - 1]).toBe('22:00 - 23:00')
  })

  it('reads as open at 2 AM without needing 24/7 ordering', async () => {
    vi.setSystemTime(new Date('2026-09-01T20:30:00.000Z')) // 02:00 IST
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: FULL_DAY })
    mockPrismaBusinessFindUnique.mockResolvedValue({ isOnline: true }) // FOLLOW_STORE_HOURS
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: FULL_DAY })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    expect((await assertLaundryBookingOpen('lb1', {})).ok).toBe(true)
  })

  it('a single 24-hour day does not open the others', () => {
    const wedOnly: StoreDayTiming[] = FULL_DAY.map((t) => (t.day === 3 ? t : { ...t, openTime: '09:00', closeTime: '21:00' }))
    const late = ['22:00 - 23:00']
    expect(laundrySlotsForDate(late, wedOnly, '2026-09-02')).toEqual(late) // Wednesday — 24h
    expect(laundrySlotsForDate(late, wedOnly, '2026-09-03')).toEqual([])   // Thursday — 9–9
  })
})
