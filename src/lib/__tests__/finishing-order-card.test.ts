import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// THE FINISHING CARD IS ABOUT THE ORDER, NOT THE CONTAINER.
//
// Containers Waiting led with the container's own code — PKG-202609-000001 —
// and in a workspace that never issues Processing Packets that is an
// identifier nobody holds, prints or asks for. What the operator needs to
// match the trolley in front of them is the order number, the bags on it, whose
// it is, how much there is and when it is due.
//
// So the order number leads, the bags sit beside it, and the packet code
// appears only where the workspace actually issues one. Every value already
// travels on the payload or comes off the order row the route already reads —
// no new query, no new relationship, and the delivery promise comes from the
// one helper that also decides it on the order page and in reports.
//
// Verified against the running app at both stations, in both modes:
//   FOLD  order=ORD-BAGDISP-FOLD bags=[V8BAGDISPFOLD1]            qty=3 kg=6.4
//   IRON  order=ORD-BAGDISP-IRON bags=[…IRON1, …IRON2]            qty=3 kg=6.4
//   delivery="05 Sept 2026 · 2:00 PM - 3:00 PM"
//   PKG on screen: false under REUSE_BAG, true under GENERATE_NEW
// ============================================================================

const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/finishing/route.ts'), 'utf8')
const WS = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-finishing-workstation.tsx'), 'utf8')

/** The card body, where the ordering of fields is decided. */
const identity = WS.slice(WS.indexOf('function OrderIdentity('), WS.indexOf('function BagNumbers('))

describe('1 · the order number leads', () => {
  it('it is the first thing the identity block renders, and the boldest', () => {
    expect(identity).toContain('{orderNumber || "—"}')
    expect(identity).toMatch(/font-mono font-bold text-slate-900/)
    // Bags come immediately after it, in the same row.
    expect(identity.indexOf('{orderNumber || "—"}')).toBeLessThan(identity.indexOf('<BagNumbers bags={bags} />'))
  })

  it('both the waiting card and the loaded header use that same block', () => {
    expect(WS).toContain('<OrderIdentity\n                        dense')          // waiting row
    expect(WS).toContain('orderNumber={active.order.orderNumber}')                 // loaded header
    expect((WS.match(/function OrderIdentity\(/g) || []).length).toBe(1)
  })
})

describe('2 · every field the operator asked for is on the card', () => {
  it('customer, quantity, weight and delivery all render', () => {
    expect(identity).toContain('{customer}')
    expect(identity).toContain('garmentCountLabel(count)')
    expect(identity).toContain('orderWeightLabel(weightKg)')
    expect(identity).toContain('Delivery {delivery.line}')
  })

  it('quantity and weight use the shared labels, so 0 kg reads as not recorded', () => {
    expect(WS).toContain('import { orderWeightLabel, garmentCountLabel } from "@/lib/laundry-order-display"')
  })

  it('all of them are passed at both call sites', () => {
    for (const prop of ['customer=', 'count=', 'weightKg=', 'delivery=', 'bags=']) {
      expect((WS.match(new RegExp(prop.replace('=', '=\\{'), 'g')) || []).length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('3 · the packet code is hidden where the workspace does not issue one', () => {
  it('visibility follows the workspace mode, not a hardcoded choice', () => {
    expect(WS).toContain('const usesPacket = mode !== "REUSE_BAG"')
  })

  it('both the card and the header gate the code on it', () => {
    expect(WS).toContain('{usesPacket && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{c.code}</p>}')
    expect(WS).toContain('{usesPacket && (\n                        <span className="font-mono text-[11px] text-slate-400">{active.package.code}</span>\n                      )}')
  })

  it('and when shown it is secondary — smaller and muted, never the heading', () => {
    // The order number is text-[15px]/[13px] bold slate-900; the packet is
    // text-[10px]/[11px] slate-400.
    expect(WS).toMatch(/text-\[1[01]px\] text-slate-400[^>]*>\{(c\.code|active\.package\.code)\}/)
  })
})

describe('4 · the data comes from what the route already reads', () => {
  it('weight and the promise are extra columns on the existing order queries', () => {
    expect(API).toContain('const ORDER_CARD_SELECT = {')
    expect(API).toContain('totalWeightKg: true,')
    // Same constant spread into both existing selects — not a third query.
    expect((API.match(/\.\.\.ORDER_CARD_SELECT/g) || []).length).toBe(2)
    expect(API).not.toMatch(/laundryOrder\.findMany[\s\S]{0,200}laundryOrder\.findMany/)
  })

  it('the delivery promise is the shared definition, not a local one', () => {
    expect(API).toContain('import { deliveryPromise, formatPromiseLine } from "@/lib/laundry-delivery-promise"')
    expect(API).toContain('const p = deliveryPromise(o as never)')
    expect(API).toContain('formatPromiseLine(shown.date, shown.slot)')
    // A reschedule is what the floor works to, so it wins over the frozen promise.
    expect(API).toContain('const shown = p.rescheduled?.date ? p.rescheduled : p.primary')
  })

  it('both payloads carry the same fields', () => {
    expect(API).toContain('weightKg: order.totalWeightKg ?? null,')
    expect(API).toContain('delivery: deliveryRef(order),')
    expect(API).toContain('weightKg: o?.totalWeightKg ?? null,')
    expect(API).toContain('delivery: o ? deliveryRef(o) : null,')
  })
})

describe('5 · IRON and FOLD, and every assigned bag', () => {
  it('one component serves both stations', () => {
    const ROUTER = readFileSync(join(process.cwd(), 'src/components/laundry/laundry-page-router.tsx'), 'utf8')
    expect(ROUTER).toContain('case "ws-iron": return <LaundryFinishingWorkstation stage="IRON" />')
    expect(ROUTER).toContain('case "ws-fold": return <LaundryFinishingWorkstation stage="FOLD" />')
  })

  it('the bag list is still rendered whole', () => {
    const bagFn = WS.slice(WS.indexOf('function BagNumbers('), WS.indexOf('const fmt ='))
    expect(bagFn).toContain('bags.map((b) =>')
    expect(bagFn).not.toMatch(/bags\[0\]/)
  })
})

describe('6 · presentation only', () => {
  it('Load still calls the same resolver with the container id', () => {
    expect(WS).toContain('onClick={() => resolve(undefined, c.id)}')
  })

  it('scanning, the mode gate and the transitions are untouched', () => {
    expect(API).toContain('scanModeAcceptance(c, mode, byPackage ? { reusedBagQr: byPackage.reusedBagQr } : null)')
    expect(API).toContain('processingStage: stage },')
    expect(API).toContain('atThisStage: i.processingStage === stage')
    expect(WS).toContain('/api/laundry/items/${itemId}/process')
  })

  it('no bag or order state is written here', () => {
    for (const w of ['laundryOrder.update', 'laundryBagAssignment.create', 'laundryBagAssignment.update', 'assignBagToOrder', 'releaseBagsForOrder']) {
      expect(API, w).not.toContain(w)
    }
  })
})
