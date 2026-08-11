import { describe, it, expect } from 'vitest'
import {
  STANDARD_TAT_HOURS, effectiveTatHours, hasCustomTat, orderTatHours,
  earliestDeliveryAt, earliestDeliveryDayKey, tatLabel, toHours, fromHours, dayKey,
} from '@/lib/laundry-tat'
import { slotIsPast } from '@/lib/laundry-slots'

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

// ── Why checkout still showed +24h ──────────────────────────────────────────
// The turnaround was read ONLY from a snapshot written onto each cart line. A
// cart already in localStorage, or a line added by a surface that does not pass
// it, carried nothing — and "nothing" resolves to the 24h standard. The live
// service config now wins.
describe('cart turnaround prefers live service config over the line snapshot', () => {
  const EXPRESS_6 = { tatEnabled: true, defaultTurnaroundHours: 6 }
  const line = (serviceId: string, snap?: { tatEnabled?: boolean; turnaroundHours?: number }) =>
    ({ kind: 'laundry' as const, serviceId, ...snap })

  // Reimplements the resolution cartTatHours performs, over plain objects.
  const resolve = (lines: ReturnType<typeof line>[], live?: Map<string, typeof EXPRESS_6>) =>
    orderTatHours(lines.map((l) => live?.get(l.serviceId) ?? {
      tatEnabled: l.tatEnabled, defaultTurnaroundHours: l.turnaroundHours,
    }))

  it('a STALE line with no snapshot still gets 6h from the live service', () => {
    const live = new Map([['svc-express', EXPRESS_6]])
    expect(resolve([line('svc-express')], live)).toBe(6)   // was 24 — the reported bug
  })

  it('without the live map a stale line falls back to standard — the old behaviour', () => {
    expect(resolve([line('svc-express')])).toBe(24)
  })

  it('live config beats a snapshot that has gone out of date', () => {
    const live = new Map([['svc-express', { tatEnabled: true, defaultTurnaroundHours: 12 }]])
    expect(resolve([line('svc-express', { tatEnabled: true, turnaroundHours: 6 })], live)).toBe(12)
  })

  it('a mixed cart still takes the longest — 24h wins over 6h', () => {
    const live = new Map([
      ['svc-standard', { tatEnabled: false, defaultTurnaroundHours: 24 }],
      ['svc-express', EXPRESS_6],
    ])
    expect(resolve([line('svc-standard'), line('svc-express')], live)).toBe(24)
  })

  it('express-only cart takes the longest express — 12h over 6h', () => {
    const live = new Map([
      ['svc-e6', EXPRESS_6],
      ['svc-e12', { tatEnabled: true, defaultTurnaroundHours: 12 }],
    ])
    expect(resolve([line('svc-e6'), line('svc-e12')], live)).toBe(12)
  })

  // The exact production report: pickup 11 Aug, 6h service, was showing 12 Aug.
  it('a 6h service on an 11 Aug pickup is deliverable on 11 Aug, not 12 Aug', () => {
    const live = new Map([['svc-express', EXPRESS_6]])
    const tat = resolve([line('svc-express')], live)
    expect(earliestDeliveryDayKey(new Date('2026-08-11T00:00:00'), [{ tatEnabled: true, defaultTurnaroundHours: tat }])).toBe('2026-08-11')
  })

  it('a standard cart on the same pickup still lands on 12 Aug', () => {
    const live = new Map([['svc-standard', { tatEnabled: false, defaultTurnaroundHours: 24 }]])
    const tat = resolve([line('svc-standard')], live)
    expect(earliestDeliveryDayKey(new Date('2026-08-11T00:00:00'), [{ tatEnabled: true, defaultTurnaroundHours: tat }])).toBe('2026-08-12')
  })
})

// ── The remaining hole: the DATE was constrained, the TIME was not ──────────
// A 6h service on a 10:00 AM pickup allowed 11 Aug, and every slot on 11 Aug
// including 11:00 AM, because the minimum was measured from MIDNIGHT of the
// pickup day and only compared as a date.
describe('earliest permissible delivery is a datetime, from the pickup slot', () => {
  const pickupAt = (day: string, slot: string) => {
    const [hh, mm] = slot.split('-')[0].trim().split(':').map(Number)
    const d = new Date(`${day}T00:00:00`)
    d.setHours(hh, mm, 0, 0)
    return d
  }

  it('6h from a 10:00 AM pickup is 4:00 PM the same day', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 6)
    expect(e).toEqual(new Date('2026-08-11T16:00:00'))
    expect(dayKey(e)).toBe('2026-08-11')
  })

  // Every one of these was selectable before.
  it('blocks the same-day slots that start before 4:00 PM', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 6)
    for (const s of ['09:00-10:00', '11:00-12:00', '12:00-13:00', '14:00-15:00', '15:00-16:00']) {
      expect(slotIsPast(s, '2026-08-11', e)).toBe(true)
    }
  })

  it('allows 4:00 PM and later on the same day', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 6)
    for (const s of ['16:00-17:00', '17:00-18:00', '20:00-21:00']) {
      expect(slotIsPast(s, '2026-08-11', e)).toBe(false)
    }
  })

  it('12h from the same pickup pushes the floor to 10:00 PM', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 12)
    expect(e).toEqual(new Date('2026-08-11T22:00:00'))
    expect(slotIsPast('21:00-22:00', '2026-08-11', e)).toBe(true)
    expect(slotIsPast('22:00-23:00', '2026-08-11', e)).toBe(false)
  })

  it('a standard 24h service still lands on the next day — unchanged', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 24)
    expect(dayKey(e)).toBe('2026-08-12')
    // And no slot on the following day is blocked by the TAT.
    expect(slotIsPast('14:00-15:00', '2026-08-12', e)).toBe(false)
  })

  it('never restricts slots on a LATER date', () => {
    const e = earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), 6)
    for (const s of ['09:00-10:00', '11:00-12:00']) {
      expect(slotIsPast(s, '2026-08-12', e)).toBe(false)
    }
  })

  it('a mixed cart uses the longest, so 24h wins over 6h', () => {
    const tat = orderTatHours([
      { tatEnabled: false, defaultTurnaroundHours: 24 },
      { tatEnabled: true, defaultTurnaroundHours: 6 },
    ])
    expect(tat).toBe(24)
    expect(dayKey(earliestDeliveryAt(pickupAt('2026-08-11', '10:00-12:00'), tat))).toBe('2026-08-12')
  })
})
