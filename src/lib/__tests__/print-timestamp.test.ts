import { describe, it, expect } from 'vitest'
import { formatPrintedAt, printedOnLine, PRINT_TIMEZONE, PRINTED_ON_LABEL } from '@/lib/print-timestamp'

describe('Printed On — the platform-wide format', () => {
  // 11 Aug 2026, 19:15 IST === 13:45 UTC the same day.
  const AT = new Date('2026-08-11T13:45:00Z')

  it('renders exactly the specified shape', () => {
    expect(formatPrintedAt(AT)).toBe('11 Aug 2026, 07:15 PM')
  })

  it('renders the full line with its label', () => {
    expect(printedOnLine(AT)).toBe('Printed On: 11 Aug 2026, 07:15 PM')
    expect(PRINTED_ON_LABEL).toBe('Printed On')
  })

  it('uses the business timezone, not UTC', () => {
    expect(PRINT_TIMEZONE).toBe('Asia/Kolkata')
    // 20:00 UTC is already the NEXT day in Kolkata (01:30). Rendering the UTC
    // date here would print the wrong day on the invoice.
    expect(formatPrintedAt(new Date('2026-08-11T20:00:00Z'))).toBe('12 Aug 2026, 01:30 AM')
  })

  it('uppercases the meridiem', () => {
    expect(formatPrintedAt(AT)).toMatch(/ (AM|PM)$/)
    expect(formatPrintedAt(new Date('2026-08-11T04:00:00Z'))).toContain('AM')
  })

  it('pads hours and days to two digits', () => {
    expect(formatPrintedAt(new Date('2026-08-03T03:35:00Z'))).toBe('03 Aug 2026, 09:05 AM')
  })

  it('handles midnight and noon without confusion', () => {
    expect(formatPrintedAt(new Date('2026-08-11T18:30:00Z'))).toBe('12 Aug 2026, 12:00 AM')
    expect(formatPrintedAt(new Date('2026-08-11T06:30:00Z'))).toBe('11 Aug 2026, 12:00 PM')
  })

  it('accepts a timestamp or an ISO string', () => {
    expect(formatPrintedAt(AT.getTime())).toBe('11 Aug 2026, 07:15 PM')
    expect(formatPrintedAt(AT.toISOString())).toBe('11 Aug 2026, 07:15 PM')
  })

  // A bad value must never blank out or break an invoice mid-print.
  it('falls back to now rather than rendering an error', () => {
    expect(formatPrintedAt('not a date')).toMatch(/^\d{2} \w{3} \d{4}, \d{2}:\d{2} (AM|PM)$/)
  })

  it('defaults to the current moment', () => {
    expect(printedOnLine()).toMatch(/^Printed On: \d{2} \w{3} \d{4}, \d{2}:\d{2} (AM|PM)$/)
  })

  // Re-print behaviour: each call is its own moment.
  it('produces a different value for a later print', () => {
    const first = formatPrintedAt(new Date('2026-08-11T04:45:00Z'))
    const second = formatPrintedAt(new Date('2026-08-11T06:12:00Z'))
    expect(first).toBe('11 Aug 2026, 10:15 AM')
    expect(second).toBe('11 Aug 2026, 11:42 AM')
    expect(first).not.toBe(second)
  })
})
