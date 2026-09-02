import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { orderWeightLabel, orderServiceLabel, NOT_RECORDED } from '@/lib/laundry-order-display'

// ============================================================================
// Service + Weight on the four operational screens.
//
// WEIGHT has exactly one canonical source: LaundryOrder.totalWeightKg — the
// single total order weight measured at Store Audit. The column is
// `Float @default(0)`, NOT nullable, so "never weighed" arrives as 0. Showing
// that as "0 kg" would state a measurement nobody took, so 0 renders as an em
// dash exactly like null.
//
// The rule these tests exist to defend: weight is READ, never derived. Not from
// garment count, not from item weights, not from anything.
// ============================================================================

describe('orderWeightLabel · recorded weight only', () => {
  it('renders a recorded weight with the kg suffix', () => {
    expect(orderWeightLabel(8.5)).toBe('8.5 kg')
    expect(orderWeightLabel(12)).toBe('12 kg')
    expect(orderWeightLabel(0.25)).toBe('0.25 kg')
  })

  it('trims float noise to 2dp without inventing precision', () => {
    expect(orderWeightLabel(8.500000000000001)).toBe('8.5 kg')
    expect(orderWeightLabel(3.456)).toBe('3.46 kg')
    expect(orderWeightLabel(8.0)).toBe('8 kg')
  })

  it('THE RULE: 0 is "not weighed yet", never "0 kg"', () => {
    // totalWeightKg defaults to 0, so this is the ordinary pre-audit state.
    expect(orderWeightLabel(0)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(0)).not.toContain('kg')
  })

  it('renders null and undefined as not-recorded', () => {
    expect(orderWeightLabel(null)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(undefined)).toBe(NOT_RECORDED)
  })

  it('never renders a nonsense measurement', () => {
    expect(orderWeightLabel(NaN)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(Infinity)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(-4)).toBe(NOT_RECORDED)
    // Rounds to zero → still nothing was meaningfully weighed.
    expect(orderWeightLabel(0.0001)).toBe(NOT_RECORDED)
  })

  it('is a pure read — the same input always gives the same answer', () => {
    // There is no garment count, item list or order in scope: the function
    // CANNOT derive a weight even if a caller wanted it to.
    expect(orderWeightLabel(8.5)).toBe(orderWeightLabel(8.5))
    expect(orderWeightLabel.length).toBe(1)
  })
})

describe('orderServiceLabel · the order\'s booked services', () => {
  it('renders a single booked service', () => {
    expect(orderServiceLabel([{ serviceId: 's1', serviceName: 'Wash & Iron' }])).toBe('Wash & Iron')
  })

  it('joins several and de-duplicates by name', () => {
    const out = orderServiceLabel([
      { serviceId: 's1', serviceName: 'Wash & Iron' },
      { serviceId: 's2', serviceName: 'Dry Clean' },
      { serviceId: 's3', serviceName: 'wash & iron' },
    ])
    expect(out).toBe('Wash & Iron, Dry Clean')
  })

  it('falls back to per-garment service names only when nothing is booked', () => {
    // The Sorting queue is item-grained: its rows carry each garment's own
    // serviceName rather than the order's booked rows.
    expect(orderServiceLabel(null, [{ serviceName: 'Steam Press' }, { serviceName: 'Steam Press' }]))
      .toBe('Steam Press')
  })

  it('prefers the booked services over the fallback', () => {
    expect(orderServiceLabel([{ serviceName: 'Dry Clean' }], [{ serviceName: 'Steam Press' }]))
      .toBe('Dry Clean')
  })

  it('renders not-recorded when there is no service at all', () => {
    expect(orderServiceLabel(null)).toBe(NOT_RECORDED)
    expect(orderServiceLabel([])).toBe(NOT_RECORDED)
    expect(orderServiceLabel([{ serviceName: '  ' }])).toBe(NOT_RECORDED)
  })
})

// ── The four screens, and the queries behind them ───────────────────────────
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const SORTING = read('src/components/laundry/views/laundry-sorting-workstation.tsx')
const ORDERS = read('src/components/laundry/views/laundry-orders-view.tsx')
const AUDIT = read('src/components/laundry/views/laundry-store-audit.tsx')
const LEDGER = read('src/components/laundry/views/laundry-payments-ledger.tsx')
const LEDGER_API = read('src/app/api/laundry/payments-ledger/route.ts')
const PROCESSING_API = read('src/app/api/laundry/processing/route.ts')
const ORDERS_API = read('src/app/api/laundry/orders/route.ts')

describe('every screen reads weight through the one helper', () => {
  for (const [name, src] of [['Sorting', SORTING], ['Orders', ORDERS], ['Store Audit', AUDIT], ['Payments & Ledger', LEDGER]] as const) {
    it(`${name} renders weight via orderWeightLabel`, () => {
      expect(src).toContain('orderWeightLabel')
      expect(src).toContain('@/lib/laundry-order-display')
    })
  }

  for (const [name, src] of [['Sorting', SORTING], ['Orders', ORDERS], ['Payments & Ledger', LEDGER]] as const) {
    it(`${name} renders service via orderServiceLabel`, () => {
      expect(src).toContain('orderServiceLabel')
    })
  }

  it('Store Audit keeps its existing bookedServiceNames badges', () => {
    // Service already existed there as badges — this change must not replace it.
    expect(AUDIT).toContain('bookedServiceNames(r.services)')
  })
})

describe('weight is never derived from garment count', () => {
  it('no screen multiplies or sums its way to a weight', () => {
    for (const src of [SORTING, ORDERS, AUDIT, LEDGER]) {
      expect(src).not.toMatch(/weight\s*[*+]\s*(itemCount|quantity|garments\.length|expected)/i)
      expect(src).not.toMatch(/(itemCount|garments\.length|expected)\s*[*]\s*\w*[Ww]eight/)
      expect(src).not.toMatch(/reduce\([^)]*weightKg/)
    }
  })

  it('the Sorting card shows the ORDER weight, not a per-garment sum', () => {
    expect(SORTING).toContain('orderWeightLabel(o.totalWeightKg)')
    // The group's weight comes straight off the row the API sent.
    expect(SORTING).toContain('totalWeightKg: it.orderTotalWeightKg ?? null')
  })
})

describe('the queries return the canonical field', () => {
  it('the ledger selects totalWeightKg and the booked services', () => {
    expect(LEDGER_API).toMatch(/totalWeightKg:\s*true/)
    expect(LEDGER_API).toMatch(/services:\s*\{\s*select:\s*\{\s*serviceId:\s*true,\s*serviceName:\s*true\s*\}\s*\}/)
    expect(LEDGER_API).toContain('totalWeightKg: o.totalWeightKg')
  })

  it('the sorting queue joins the order\'s recorded weight', () => {
    expect(PROCESSING_API).toContain('orderNumber: true, customerId: true, totalWeightKg: true')
    expect(PROCESSING_API).toContain('orderTotalWeightKg: r.order.totalWeightKg')
  })

  it('the orders list needed no change — it already spreads every scalar', () => {
    // GET /api/laundry/orders uses include + `...rest`, so totalWeightKg and the
    // booked services were already on the wire. Orders AND Store Audit both read
    // it, which is why neither needed an API change.
    expect(ORDERS_API).toContain('services: true')
    expect(ORDERS_API).toContain('const { items, ...rest } = o')
    expect(AUDIT).toContain('/api/laundry/orders?')
  })
})

describe('item count and weight are BOTH shown, and are independent', () => {
  it('Orders keeps Service, Items AND Weight — Weight never replaces the count', () => {
    expect(ORDERS).toContain('>Service</TableHead>')
    expect(ORDERS).toContain('>Items</TableHead>')
    expect(ORDERS).toContain('>Weight</TableHead>')
    // The count still comes from the API's own itemCount (_count.items).
    expect(ORDERS).toContain('{o.itemCount}')
    expect(ORDERS_API).toContain('itemCount: o._count.items')
  })

  it('Sorting shows the garment count AND the weight, on one scannable line', () => {
    expect(SORTING).toContain('{o.garments.length}</span> garment')
    expect(SORTING).toContain('orderWeightLabel(o.totalWeightKg)')
    // Service sits on its own line above them.
    expect(SORTING).toContain('{orderServiceLabel(null, o.garments)}</p>')
  })

  it('the Sorting count is the real queue length, not a weight-derived figure', () => {
    // garments[] is the order's items at the SORTING stage, grouped from the
    // API response — the count is its length and nothing else.
    expect(SORTING).toContain('g.expected++')
    expect(SORTING).not.toMatch(/garments\.length\s*[*/]/)
    expect(SORTING).not.toMatch(/totalWeightKg\s*[*/]\s*\w/)
  })

  it('neither figure is computed from the other, on any screen', () => {
    for (const src of [SORTING, ORDERS, AUDIT, LEDGER]) {
      expect(src).not.toMatch(/itemCount\s*[*/]\s*\w*[Ww]eight/)
      expect(src).not.toMatch(/[Ww]eight\w*\s*[*/]\s*itemCount/)
      expect(src).not.toMatch(/totalWeightKg\s*\/\s*\w+/)
    }
  })

  it('Store Audit and the Ledger keep their existing information', () => {
    // Nothing was removed to make room for the two new facts.
    expect(AUDIT).toContain('>Pickup</TableHead>')
    expect(AUDIT).toContain('>Delivery</TableHead>')
    expect(AUDIT).toContain('>Amount</TableHead>')
    expect(AUDIT).toContain('>Status</TableHead>')
    expect(AUDIT).toContain('Scan Bag')
    for (const col of ['>Invoice</th>', '>Total</th>', '>Discount</th>', '>Paid</th>', '>Refund</th>', '>Balance</th>', '>Status</th>']) {
      expect(LEDGER).toContain(col)
    }
  })

  it('Store Audit shows the weight on phones as well as desktop', () => {
    expect((AUDIT.match(/orderWeightLabel\(r\.totalWeightKg\)/g) || []).length).toBe(2)
  })
})

describe('Store Audit uses the full desktop workstation width', () => {
  it('the queue is not capped to a centred card', () => {
    const queue = AUDIT.slice(AUDIT.indexOf('// ── Queue view ──'))
    expect(queue).toContain('className="px-4 lg:px-6 py-4 space-y-4"')
    expect(queue).not.toMatch(/className="max-w-7xl mx-auto px-4 py-6 space-y-4"/)
  })

  it('the fix is scoped to Store Audit — the detail form stays capped', () => {
    // Deliberately NOT full width: a form stretched across a wide monitor is
    // harder to read. Only the queue wanted the whole viewport.
    expect(AUDIT).toContain('max-w-7xl mx-auto px-4 lg:px-6 py-5 space-y-5')
  })

  it('every column has a width, so the table cannot overflow its container', () => {
    // table-fixed + percentages summing to 100% is what keeps the page from
    // scrolling horizontally at any width. A missing <col> silently shifts
    // every following width one column left — which is what adding Weight did.
    const cg = AUDIT.slice(AUDIT.indexOf('<colgroup>'), AUDIT.indexOf('</colgroup>'))
    const widths = [...cg.matchAll(/w-\[(\d+)%\]/g)].map((m) => Number(m[1]))
    const headBlock = AUDIT.slice(AUDIT.indexOf('<TableHeader><TableRow className="[&>th]:px-2'))
    const heads = (headBlock.slice(0, headBlock.indexOf('</TableRow>')).match(/<TableHead[ >]/g) || []).length
    expect(widths.length).toBe(heads)
    expect(widths.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('keeps the mobile card view and does not force page-level scrolling', () => {
    expect(AUDIT).toContain('hidden md:table table-fixed')
    expect(AUDIT).toContain('md:hidden')
    expect(AUDIT).not.toContain('overflow-x-scroll')
  })
})

describe('existing screen behaviour is preserved', () => {
  it('the ledger empty/loading rows span the two new columns', () => {
    expect(LEDGER).not.toContain('colSpan={9}')
    expect(LEDGER).toContain('colSpan={11}')
  })

  it('the orders table keeps its columns in the requested order', () => {
    const head = ORDERS.slice(ORDERS.indexOf('<TableHead>Order</TableHead>'))
    const order = ['Order', 'Customer', 'Store', 'Service', 'Items', 'Weight', 'Amount', 'Payment', 'Operational Stage', 'Created', 'Rating', 'Pickup', 'Delivery', 'Action']
    let at = -1
    for (const col of order) {
      const next = head.indexOf(`>${col}</TableHead>`)
      expect(next, `column ${col} missing`).toBeGreaterThan(-1)
      expect(next, `column ${col} out of order`).toBeGreaterThan(at)
      at = next
    }
  })

  it('Store Audit keeps Weight beside Service, before Pickup', () => {
    const head = AUDIT.slice(AUDIT.indexOf('<TableHead>Order No.</TableHead>'))
    expect(head.indexOf('>Service</TableHead>')).toBeLessThan(head.indexOf('>Weight</TableHead>'))
    expect(head.indexOf('>Weight</TableHead>')).toBeLessThan(head.indexOf('>Pickup</TableHead>'))
  })

  it('the ledger keeps Service and Weight before Invoice', () => {
    const head = LEDGER.slice(LEDGER.indexOf('>Order</th>'))
    expect(head.indexOf('>Service</th>')).toBeLessThan(head.indexOf('>Weight</th>'))
    expect(head.indexOf('>Weight</th>')).toBeLessThan(head.indexOf('>Invoice</th>'))
  })

  it('sorting keeps its scan progress and garment list intact', () => {
    expect(SORTING).toContain('{done} / {o.expected} scanned')
    expect(SORTING).toContain('garment{o.garments.length === 1 ? "" : "s"}')
  })
})
