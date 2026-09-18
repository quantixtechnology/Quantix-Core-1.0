import { describe, it, expect } from 'vitest'
import {
  BASE_SLOT_KEY,
  slotDatesToFetch,
  slotListFor,
  slotPlaceholder,
  reconcileSlotSelection,
  type SlotDayMap,
} from '@/lib/laundry-slot-picker'
import { generateSlots, slotConfigsFrom, slotHasEnded, slotIsPast } from '@/lib/laundry-slots'

// ============================================================================
// "No delivery slots available for this date" on a 24/7 business.
//
// Two independent defects produced that message for a date that had slots:
//
//  A. The storefront asked the slots endpoint ONCE, without a date, and pointed
//     BOTH delivery dropdowns at that single answer for the whole session. The
//     message was therefore never about the date; it was about whether one
//     request at mount had succeeded — and because its failure was swallowed
//     and never retried, one bad response emptied delivery permanently while
//     pickup recovered on the next date change.
//
//  B. A window ending at midnight — 00:00 → 00:00, how a business that never
//     closes writes it — read as `end <= start` and generated ZERO slots, in
//     every picker on the platform.
//
// Both are pinned here against the real functions, not against source text.
// ============================================================================

const day = (over: Partial<SlotDayMap[string]> = {}): SlotDayMap[string] =>
  ({ status: 'ready', pickup: [], delivery: [], ...over }) as SlotDayMap[string]

const READY = (pickup: string[], delivery: string[]) => day({ status: 'ready', pickup, delivery })

describe('A · every date in play gets its own answer', () => {
  it('asks for the baseline plus each distinct date, once', () => {
    expect(slotDatesToFetch(['2026-08-30', '2026-08-31', '2026-09-01'], {}))
      .toEqual([BASE_SLOT_KEY, '2026-08-30', '2026-08-31', '2026-09-01'])
  })

  it('three fields on the same day cost one request', () => {
    expect(slotDatesToFetch(['2026-08-31', '2026-08-31', '2026-08-31'], {}))
      .toEqual([BASE_SLOT_KEY, '2026-08-31'])
  })

  it('always wants the baseline, even before any date is chosen', () => {
    expect(slotDatesToFetch([null, undefined, ''], {})).toEqual([BASE_SLOT_KEY])
  })

  it('never re-asks for a date already held, whatever its status', () => {
    const have: SlotDayMap = {
      [BASE_SLOT_KEY]: READY(['14:00 - 15:00'], ['14:00 - 15:00']),
      '2026-08-31': day({ status: 'loading' }),
      '2026-09-01': day({ status: 'error' }),
    }
    expect(slotDatesToFetch(['2026-08-31', '2026-09-01'], have)).toEqual([])
  })

  it('asks only for the date that is new', () => {
    const have: SlotDayMap = { [BASE_SLOT_KEY]: READY([], []), '2026-08-31': READY([], ['14:00 - 15:00']) }
    expect(slotDatesToFetch(['2026-08-31', '2026-09-01'], have)).toEqual(['2026-09-01'])
  })
})

describe('A · Standard and Backup delivery read different dates', () => {
  // The exact screenshot: standard 2026-08-31, backup 2026-09-01, 24/7 tenant
  // whose configured delivery window is 14:00–23:00 hourly.
  const WINDOW = generateSlots({ start: '14:00', end: '23:00', durationMin: 60 })
  const map: SlotDayMap = {
    [BASE_SLOT_KEY]: READY(WINDOW, WINDOW),
    '2026-08-31': READY(WINDOW, WINDOW),
    '2026-09-01': READY(WINDOW, []), // this ONE day is closed
  }

  it('returns the slots the endpoint gave for that date', () => {
    expect(slotListFor(map, '2026-08-31', 'delivery')).toEqual({ status: 'ready', slots: WINDOW })
    expect(WINDOW).toHaveLength(9)
  })

  it('a closure on the backup date does not empty the standard date', () => {
    expect(slotListFor(map, '2026-08-31', 'delivery').slots).toHaveLength(9)
    expect(slotListFor(map, '2026-09-01', 'delivery').slots).toEqual([])
  })

  it('a date with no entry yet is LOADING, never "no slots"', () => {
    // This is the whole bug: an unanswered date used to render the empty state.
    const listing = slotListFor(map, '2026-09-02', 'delivery')
    expect(listing.status).toBe('loading')
    expect(slotPlaceholder(listing, 'delivery')).toBe('Loading…')
  })

  it('an unanswered date is not given the baseline window', () => {
    // Standing the unclipped configured window in for a date would offer times
    // that date may not have.
    expect(slotListFor(map, '2026-09-02', 'delivery').slots).toEqual([])
  })

  it('falls back to the configured window only when no date is chosen', () => {
    expect(slotListFor(map, '', 'delivery').slots).toEqual(WINDOW)
    expect(slotListFor(map, null, 'pickup').slots).toEqual(WINDOW)
  })
})

describe('A · loading, failed and empty are three different answers', () => {
  it('says Loading while the date is in flight', () => {
    expect(slotPlaceholder({ status: 'loading', slots: [] }, 'delivery')).toBe('Loading…')
  })

  it('says the request failed when it failed — not that the date is empty', () => {
    expect(slotPlaceholder({ status: 'error', slots: [] }, 'delivery'))
      .toBe("Couldn't load delivery slots — tap Retry")
  })

  it('says "no slots for this date" ONLY when the server answered with none', () => {
    expect(slotPlaceholder({ status: 'ready', slots: [] }, 'delivery'))
      .toBe('No delivery slots available for this date')
    expect(slotPlaceholder({ status: 'ready', slots: [] }, 'pickup'))
      .toBe('No pickup slots available for this date')
  })

  it('a failed request never carries slots, so none can be booked from it', () => {
    const map: SlotDayMap = { '2026-08-31': day({ status: 'error', delivery: ['14:00 - 15:00'] }) }
    expect(slotListFor(map, '2026-08-31', 'delivery').slots).toEqual([])
  })

  it('an ordinary date with slots asks the customer to select', () => {
    expect(slotPlaceholder({ status: 'ready', slots: ['14:00 - 15:00'] }, 'delivery')).toBe('Select slot')
  })
})

describe('A · a selection stays valid for the date beside it', () => {
  const SLOTS = ['14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00']
  const ready = { status: 'ready', slots: SLOTS } as const

  it('keeps a slot the date still offers', () => {
    expect(reconcileSlotSelection('15:00 - 16:00', ready)).toBe('15:00 - 16:00')
  })

  it('replaces a slot the new date does not offer', () => {
    expect(reconcileSlotSelection('22:00 - 23:00', ready)).toBe('14:00 - 15:00')
  })

  it('defaults an empty selection to the first bookable slot', () => {
    expect(reconcileSlotSelection('', ready)).toBe('14:00 - 15:00')
  })

  it('moves off a FULL slot to the first slot that is not full', () => {
    const full = new Set(['14:00 - 15:00', '15:00 - 16:00'])
    expect(reconcileSlotSelection('14:00 - 15:00', ready, (s) => full.has(s))).toBe('16:00 - 17:00')
  })

  it('clears the selection when every slot on the date is blocked', () => {
    expect(reconcileSlotSelection('14:00 - 15:00', ready, () => true)).toBe('')
  })

  it('clears the selection when the date offers nothing at all', () => {
    expect(reconcileSlotSelection('14:00 - 15:00', { status: 'ready', slots: [] })).toBe('')
  })

  it('keeps the current choice while the date is loading or failed', () => {
    // Discarding a valid selection because of a network hiccup is a worse
    // answer than keeping it — the server revalidates it on submit anyway.
    expect(reconcileSlotSelection('15:00 - 16:00', { status: 'loading', slots: [] })).toBe('15:00 - 16:00')
    expect(reconcileSlotSelection('15:00 - 16:00', { status: 'error', slots: [] })).toBe('15:00 - 16:00')
  })
})

describe('B · a 24/7 window generates slots instead of nothing', () => {
  it('00:00 → 00:00 is a full day, not an empty window', () => {
    const slots = generateSlots({ start: '00:00', end: '00:00', durationMin: 60 })
    expect(slots).toHaveLength(24)
    expect(slots[0]).toBe('00:00 - 01:00')
    expect(slots[23]).toBe('23:00 - 24:00')
  })

  it('00:00 → 00:00 respects the configured slot length', () => {
    expect(generateSlots({ start: '00:00', end: '00:00', durationMin: 120 })).toHaveLength(12)
    expect(generateSlots({ start: '00:00', end: '00:00', durationMin: 180 })).toHaveLength(8)
  })

  it('a window ending at midnight runs to midnight', () => {
    const slots = generateSlots({ start: '14:00', end: '00:00', durationMin: 60 })
    expect(slots).toHaveLength(10)
    expect(slots[9]).toBe('23:00 - 24:00')
  })

  it('accepts the 24:00 spelling the generator itself emits', () => {
    expect(generateSlots({ start: '22:00', end: '24:00', durationMin: 60 }))
      .toEqual(['22:00 - 23:00', '23:00 - 24:00'])
  })

  it('the last slot of the day ends at midnight, not at the start of the day', () => {
    // "23:00 - 00:00" would resolve to midnight of the SAME day and read as
    // long past; "23:00 - 24:00" resolves to midnight of the next one.
    const slot = '23:00 - 24:00'
    const during = new Date('2026-08-31T23:30:00')
    expect(slotHasEnded(slot, '2026-08-31', during)).toBe(false)
    expect(slotHasEnded(slot, '2026-08-31', new Date('2026-09-01T00:00:00'))).toBe(true)
    expect(slotIsPast(slot, '2026-08-31', during)).toBe(true)
  })

  it('leaves every already-valid window byte-for-byte unchanged', () => {
    expect(generateSlots({ start: '14:00', end: '23:00', durationMin: 60 })).toEqual([
      '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00',
      '19:00 - 20:00', '20:00 - 21:00', '21:00 - 22:00', '22:00 - 23:00',
    ])
    expect(generateSlots({ start: '07:00', end: '21:00', durationMin: 120 })).toHaveLength(7)
    expect(generateSlots({ start: '00:00', end: '23:00', durationMin: 60 })).toHaveLength(23)
  })

  it('never labels the final slot "23:00 - 00:00"', () => {
    // That label would resolve to midnight at the START of the same day, so
    // the slot would read as long past for the whole of the day it belongs to.
    for (const cfg of [
      { start: '00:00', end: '00:00', durationMin: 60 },
      { start: '14:00', end: '00:00', durationMin: 60 },
      { start: '00:00', end: '00:00', durationMin: 120 },
    ]) {
      const slots = generateSlots(cfg)
      expect(slots.some((s) => s.endsWith('- 00:00'))).toBe(false)
      expect(slots[slots.length - 1].endsWith('- 24:00')).toBe(true)
    }
  })

  it('reinterprets the END only — a midnight START is still a start', () => {
    // 00:00 → 06:00 is a six-hour early window, not a 30-hour one.
    expect(generateSlots({ start: '00:00', end: '06:00', durationMin: 60 })).toHaveLength(6)
    expect(generateSlots({ start: '00:00', end: '06:00', durationMin: 60 })[0]).toBe('00:00 - 01:00')
  })

  it('leaves EVERY non-midnight end exactly as the old rule computed it', () => {
    // Exhaustive guard against the reinterpretation leaking into other ranges.
    const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
    const pad = (n: number) => String(n).padStart(2, '0')
    const legacy = (start: string, end: string, dur: number) => {
      const s0 = toMin(start), e0 = toMin(end)
      if (e0 <= s0) return []
      const out: string[] = []
      for (let s = s0; s + dur <= e0; s += dur) out.push(`${pad(Math.floor(s / 60))}:${pad(s % 60)} - ${pad(Math.floor((s + dur) / 60))}:${pad((s + dur) % 60)}`)
      return out
    }
    for (let sh = 0; sh < 24; sh++) {
      for (let eh = 1; eh < 24; eh++) {           // eh 1..23 → never midnight
        for (const dur of [30, 60, 90, 120, 180]) {
          const start = `${pad(sh)}:00`, end = `${pad(eh)}:00`
          expect(generateSlots({ start, end, durationMin: dur })).toEqual(legacy(start, end, dur))
        }
      }
    }
  })

  it('still refuses genuinely broken windows rather than inventing slots', () => {
    // A reversed window that is not "until midnight" is a misconfiguration, and
    // a window with no room for one slot has no slot to offer.
    expect(generateSlots({ start: '22:00', end: '02:00', durationMin: 60 })).toEqual([])
    expect(generateSlots({ start: '22:00', end: '23:00', durationMin: 120 })).toEqual([])
    expect(generateSlots({ start: '10:00', end: '10:00', durationMin: 60 })).toEqual([])
    expect(generateSlots({ start: '', end: '', durationMin: 60 })).toEqual([])
  })

  it('a tenant that has never touched the setting still gets the defaults', () => {
    const { pickup, delivery } = slotConfigsFrom(null)
    expect(generateSlots(pickup)).toHaveLength(7)
    expect(generateSlots(delivery)).toHaveLength(9)
  })

  it('a 24/7 delivery window survives the whole picker path', () => {
    const { delivery } = slotConfigsFrom({ deliverySlotStart: '00:00', deliverySlotEnd: '00:00', deliverySlotDurationMin: 60 })
    const slots = generateSlots(delivery)
    const map: SlotDayMap = { '2026-08-31': READY([], slots), '2026-09-01': READY([], slots) }
    for (const d of ['2026-08-31', '2026-09-01']) {
      const listing = slotListFor(map, d, 'delivery')
      expect(listing.slots).toHaveLength(24)
      expect(slotPlaceholder(listing, 'delivery')).toBe('Select slot')
    }
  })
})

describe('C · the reported failure, end to end through the picker', () => {
  const WINDOW = generateSlots({ start: '14:00', end: '23:00', durationMin: 60 })

  it('reproduces it: one unanswered date-less list emptied both delivery legs', () => {
    // What the old code held after its single request failed.
    const brokenLegacyList: string[] = []
    expect(brokenLegacyList).toHaveLength(0)
    // …and what it said about it, for both dates, with no way back.
    const asIfEmpty = { status: 'ready', slots: brokenLegacyList } as const
    expect(slotPlaceholder(asIfEmpty, 'delivery')).toBe('No delivery slots available for this date')
  })

  it('fixes it: the same failure now reads as a failure, on both legs', () => {
    const map: SlotDayMap = {
      [BASE_SLOT_KEY]: day({ status: 'error' }),
      '2026-08-31': day({ status: 'error' }),
      '2026-09-01': day({ status: 'error' }),
    }
    for (const d of ['2026-08-31', '2026-09-01']) {
      expect(slotPlaceholder(slotListFor(map, d, 'delivery'), 'delivery'))
        .toBe("Couldn't load delivery slots — tap Retry")
    }
    // Retry drops the failed days so they are asked again.
    const afterRetry = Object.fromEntries(Object.entries(map).filter(([, v]) => v.status !== 'error'))
    expect(slotDatesToFetch(['2026-08-31', '2026-09-01'], afterRetry))
      .toEqual([BASE_SLOT_KEY, '2026-08-31', '2026-09-01'])
  })

  it('and a working request fills both legs for their own dates', () => {
    const map: SlotDayMap = {
      [BASE_SLOT_KEY]: READY(WINDOW, WINDOW),
      '2026-08-31': READY(WINDOW, WINDOW),
      '2026-09-01': READY(WINDOW, WINDOW),
    }
    expect(slotListFor(map, '2026-08-31', 'delivery').slots).toEqual(WINDOW)
    expect(slotListFor(map, '2026-09-01', 'delivery').slots).toEqual(WINDOW)
    expect(reconcileSlotSelection('', slotListFor(map, '2026-08-31', 'delivery'))).toBe('14:00 - 15:00')
    expect(reconcileSlotSelection('', slotListFor(map, '2026-09-01', 'delivery'))).toBe('14:00 - 15:00')
  })
})
