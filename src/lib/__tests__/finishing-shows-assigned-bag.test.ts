import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// IRON AND FOLDING NAME THE BAG THE ORDER IS CARRYING.
//
// The bag assigned at Sorting travels with the order all the way through
// processing, but the finishing stations showed only the container code —
// PKG-202609-000001 — so an operator holding that bag had nothing on screen to
// match it against.
//
// The relationship was already stored and already canonical: the order's bags
// come from LaundryBagAssignment, "the ONE authoritative view of which physical
// bags belong to this order… Sorting establishes the plan, Packing & QR may add
// to it, and Processing / Delivery / the next Pickup all read the same rows".
// This reads those rows and prints the numbers. Nothing assigns, moves,
// releases or re-purposes a bag.
//
// Verified against the running app: a FOLD order with one Sorting bag lists and
// loads as V8BAGDISPFOLD1, an IRON order with two lists and loads as
// V8BAGDISPIRON1 + V8BAGDISPIRON2, and both render on screen at their station.
// ============================================================================

const API = readFileSync(join(process.cwd(), 'src/app/api/laundry/processing/finishing/route.ts'), 'utf8')
const WS = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-finishing-workstation.tsx'), 'utf8')
const BAGS = readFileSync(join(process.cwd(), 'src/lib/laundry-order-bags.ts'), 'utf8')

describe('1 · the bag comes from the canonical relationship, not a new one', () => {
  it('the finishing API reads the order-bag helpers, nothing bespoke', () => {
    expect(API).toContain('import { orderBags, orderBagsForOrders } from "@/lib/laundry-order-bags"')
    // No second query shape for the same question.
    expect(API).not.toMatch(/laundryBagAssignment\.findMany/)
  })

  it('both helpers read LaundryBagAssignment with the same scope and order', () => {
    const single = BAGS.slice(BAGS.indexOf('export async function orderBags('), BAGS.indexOf('export async function orderBagsForOrders('))
    const batch = BAGS.slice(BAGS.indexOf('export async function orderBagsForOrders('), BAGS.indexOf('/** How many bags this order currently has'))
    for (const fn of [single, batch]) {
      expect(fn).toContain('prisma.laundryBagAssignment.findMany')
      expect(fn).toContain('businessId: lbId')
      expect(fn).toContain('orderBy: { assignedAt: "asc" }')
      expect(fn).toMatch(/r\.bag\.businessId (===|!==) lbId/)   // tenant guard in both
      expect(fn).toContain('open: r.status === OPEN_ASSIGNMENT')
    }
    // The batch form differs only by the `in` filter.
    expect(batch).toContain('orderId: { in: orderIds }')
  })

  it('an open assignment is the one status the system already calls open', () => {
    expect(BAGS).toContain('const OPEN_ASSIGNMENT = "ASSIGNED"')
  })
})

describe('2 · both stations show it — they are one component and one route', () => {
  it('the loaded container carries the order bags', () => {
    expect(API).toContain('bags: (await orderBags(businessId, pkg.orderId))')
    expect(API).toContain('.filter((b) => b.open)')
  })

  it('every waiting row carries them too, read once for the whole list', () => {
    expect(API).toContain('const bagsByOrder = await orderBagsForOrders(biz.id, allOrderIds)')
    expect(API).toContain('bags: (bagsByOrder.get(pkg.orderId) || [])')
  })

  it('the workstation renders them in the loaded card and in the list', () => {
    // Both sites now hand their bags to the shared OrderIdentity block, which
    // renders BagNumbers — one layout for the card and the header, so the two
    // cannot describe the same order differently.
    expect(WS).toContain('bags={active.bags}')      // loaded header
    expect(WS).toContain('bags={c.bags}')           // waiting row
    expect(WS).toContain('<BagNumbers bags={bags} />')
  })

  it('one renderer, so the two places cannot disagree', () => {
    expect((WS.match(/function BagNumbers\(/g) || []).length).toBe(1)
    expect(WS).toContain('type BagRef = { bagNumber: string; purpose: string | null; serviceName: string | null }')
  })

  it('IRON and FOLD share that component and route, so neither is left out', () => {
    const ROUTER = readFileSync(join(process.cwd(), 'src/components/laundry/laundry-page-router.tsx'), 'utf8')
    expect(ROUTER).toContain('case "ws-iron": return <LaundryFinishingWorkstation stage="IRON" />')
    expect(ROUTER).toContain('case "ws-fold": return <LaundryFinishingWorkstation stage="FOLD" />')
    expect(API).toContain('const STAGE_SCREEN: Record<string, string> = { IRON: "ironing", FOLD: "folding" }')
  })
})

describe('3 · every assigned bag is shown, not just the first', () => {
  it('the renderer maps the whole list', () => {
    const fn = WS.slice(WS.indexOf('function BagNumbers('), WS.indexOf('const fmt ='))
    expect(fn).toContain('bags.map((b) =>')
    expect(fn).not.toMatch(/bags\[0\]/)
    expect(fn).toContain('key={b.bagNumber}')
  })

  it('an order with no open bag renders nothing rather than a placeholder', () => {
    const fn = WS.slice(WS.indexOf('function BagNumbers('), WS.indexOf('const fmt ='))
    expect(fn).toContain('if (!bags.length) return null')
  })
})

describe('4 · display only — the workflow is untouched', () => {
  it('the finishing route writes no bag state that it did not already write', () => {
    // It never assigns, releases or records an assignment.
    for (const w of ['laundryBagAssignment.create', 'laundryBagAssignment.update', 'assignBagToOrder', 'releaseBagsForOrder', 'addBagToOrder']) {
      expect(API, w).not.toContain(w)
    }
    // The one pre-existing bag write stays exactly as it was: clearing a stale
    // currentOrderId when a scanned bag still points at a delivered or
    // cancelled order. Untouched by the display change, and still the only one.
    expect((API.match(/prisma\.laundryBag\.updateMany/g) || []).length).toBe(1)
    expect(API).toContain('data: { status: "AVAILABLE", currentOrderId: null, currentOrderNumber: null, currentServiceId: null, currentServiceName: null, ...custodyFor("AVAILABLE", { storeId: null }) },')
  })

  it('scanning, the mode gate and the container lookup are unchanged', () => {
    expect(API).toContain('scanModeAcceptance(c, mode, byPackage ? { reusedBagQr: byPackage.reusedBagQr } : null)')
    expect(API).toContain('where: { businessId: biz.id, OR: [{ code: c }, { qrValue: c }] },')
    expect(API).toContain('if (modeError) return NextResponse.json({ success: false, error: modeError }, { status: 409 })')
  })

  it('the stage still decides what is listed and what is workable', () => {
    expect(API).toContain('processingStage: stage },')
    expect(API).toContain('atThisStage: i.processingStage === stage')
  })

  it('garment actions still go through the one existing endpoint', () => {
    expect(WS).toContain('/api/laundry/items/${itemId}/process')
  })

  it('the bag lifecycle helper is not imported here at all', () => {
    expect(API).not.toContain('from "@/lib/laundry-bag-assign"')
  })
})
