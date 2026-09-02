import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// PICKUP IS ITS OWN FACT ON THE ORDERS LIST.
//
// Operational planning needs to see when a job is collected, not infer it. The
// order carries that answer already — LaundryOrder.pickupDate / pickupTimeSlot,
// as booked — so the column reads it and nothing else. It is never derived from
// the delivery date or the creation time: an order can be scheduled for either
// without the other, and guessing would put a confident wrong time in front of
// the counter.
//
// The slot prints exactly as stored, which is how Order Detail and every
// scheduling screen already print it. A second time format on one screen makes
// the same order look like two.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')
const LIST = strip(read('src/components/laundry/views/laundry-orders-view.tsx'))
const DETAIL = strip(read('src/components/laundry/views/laundry-order-detail.tsx'))
const ROUTE = strip(read('src/app/api/laundry/orders/route.ts'))

describe('the column exists, immediately before Delivery', () => {
  it('Pickup sits between Rating and Delivery', () => {
    expect(LIST).toContain('<TableHead>Pickup</TableHead><TableHead>Delivery</TableHead>')
  })

  it('headers and cells still line up', () => {
    const hdr = LIST.slice(LIST.indexOf('<TableHeader>'), LIST.indexOf('</TableHeader>'))
    const body = LIST.slice(LIST.indexOf('</TableHeader>'), LIST.indexOf('</TableBody>'))
    const row = body.slice(body.indexOf('<TableRow'), body.indexOf('</TableRow>'))
    const heads = (hdr.match(/<TableHead[ >]/g) || []).length
    const cells = (row.match(/<TableCell[ >]/g) || []).length
    // 14 since Service and Weight were added to the list. The invariant this
    // test actually protects is the line below — every header has a cell — and
    // it held through that change; only the snapshot of the count moved.
    expect(heads).toBe(14)
    expect(cells).toBe(heads)
  })
})

describe('it reads the order’s own pickup fields — never a derived one', () => {
  it('the row type declares the authoritative fields', () => {
    expect(LIST).toContain('pickupDate: string | null; pickupTimeSlot: string | null')
  })

  it('the cell renders pickupDate and pickupTimeSlot', () => {
    const cell = LIST.slice(LIST.indexOf('{o.pickupDate ? ('), LIST.indexOf('{fmtDay(o.expectedDeliveryDate)}'))
    expect(cell.length).toBeGreaterThan(100)
    expect(cell).toContain('fmtDay(o.pickupDate)')
    expect(cell).toContain('{o.pickupTimeSlot}')
  })

  it('and derives nothing from delivery or creation time', () => {
    const cell = LIST.slice(LIST.indexOf('{o.pickupDate ? ('), LIST.indexOf('{fmtDay(o.expectedDeliveryDate)}'))
    for (const w of ['expectedDeliveryDate', 'createdAt', 'deliveryDate', 'Date.now', 'new Date(']) {
      expect(cell, w).not.toContain(w)
    }
  })
})

describe('an unscheduled order says so, rather than inventing a value', () => {
  it('no pickup date → an em dash, the same fallback the table already uses', () => {
    const cell = LIST.slice(LIST.indexOf('{o.pickupDate ? ('), LIST.indexOf('{fmtDay(o.expectedDeliveryDate)}'))
    expect(cell).toContain('<span className="text-slate-300">—</span>')
  })

  it('a date with no slot still shows the date', () => {
    // The slot is rendered only when present, so a date-only booking is not
    // suppressed and no blank slot line is drawn.
    const cell = LIST.slice(LIST.indexOf('{o.pickupDate ? ('), LIST.indexOf('{fmtDay(o.expectedDeliveryDate)}'))
    expect(cell).toContain('{o.pickupTimeSlot && <div')
  })
})

describe('consistent with everywhere else the same order is shown', () => {
  it('Order Detail prints the slot raw, and so does the list', () => {
    expect(DETAIL).toContain('{order.pickupTimeSlot || "—"}')
    expect(LIST).toContain('{o.pickupTimeSlot}')
    // Neither screen reformats the stored slot into a second style.
    for (const src of [LIST, DETAIL]) {
      expect(src).not.toContain('formatTimeLabel')
      expect(src).not.toMatch(/hour12/)
    }
  })

  it('both read the same two fields off the order', () => {
    expect(DETAIL).toContain('pickupDate: string | null; pickupTimeSlot: string | null')
  })
})

describe('the data reaches the client without a backend change', () => {
  it('the orders list query uses include, so every order scalar is returned', () => {
    // A narrowing `select:` here would silently drop pickupDate/pickupTimeSlot
    // and the column would render em dashes for every row.
    // Anchored on the LIST query specifically. The report mode has its own
    // findMany earlier in the file — which legitimately uses nested selects —
    // so anchoring on the first findMany would assert against the wrong query.
    const q = ROUTE.slice(ROUTE.indexOf('const [orders, total] = await Promise.all(['), ROUTE.indexOf('prisma.laundryOrder.count('))
    expect(q.length).toBeGreaterThan(200)
    expect(q).toContain('prisma.laundryOrder.findMany({')
    expect(q).toContain('include: {')
    expect(q).not.toMatch(/^\s*select: \{/m)
  })

  it('and the row spread passes them through untouched', () => {
    expect(ROUTE).toContain('const { items, ...rest } = o')
    expect(ROUTE).toContain('...rest,')
  })
})
