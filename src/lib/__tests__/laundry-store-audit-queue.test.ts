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
    for (const h of ['Order No.', 'Customer', 'Service', 'Pickup', 'Delivery', 'Amount', 'Created', 'Status', 'Action']) {
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

  it('the layout cannot overflow — fixed table, widths summing to 100%', () => {
    // table-fixed + a colgroup of percentages means the table is always exactly
    // its container's width, so no horizontal scrollbar can appear at ANY
    // desktop width. This replaced the overflow-x-auto workaround.
    expect(QUEUE).toContain('table-fixed')
    const widths = [...QUEUE.matchAll(/<col className="w-\[(\d+)%\]"/g)].map((m) => Number(m[1]))
    // TEN since Weight was added. Counting alone is not enough — this suite
    // passed while the colgroup still had nine entries for ten headers, because
    // nine widths summing to 100 is internally consistent even when it is
    // misaligned against the header row. The <col>-per-<TableHead> check that
    // actually catches that lives in laundry-order-display.test.ts.
    expect(widths).toHaveLength(11)
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('the queue no longer relies on a scroll container of its own', () => {
    expect(QUEUE).not.toContain('overflow-x-auto')
  })

  it('the queue uses the page width rather than the narrow detail column', () => {
    // max-w-5xl (1024px) could not hold the columns — that was the root cause.
    // The cap is now gone entirely: the queue is a full-width operational
    // workstation, so it uses page padding and no max-width at all. That is
    // strictly MORE page than the max-w-7xl this test used to require.
    // Asserted on the CODE: the comment above the container explains which cap
    // was removed, so it names max-w-7xl in prose without applying it.
    const queueContainer = QUEUE.slice(0, QUEUE.indexOf('</div>'))
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(queueContainer).toContain('px-4 lg:px-6')
    expect(queueContainer).not.toMatch(/className="[^"]*max-w-/)
  })

  it('text cells may wrap — TableCell defaults to nowrap, which must be overridden', () => {
    expect(QUEUE).toContain('whitespace-normal')
    expect(QUEUE).toContain('break-all')   // the full order number, never truncated
    expect(QUEUE).toContain('break-words') // customer names
  })

  it('the order number is shown in full, not truncated', () => {
    expect(QUEUE).toContain('{r.orderNumber}')
    // Asserted on the CODE — the prose above it uses the word "truncated" to
    // say it does not happen.
    const code = QUEUE.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const w of ['truncate', 'text-ellipsis', 'slice(0,', 'substring(']) {
      expect(code, w).not.toContain(w)
    }
  })

  it('cell padding is reduced to buy width', () => {
    expect(QUEUE).toContain('[&>td]:px-2')
    expect(QUEUE).toContain('[&>th]:px-2')
  })

  it('Amount and Created are the narrow columns, by stated priority', () => {
    const widths = [...QUEUE.matchAll(/<col className="w-\[(\d+)%\]"/g)].map((m) => Number(m[1]))
    // Items and Weight sit fourth and fifth, between Service and Pickup. Both
    // are SHORT numerics ("18", "8.5 kg", "—") so they belong with the narrow
    // columns, not the wide text ones — the positional destructuring has to
    // account for both or every name below reads a column to its left.
    const [order, customer, service, items, weight, pickup, delivery, amount, created] = widths
    for (const critical of [order, customer, service, pickup, delivery]) {
      expect(critical).toBeGreaterThan(Math.max(amount, created, items, weight))
    }
  })

  it('operational text is not shrunk below 11px to make it fit', () => {
    // The queue is read all day. Order number, service and the urgency flag all
    // sit at 11px+; only the deliberately compact Status badge stays smaller.
    const body = QUEUE.slice(QUEUE.indexOf('<TableBody>'), QUEUE.indexOf('</TableBody>'))
    expect(body).toContain('font-mono text-[11px]')      // order number
    expect(body).toContain('text-[11px] font-normal')    // service badge
    expect(body).toContain('text-[13px] font-medium')    // customer name
    expect(body).toContain('text-[12px] tabular-nums')   // items + weight
    expect(body).not.toContain('text-[9px]')
    // The overdue / today flag moved into ScheduleCellContent when the mapped
    // pickup/delivery pair became two explicit cells. It is declared above the
    // queue view, so it is asserted against the whole file rather than the body.
    expect(AUDIT).toContain('text-[11px] font-semibold')
    expect(AUDIT).not.toContain('text-[9px]')
  })

  it('rows have vertical breathing room', () => {
    expect(QUEUE).toContain('[&>td]:py-2.5')
  })

  it('narrow screens get stacked cards instead of a scrollbar', () => {
    expect(QUEUE).toContain('hidden md:table')
    expect(QUEUE).toContain('md:hidden')
  })

  it('the card layout carries the same information', () => {
    const cards = QUEUE.slice(QUEUE.indexOf('md:hidden divide-y'))
    for (const field of ['r.orderNumber', 'r.customer?.name', 'services.map', 'Pickup', 'Delivery', 'inr(r.grandTotal)', 'Inspect']) {
      expect(cards, field).toContain(field)
    }
  })

  it('Inspect works from the card too, without opening a second order', () => {
    const cards = QUEUE.slice(QUEUE.indexOf('md:hidden divide-y'))
    expect(cards).toContain('e.stopPropagation(); openOrder(r.id)')
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
