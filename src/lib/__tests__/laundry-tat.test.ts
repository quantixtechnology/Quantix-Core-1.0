import { describe, it, expect } from 'vitest'
import {
  STANDARD_TAT_HOURS, effectiveTatHours, hasCustomTat, orderTatHours,
  earliestDeliveryAt, earliestDeliveryDayKey, tatLabel, toHours, fromHours, dayKey,
} from '@/lib/laundry-tat'

const STANDARD   = { name: 'Wash & Fold',         defaultTurnaroundHours: 24, tatEnabled: false }
const DRYCLEAN   = { name: 'Dry Cleaning',        defaultTurnaroundHours: 48, tatEnabled: false }
const EXPRESS_WF = { name: 'Express Wash & Fold', defaultTurnaroundHours: 12, tatEnabled: true, tatUnit: 'HOURS' }
const EXPRESS_WI = { name: 'Express Wash & Iron', defaultTurnaroundHours: 6,  tatEnabled: true, tatUnit: 'HOURS' }

// The brief's acceptance tests, run for real.
describe('acceptance tests from the specification', () => {
  const at10am = new Date('2026-08-11T10:00:00')

  it('TEST 1 — a standard service uses the standard turnaround', () => {
    expect(effectiveTatHours(STANDARD)).toBe(24)
    expect(hasCustomTat(STANDARD)).toBe(false)
  })

  it('TEST 2 — Express Wash & Fold starts from order time + 12h', () => {
    expect(effectiveTatHours(EXPRESS_WF)).toBe(12)
    expect(earliestDeliveryAt(at10am, orderTatHours([EXPRESS_WF]))).toEqual(new Date('2026-08-11T22:00:00'))
  })

  it('TEST 3 — Express Wash & Iron ordered at 10:00 AM is eligible at 4:00 PM', () => {
    const eligible = earliestDeliveryAt(at10am, orderTatHours([EXPRESS_WI]))
    expect(eligible).toEqual(new Date('2026-08-11T16:00:00'))
    expect(eligible.getHours()).toBe(16)
  })

  it('TEST 4 — a mixed cart takes the LONGEST turnaround, never the express one', () => {
    expect(orderTatHours([STANDARD, EXPRESS_WI])).toBe(24)
  })

  it('TEST 5 — an express-only cart takes the longest express turnaround', () => {
    expect(orderTatHours([EXPRESS_WF, EXPRESS_WI])).toBe(12)
  })

  it('TEST 7 — a service with TAT disabled is indistinguishable from today', () => {
    for (const s of [STANDARD, DRYCLEAN, { defaultTurnaroundHours: 72, tatEnabled: false }]) {
      expect(effectiveTatHours(s)).toBe(STANDARD_TAT_HOURS)
    }
  })
})

describe('standard services must not change', () => {
  // The decisive one: a service that never opted in contributes the standard,
  // even if someone edited its hours in the master years ago.
  it('ignores a stored hour value while TAT is off', () => {
    expect(effectiveTatHours({ defaultTurnaroundHours: 6, tatEnabled: false })).toBe(24)
  })

  it('treats missing/legacy rows as standard', () => {
    expect(effectiveTatHours(undefined)).toBe(24)
    expect(effectiveTatHours(null)).toBe(24)
    expect(effectiveTatHours({})).toBe(24)
  })

  it('an all-standard cart is exactly the standard', () => {
    expect(orderTatHours([STANDARD, STANDARD, DRYCLEAN])).toBe(24)
  })

  it('an empty cart is the standard, not zero', () => {
    expect(orderTatHours([])).toBe(24)
  })

  // Enabled but misconfigured must never produce an impossible promise.
  it('falls back to standard when enabled with no usable value', () => {
    expect(effectiveTatHours({ tatEnabled: true, defaultTurnaroundHours: 0 })).toBe(24)
    expect(effectiveTatHours({ tatEnabled: true, defaultTurnaroundHours: null })).toBe(24)
    expect(effectiveTatHours({ tatEnabled: true, defaultTurnaroundHours: -5 })).toBe(24)
  })
})

describe('express can be slower than standard, and that is respected', () => {
  it('a 48h custom TAT lengthens the order rather than shortening it', () => {
    const slow = { defaultTurnaroundHours: 48, tatEnabled: true }
    expect(orderTatHours([STANDARD, slow])).toBe(48)
  })
})

describe('earliest delivery date', () => {
  it('rolls into the next day when the turnaround crosses midnight', () => {
    expect(earliestDeliveryDayKey(new Date('2026-08-11T20:00:00'), [EXPRESS_WI])).toBe('2026-08-12')
  })

  it('stays on the same day when it does not', () => {
    expect(earliestDeliveryDayKey(new Date('2026-08-11T08:00:00'), [EXPRESS_WI])).toBe('2026-08-11')
  })

  it('a standard cart lands on the day after — todays behaviour', () => {
    expect(earliestDeliveryDayKey(new Date('2026-08-11T10:00:00'), [STANDARD])).toBe('2026-08-12')
  })

  it('uses local time, so a late-evening order does not report the wrong day', () => {
    expect(dayKey(new Date('2026-08-11T23:30:00'))).toBe('2026-08-11')
  })
})

describe('customer-facing label', () => {
  it('reads in hours or days as configured', () => {
    expect(tatLabel(12, 'HOURS')).toBe('12-hour delivery')
    expect(tatLabel(6, 'HOURS')).toBe('6-hour delivery')
    expect(tatLabel(48, 'DAYS')).toBe('2-day delivery')
  })

  it('says days when hours divide evenly and no unit was stored', () => {
    expect(tatLabel(24)).toBe('1-day delivery')
    expect(tatLabel(30)).toBe('30-hour delivery')
  })
})

describe('unit conversion round-trips what the owner typed', () => {
  it('days become hours for storage', () => {
    expect(toHours(1, 'DAYS')).toBe(24)
    expect(toHours(12, 'HOURS')).toBe(12)
  })

  it('and come back in the same unit for editing', () => {
    expect(fromHours(24, 'DAYS')).toEqual({ value: 1, unit: 'DAYS' })
    expect(fromHours(12, 'HOURS')).toEqual({ value: 12, unit: 'HOURS' })
    expect(fromHours(6)).toEqual({ value: 6, unit: 'HOURS' })
  })

  it('never stores a zero or negative turnaround', () => {
    expect(toHours(0, 'HOURS')).toBe(1)
    expect(toHours(-3, 'DAYS')).toBe(24)
  })
})
