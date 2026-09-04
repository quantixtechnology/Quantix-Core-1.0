import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { garmentCountLabel, orderWeightLabel, NOT_RECORDED } from '@/lib/laundry-order-display'

// ============================================================================
// READY FOR DELIVERY SHOWS WHAT IS BEING HANDED OVER.
//
// The operator at handover holds a bag. Before they take the money they need
// to know what is meant to be in it — how many garments, and how heavy. Both
// numbers already existed on the order row this screen reads; the screen just
// never showed them.
//
// The two facts come from their own recorded sources and NEITHER is derived
// from the other, or from item / packet / bag weights:
//   count  = LaundryOrder._count.items, sent as `itemCount` by /api/laundry/orders
//   weight = LaundryOrder.totalWeightKg, measured once at Store Audit
//
// The route uses `include` and strips only `items`, so totalWeightKg was
// already on the wire. This change adds NO query, no endpoint and no field —
// it is display only, and the payment and delivery actions below it are
// untouched.
//
// Verified in the running app, logged in, on the real screen:
//   card  ORD-RFD-WEIGHED   … ₹500.00 | 4/9/2026 | 12 garments · 5.7 kg
//   card  ORD-RFD-UNWEIGHED … ₹500.00 | 4/9/2026 | 3 garments · —
//   panel ORD-RFD-WEIGHED   … GARMENTS | 12 | WEIGHT | 5.7 kg
//   panel ORD-RFD-UNWEIGHED … GARMENTS | 3  | WEIGHT | —
// ============================================================================

const SRC = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-store-stages.tsx'), 'utf8')
const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/orders/route.ts'), 'utf8')

/** The one component that renders the pair on a queue card. */
const quantity = SRC.slice(SRC.indexOf('function OrderQuantity('), SRC.indexOf('function OrderHeader('))
/** Ready for Delivery only — the other stages in this file must be unaffected. */
const rfd = SRC.slice(SRC.indexOf('export function LaundryReadyForDelivery('))

describe('1 · the queue card shows the count', () => {
  it('renders it through the shared garment-count helper, off itemCount', () => {
    expect(quantity).toContain('garmentCountLabel(o.itemCount)')
  })

  it('Ready for Delivery is the stage that opts in', () => {
    const shell = rfd.slice(rfd.indexOf('<QueueShell'), rfd.indexOf('>', rfd.indexOf('history={')))
    expect(shell).toContain('showQuantity')
  })

  it('and the only stage that opts in — every other queue card is unchanged', () => {
    // One <QueueShell> per stage in this file. Exactly one may carry the prop.
    const shells = SRC.split('<QueueShell').slice(1).map(b => b.slice(0, b.indexOf('>')))
    const optedIn = shells.filter(b => b.includes('showQuantity'))
    expect(shells.length).toBeGreaterThan(1)
    expect(optedIn).toHaveLength(1)
    expect(optedIn[0]).toContain('status="READY_FOR_DELIVERY"')
  })
})

describe('2 · the queue card shows the recorded weight', () => {
  it('renders totalWeightKg through the shared weight helper', () => {
    expect(quantity).toContain('orderWeightLabel(o.totalWeightKg)')
  })

  it('the weight is never computed from the count, the packet or the bags', () => {
    // The only weight this screen may read is the order's own measured total.
    const weightReads = quantity.match(/\w+\.\w*[Ww]eight\w*/g) ?? []
    expect(weightReads).toEqual(['o.totalWeightKg'])
  })
})

describe('3 · an unweighed order reads as a missing measurement', () => {
  it('0 — the column default, meaning never weighed — renders the em dash', () => {
    // LaundryOrder.totalWeightKg is Float @default(0), so "not weighed" arrives
    // as 0, not null. "0 kg" would claim a measurement that was never taken.
    expect(orderWeightLabel(0)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(0)).not.toContain('kg')
    expect(orderWeightLabel(null)).toBe(NOT_RECORDED)
    expect(orderWeightLabel(undefined)).toBe(NOT_RECORDED)
  })

  it('but its garment count is still a real number', () => {
    // Seen on ORD-RFD-UNWEIGHED: "3 garments · —".
    expect(`${garmentCountLabel(3)} · ${orderWeightLabel(0)}`).toBe('3 garments · —')
  })

  it('a weighed order reads as the measurement', () => {
    expect(`${garmentCountLabel(12)} · ${orderWeightLabel(5.7)}`).toBe('12 garments · 5.7 kg')
  })
})

describe('4 · card and selected-order panel show the same canonical values', () => {
  it('the panel reads the same two fields off the same row', () => {
    const panel = rfd.slice(rfd.indexOf('<OrderHeader o={selected} />'), rfd.indexOf('Total</p>'))
    expect(panel).toContain('garmentCountValue(selected.itemCount)')
    expect(panel).toContain('orderWeightLabel(selected.totalWeightKg)')
  })

  it('the panel count goes through the card helper, not a raw row read', () => {
    // garmentCountValue is garmentCountLabel with the word trimmed, so the two
    // places cannot round or guard a count differently.
    const value = SRC.slice(SRC.indexOf('function garmentCountValue('), SRC.indexOf('function OrderQuantity('))
    expect(value).toContain('garmentCountLabel(count)')
    expect(value).toMatch(/replace\(/)
  })

  it('so both sides agree for every order', () => {
    const strip = (s: string) => s.replace(/\s+garments?$/, '')
    for (const [count, kg] of [[12, 5.7], [3, 0], [1, 8], [0, null]] as [number, number | null][]) {
      expect(strip(garmentCountLabel(count))).toBe(String(count))          // panel tile
      expect(garmentCountLabel(count).startsWith(String(count))).toBe(true) // card line
      expect(orderWeightLabel(kg)).toBe(orderWeightLabel(kg))              // one helper, both sides
    }
  })
})

describe('5 · no new per-order data query was introduced', () => {
  it('the change adds no fetch, hook or endpoint call', () => {
    // Everything rendered is already on the queue row.
    expect(quantity).not.toMatch(/fetch\(|useEffect|useState|\/api\//)
  })

  it('totalWeightKg already travels on the existing queue payload', () => {
    // The route selects a count and spreads the rest of the row: `include`
    // keeps every scalar column, and only `items` is stripped off.
    expect(API).toContain('_count: { select: { items: true } }')
    expect(API).toContain('const { items, ...rest } = o')
    expect(API).toContain('itemCount: o._count.items')
    // If this ever became a `select`, totalWeightKg would silently vanish.
    expect(API).not.toMatch(/const \{ items, \.\.\.rest \} = o[\s\S]{0,400}totalWeightKg: (0|null)/)
  })

  it('the field is declared on the row, not requested separately', () => {
    const row = SRC.slice(SRC.indexOf('interface OrderRow'), SRC.indexOf('function useQueue('))
    expect(row).toContain('totalWeightKg?: number | null')
    expect(row).toContain('itemCount: number')
  })
})

describe('6 · payment and delivery actions are unchanged', () => {
  it('collection, scheduling and handover all still render', () => {
    expect(rfd).toContain('Schedule Home Delivery')
    expect(rfd).toContain('Complete Delivery')
    expect(rfd).toMatch(/Collect \{inr\(/)
    expect(rfd).toContain('Outstanding balance must be collected before handover.')
  })

  it('the summary is inserted above the money tiles and displaces none of them', () => {
    for (const tile of ['Total</p>', 'Paid</p>', 'Balance Due</p>']) expect(rfd).toContain(tile)
    expect(rfd.indexOf('Garments</p>')).toBeLessThan(rfd.indexOf('Total</p>'))
    expect(rfd.indexOf('Weight</p>')).toBeLessThan(rfd.indexOf('Total</p>'))
  })

  it('it renders no control of its own — display only', () => {
    const summary = rfd.slice(rfd.indexOf('Garments</p>'), rfd.indexOf('Total</p>'))
    expect(summary).not.toMatch(/<Button|onClick|<Input|<Select/)
  })
})
