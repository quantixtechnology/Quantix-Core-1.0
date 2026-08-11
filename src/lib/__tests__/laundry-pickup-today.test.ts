import { describe, it, expect, vi, afterEach } from 'vitest'
import { slotHasEnded, slotIsPast } from '@/lib/laundry-slots'
import { isLaundryDateAvailable, businessToday } from '@/lib/laundry-availability'

// The production report: 4:47 PM local, today's date, slot 16:00-17:00 refused
// as "This date is in the past".
const AT_1647 = new Date('2026-08-11T16:47:00')
const TODAY = '2026-08-11'
// StoreDayTiming: { day, openTime, closeTime, isClosed }. Open every day, so
// the tests exercise the DATE rule rather than a weekday coincidence.
const OPEN = Array.from({ length: 7 }, (_, day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: false }))

const at = (d: Date) => { vi.useFakeTimers(); vi.setSystemTime(d) }
afterEach(() => vi.useRealTimers())

describe('a date is not "past" merely because it is today', () => {
  it('accepts today at 4:47 PM', () => {
    at(AT_1647)
    const r = isLaundryDateAvailable(OPEN, TODAY)
    expect(r.reason).not.toBe('This date is in the past')
    expect(r.available).toBe(true)
  })

  // The old rule compared UTC midnight to now-6h, so today failed from ~11:30
  // AM local onward. Late evening is the strongest case.
  it('still accepts today at 11:50 PM', () => {
    at(new Date('2026-08-11T23:50:00'))
    expect(isLaundryDateAvailable(OPEN, TODAY).reason).not.toBe('This date is in the past')
  })

  it('accepts tomorrow', () => {
    at(AT_1647)
    expect(isLaundryDateAvailable(OPEN, '2026-08-12').available).toBe(true)
  })

  it('still rejects yesterday', () => {
    at(AT_1647)
    expect(isLaundryDateAvailable(OPEN, '2026-08-10')).toMatchObject({ available: false, reason: 'This date is in the past' })
  })

  it('businessToday is a sortable local day key', () => {
    at(AT_1647)
    expect(businessToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('slot availability at 4:47 PM — the reported table', () => {
  const ended = (slot: string) => slotHasEnded(slot, TODAY, AT_1647)

  it('14:00-15:00 has ended', () => expect(ended('14:00-15:00')).toBe(true))
  it('15:00-16:00 has ended', () => expect(ended('15:00-16:00')).toBe(true))
  it('16:00-17:00 is still live', () => expect(ended('16:00-17:00')).toBe(false))
  it('17:00-18:00 is still to come', () => expect(ended('17:00-18:00')).toBe(false))

  it('a slot is over at exactly its end time', () => {
    expect(slotHasEnded('16:00-17:00', TODAY, new Date('2026-08-11T17:00:00'))).toBe(true)
    expect(slotHasEnded('16:00-17:00', TODAY, new Date('2026-08-11T16:59:59'))).toBe(false)
  })

  it('never restricts a future date', () => {
    expect(slotHasEnded('09:00-10:00', '2026-08-12', AT_1647)).toBe(false)
  })

  it('treats every slot on a past date as over', () => {
    expect(slotHasEnded('20:00-21:00', '2026-08-10', AT_1647)).toBe(true)
  })
})

// The two questions are different, and conflating them caused the bug.
describe('pickup availability and the delivery TAT floor stay separate', () => {
  it('slotIsPast still answers "has it STARTED" — unchanged for delivery', () => {
    expect(slotIsPast('16:00-17:00', TODAY, AT_1647)).toBe(true)
    expect(slotHasEnded('16:00-17:00', TODAY, AT_1647)).toBe(false)
  })

  it('slotIsPast keeps working as a TAT floor against an arbitrary reference', () => {
    const tatFloor = new Date('2026-08-11T22:00:00')
    expect(slotIsPast('21:00-22:00', TODAY, tatFloor)).toBe(true)
    expect(slotIsPast('22:00-23:00', TODAY, tatFloor)).toBe(false)
  })
})

describe('every other rule still applies', () => {
  it('a closed day is still refused, even today', () => {
    at(AT_1647)
    const closed = Array.from({ length: 7 }, (_, day) => ({ day, openTime: '09:00', closeTime: '21:00', isClosed: true }))
    expect(isLaundryDateAvailable(closed, TODAY).available).toBe(false)
  })

  it('a temporary closure still wins over today being valid', () => {
    at(AT_1647)
    expect(isLaundryDateAvailable(OPEN, TODAY, '2026-08-20').available).toBe(false)
  })
})
