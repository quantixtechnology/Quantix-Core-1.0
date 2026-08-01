import { describe, it, expect, vi, beforeEach } from 'vitest'

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
// Guard fixtures: today (Saturday, day 6) is always open 00:00–23:59 so the
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
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-01')
    expect(a.available).toBe(false)
    expect(a.reason).toContain('Saturday')
  })

  it('blocks temporary-closure dates', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-03', new Date('2026-08-04T00:00:00.000Z'))
    expect(a.available).toBe(false)
    expect(a.reason).toContain('holiday')
  })

  it('returns working hours for an available day', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, '2026-08-03')
    expect(a.available).toBe(true)
    expect(a.openTime).toBe('10:00')
    expect(a.closeTime).toBe('20:00')
  })

  it('requires a date', () => {
    const a = isLaundryDateAvailable(SATURDAY_OFF, null)
    expect(a.available).toBe(false)
    expect(a.reason).toBe('Select a date')
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
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-03')).toEqual(['10:00 - 12:00', '18:00 - 20:00'])
  })

  it('returns [] on a weekly off / unavailable date', () => {
    const slots = ['07:00 - 09:00', '10:00 - 12:00']
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, '2026-08-01')).toEqual([])
  })

  it('returns slots unchanged when no date is given', () => {
    const slots = ['07:00 - 09:00']
    expect(laundrySlotsForDate(slots, SATURDAY_OFF, null)).toEqual(slots)
  })
})

// ── assertLaundryDateAvailable (pure) ──────────────────────────────────────

describe('assertLaundryDateAvailable', () => {
  it('accepts an available date', () => {
    expect(assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-03', 'Pickup')).toEqual({ ok: true })
  })

  it('rejects an unavailable date with a label-prefixed message', () => {
    const r = assertLaundryDateAvailable(SATURDAY_OFF, '2026-08-01', 'Pickup')
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Pickup')
    expect(r.error).toContain('Saturday')
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
    mockPrismaStoreFindUnique.mockResolvedValue({ closedReason: 'Annual inventory', closedUntil: new Date('2026-08-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: 'Annual inventory', closedUntil: new Date('2026-08-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    const a = await getLaundryAvailability('lb1')
    expect(a.isOpen).toBe(false)
    expect(a.status).toBe('closed')
    expect(a.closedReason).toBe('Annual inventory')
    expect(a.opensAt).toContain('Aug 2026')
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
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-03', pickupSlot: '10:00 - 12:00' })
    expect(r.ok).toBe(true)
  })

  it('rejects when the store is temporarily closed', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: 'Annual inventory', closedUntil: new Date('2026-08-05T18:30:00.000Z'), storeTimings: OPEN_TIMINGS })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-03' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('Annual inventory')
  })

  it('rejects a weekly off pickup date', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: SUNDAY_OFF })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: null, storeTimings: SUNDAY_OFF })
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-02' }) // Sunday off
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
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-04', pickupSlot: '07:00 - 09:00' }) // Tuesday 10–20
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected rejection')
    expect(r.error).toContain('outside business hours')
  })

  it('rejects a temporary-closure holiday delivery date', async () => {
    mockPrismaStoreFindFirst.mockResolvedValue({ id: 's1' })
    mockDbStoreFindUnique.mockResolvedValue({ id: 's1', status: 'ACTIVE', businessId: 'pb1', closedReason: null, closedUntil: null, storeTimings: OPEN_TIMINGS })
    mockDbBusinessFindUnique.mockResolvedValue({ isOnline: true })
    mockPrismaStoreFindUnique.mockResolvedValue({ closedUntil: new Date('2026-08-05T00:00:00.000Z'), storeTimings: OPEN_TIMINGS })
    // Pickup after the holiday passes; Standard delivery during it is rejected.
    const r = await assertLaundryBookingOpen('lb1', { pickupDate: '2026-08-06', deliveryDate: '2026-08-04' })
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
})
