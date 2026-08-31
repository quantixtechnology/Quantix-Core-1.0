import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { scheduleCell, bookedServiceNames, urgencyNote, URGENCY_STYLE } from '@/lib/laundry-schedule-display'

// ============================================================================
// STORE AUDIT QUEUE — information, not behaviour.
//
// The pending-audit table has to answer "whose order, which service, when is it
// due, and is it late?" at a glance. Everything here is DISPLAY: no status is
// read or written, no date is invented, and "overdue" is a colour rather than a
// state.
// ============================================================================

const NOW = new Date('2026-08-31T12:00:00')

describe('a scheduled date reads as two scannable lines', () => {
  it('splits the date and the slot', () => {
    const c = scheduleCell('2026-08-31T00:00:00', '3:00 PM - 4:00 PM', NOW)
    expect(c.date).toBe('31 Aug 2026')
    expect(c.slot).toBe('3:00 PM - 4:00 PM')
  })

  it('a date with no slot still shows the date', () => {
    const c = scheduleCell('2026-09-02T00:00:00', null, NOW)
    expect(c.date).toBe('02 Sept 2026')
    expect(c.slot).toBeNull()
  })

  it('a blank slot is not rendered as an empty line', () => {
    expect(scheduleCell('2026-09-02T00:00:00', '   ', NOW).slot).toBeNull()
  })
})

describe('nothing scheduled is never invented', () => {
  it('no date means no date', () => {
    for (const v of [null, undefined, '']) {
      const c = scheduleCell(v, '3:00 PM - 4:00 PM', NOW)
      expect(c).toMatchObject({ date: null, slot: null, urgency: 'none', daysAway: null })
    }
  })

  it('an unparseable date is treated as nothing, not as today', () => {
    expect(scheduleCell('not-a-date', null, NOW).urgency).toBe('none')
  })

  it('a missing delivery schedule renders the em dash, never a guess', () => {
    // The screen renders "—" whenever date is null; asserted on the screen below.
    expect(scheduleCell(null, null, NOW).date).toBeNull()
  })
})

describe('urgency helps prioritisation without changing anything', () => {
  it('today is flagged', () => {
    const c = scheduleCell('2026-08-31T09:00:00', '9:00 AM - 10:00 AM', NOW)
    expect(c.urgency).toBe('today')
    expect(urgencyNote(c)).toBe('Today')
  })

  it('yesterday is overdue, and says by how much', () => {
    const c = scheduleCell('2026-08-30T00:00:00', null, NOW)
    expect(c.urgency).toBe('overdue')
    expect(c.daysAway).toBe(-1)
    expect(urgencyNote(c)).toBe('1 day overdue')
  })

  it('several days late is counted', () => {
    expect(urgencyNote(scheduleCell('2026-08-28T00:00:00', null, NOW))).toBe('3 days overdue')
  })

  it('the future is upcoming and stays quiet', () => {
    const c = scheduleCell('2026-09-03T00:00:00', null, NOW)
    expect(c.urgency).toBe('upcoming')
    expect(urgencyNote(c)).toBe('')
  })

  it('a time earlier today is still today, not overdue', () => {
    // The queue prioritises by DAY; an 09:00 slot at 12:00 is not "overdue".
    expect(scheduleCell('2026-08-31T09:00:00', null, NOW).urgency).toBe('today')
  })

  it('every urgency has a style, so no row renders unstyled', () => {
    for (const u of ['none', 'overdue', 'today', 'upcoming'] as const) {
      expect(URGENCY_STYLE[u]).toBeTruthy()
    }
  })
})

describe('the booked service is shown, never chosen', () => {
  it('shows the order\'s own booked service', () => {
    expect(bookedServiceNames([{ serviceId: 's1', serviceName: 'Wash & Iron' }])).toEqual(['Wash & Iron'])
  })

  it('shows ALL services when an order carries more than one', () => {
    expect(bookedServiceNames([
      { serviceId: 's1', serviceName: 'Wash & Iron' },
      { serviceId: 's2', serviceName: 'Dry Clean' },
    ])).toEqual(['Wash & Iron', 'Dry Clean'])
  })

  it('collapses a repeated service instead of listing it twice', () => {
    expect(bookedServiceNames([
      { serviceId: 's1', serviceName: 'Wash & Iron' },
      { serviceId: 's1', serviceName: 'wash & iron' },
    ])).toEqual(['Wash & Iron'])
  })

  it('an order with no booked service shows nothing rather than a guess', () => {
    expect(bookedServiceNames([])).toEqual([])
    expect(bookedServiceNames(null)).toEqual([])
    expect(bookedServiceNames([{ serviceId: 's1', serviceName: '' }])).toEqual([])
  })
})

// ── the screen ──────────────────────────────────────────────────────────────
const AUDIT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-audit.tsx'), 'utf8')
// The queue view ONLY — the slice must stop before IntakeAudit, which lives
// after it in the same file and legitimately POSTs garments.
const QUEUE = AUDIT.slice(AUDIT.indexOf('// ── Queue view ──'), AUDIT.indexOf('// ── Intake Audit'))

describe('the queue shows what the operator needs', () => {
  it('every requested column is present', () => {
    for (const h of ['Order No.', 'Customer', 'Service Booked', 'Pickup', 'Delivery', 'Amount', 'Created', 'Status', 'Action']) {
      expect(QUEUE, h).toContain(`>${h}<`)
    }
  })

  it('the customer name leads, with the phone beneath it', () => {
    expect(QUEUE).toContain('{r.customer?.name || "—"}')
    expect(QUEUE).toContain('{r.customer.phone}')
  })

  it('pickup and delivery both come from the order\'s own stored schedule', () => {
    expect(QUEUE).toContain('scheduleCell(r.pickupDate, r.pickupTimeSlot)')
    expect(QUEUE).toContain('scheduleCell(r.deliveryDate, r.deliveryTimeSlot)')
  })

  it('a missing schedule renders an em dash', () => {
    expect(QUEUE).toContain('<span className="text-slate-400">—</span>')
  })

  it('Inspect still opens the same order, unchanged', () => {
    expect(QUEUE).toContain('onClick={() => openOrder(r.id)}')
    expect(QUEUE).toContain('openOrder(r.id) }}>Inspect')
  })

  it('the wide table scrolls in its own container, not the page', () => {
    expect(QUEUE).toContain('overflow-x-auto')
  })
})

describe('it is display only — no workflow was touched', () => {
  it('the queue writes no status and starts no transition', () => {
    for (const w of ['transition', 'PATCH', 'POST', 'toStatus']) {
      expect(QUEUE, w).not.toContain(w)
    }
  })

  it('the queue still reads exactly the same endpoint and filter', () => {
    expect(AUDIT).toContain('status=PENDING_STORE_AUDIT&limit=100')
  })

  it('the display rule itself touches no data and no status', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-schedule-display.ts'), 'utf8')
    const code = LIB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['fetch(', 'prisma', 'status', 'transition']) {
      expect(code, w).not.toContain(w)
    }
  })

  it('"today" means the same day the rest of the app means', () => {
    const LIB = readFileSync(join(process.cwd(), 'src/lib/laundry-schedule-display.ts'), 'utf8')
    expect(LIB).toContain('from "@/lib/laundry-delivery-promise"')
    expect(LIB).toContain('dayKey')
  })
})
