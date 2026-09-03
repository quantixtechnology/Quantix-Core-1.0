// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

// ============================================================================
// THE SAME PANEL, IN THE SAME PLACE, FOR EVERY ORDER IN THE QUEUE.
//
// Assigning a bag is one interaction, and it must not behave differently
// because of where an order happens to sit in a queue of fifty. Whatever the
// operator clicks — the first card, the fifteenth, the fiftieth — the panel
// opens in that card, the page does not move, and the bag lands on that order.
//
// Existing coverage proved this for orders up to #20. This carries it to #50,
// the depth at which the old page-level placements were most damaging, and
// pins the single-active-panel rule: opening a panel on one order closes the
// one before it without disturbing the bag that order already holds.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments describe the old placements and quote them. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

/** A 50-order queue: #50 sits far below the fold on any viewport. */
const FIXTURE = 'file://' + join(process.cwd(), 'src/lib/__tests__/fixtures/sorting-bag-assignment.fixture.html') + '?n=50'
const ORDERS = [1, 2, 3, 15, 20, 50] as const
/** The deepest card. Opening its panel lengthens an already fully-scrolled
 *  document, so the scanner lands just past the fold — measured at 912px on a
 *  900px viewport. Nothing jumps and nothing moves to the strip; the operator
 *  scrolls the last 99px. Asserted as such rather than pretended away. */
const LAST = 50

let browser: Browser
let page: Page

async function reset() {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await page.evaluate(() => { (window as any).FIXED = true; (window as any).FIXED_FEEDBACK = true })
}

async function scrollTo(order: number) {
  await page.evaluate((i) => document.getElementById('order' + i)!.scrollIntoView({ block: 'center' }), order)
  await new Promise((r) => setTimeout(r, 60))
  await page.evaluate(() => { (window as any).__siv = 0; (window as any).__focus = 0 })
}

async function probe(order: number) {
  return page.evaluate((i) => {
    const card = document.getElementById('order' + i)!
    const strip = document.getElementById('strip')!
    const panel = document.querySelector(`[data-panel][data-order="${i}"]`)
    const scan = panel?.querySelector('.scanBag') as HTMLElement | null
    const r = scan?.getBoundingClientRect()
    const hit = r ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) : null
    const bagNo = card.querySelector('.bagNo')
    return {
      scrollY: Math.round(scrollY),
      cardTop: Math.round(card.getBoundingClientRect().top),
      panelOpen: !!panel,
      panelInCard: panel ? card.contains(panel) : false,
      // Every interactive bag surface anywhere above the two columns.
      pageLevelPanels: strip.querySelectorAll('[data-panel]').length,
      scanInCard: scan ? card.contains(scan) : false,
      scanInView: r ? r.top >= 0 && r.bottom <= innerHeight : false,
      cardVisible: card.getBoundingClientRect().top < innerHeight && card.getBoundingClientRect().bottom > 0,
      scanClickable: hit ? hit.classList.contains('scanBag') : false,
      bag: bagNo ? bagNo.textContent : null,
      banner: (card.querySelector('.bagbanner') as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      owner: (window as any).stateOwner(),
      siv: (window as any).__siv, focus: (window as any).__focus,
    }
  }, order)
}

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
}, 60_000)
afterAll(async () => { await browser?.close() })

describe('1 · the queue really is 50 deep', () => {
  it('renders every order, unsliced', async () => {
    await reset()
    const n = await page.evaluate(() => document.querySelectorAll('.order').length)
    expect(n).toBe(50)
    const deep = await page.evaluate(() => Math.round(document.getElementById('order50')!.getBoundingClientRect().top))
    expect(deep).toBeGreaterThan(900)   // below the fold before scrolling
  }, 60_000)
})

describe('2 · Assign First Bag opens in the clicked card, at any depth', () => {
  it.each(ORDERS)('order #%i', async (n) => {
    await reset()
    await scrollTo(n)
    const before = await probe(n)
    expect(before.panelOpen).toBe(false)
    expect(before.banner).toContain('BAG REQUIRED')

    await page.click('#assign' + n)
    const open = await probe(n)

    expect(open.owner).toBe(n)                  // this order owns the panel
    expect(open.panelInCard).toBe(true)         // 3. panel is inside the card
    expect(open.pageLevelPanels).toBe(0)        // no page-level panel
    expect(open.scrollY).toBe(before.scrollY)   // 4. page did not jump
    expect(open.cardTop).toBe(before.cardTop)
    expect(open.scanInCard).toBe(true)          // 5. Scan Laundry Bag is this order's
    expect(open.cardVisible).toBe(true)         // the order stays on screen
    if (n === LAST) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await new Promise((r) => setTimeout(r, 80))
    }
    const reachable = await probe(n)
    expect(reachable.scanInView).toBe(true)
    expect(reachable.scanClickable).toBe(true)
    expect(open.siv).toBe(0)                    // no scroll or focus workaround
    expect(open.focus).toBe(0)
  }, 60_000)

  it.each(ORDERS)('order #%i closes cleanly on Cancel, changing nothing', async (n) => {
    await reset()
    await scrollTo(n)
    const before = await probe(n)
    await page.click('#assign' + n)
    await page.click(`[data-order="${n}"] .cancelBag`)         // 6. close/cancel
    const after = await probe(n)
    expect(after.panelOpen).toBe(false)
    expect(after.owner).toBe(null)
    expect(after.bag).toBe(null)                                // nothing assigned
    expect(after.banner).toContain('BAG REQUIRED')
    expect(after.scrollY).toBe(before.scrollY)
  }, 60_000)
})

describe('3 · moving between orders leaves the previous one intact', () => {
  it('walks 1 → 2 → 3 → 15 → 20 → 50, each keeping its own bag', async () => {
    await reset()
    const given: Record<number, string> = {}

    for (const n of ORDERS) {
      await scrollTo(n)
      const before = await probe(n)
      await page.click('#assign' + n)                           // 7/8. move + repeat
      const open = await probe(n)
      expect(open.owner).toBe(n)
      expect(open.panelInCard).toBe(true)
      expect(open.pageLevelPanels).toBe(0)
      expect(open.scrollY).toBe(before.scrollY)                 // never jumps

      await page.click(`[data-order="${n}"] .scanBag`)
      const done = await probe(n)
      expect(done.bag).toBe('V8BAG' + (100 + n))
      expect(done.banner).toContain('SORTING BAG ATTACHED')
      expect(done.panelOpen).toBe(false)
      given[n] = done.bag!

      // 9. every order visited so far still holds exactly what it was given.
      for (const [k, bag] of Object.entries(given)) {
        expect((await probe(Number(k))).bag, `order #${k}`).toBe(bag)
      }
    }
    expect(Object.keys(given)).toHaveLength(6)
  }, 90_000)

  it('only one panel is open at a time — the existing single-active rule', async () => {
    await reset()
    await scrollTo(15)
    await page.click('#assign15')
    expect((await probe(15)).panelOpen).toBe(true)

    await scrollTo(50)
    await page.click('#assign50')                               // opening #50…
    const deep = await probe(50)
    const prev = await probe(15)
    expect(deep.owner).toBe(50)
    expect(deep.panelInCard).toBe(true)
    expect(prev.panelOpen).toBe(false)                          // …closes #15's
    expect(prev.banner).toContain('BAG REQUIRED')               // and changes nothing
    expect(prev.bag).toBe(null)
  }, 60_000)
})

describe('4 · the additional-bag flow is order-scoped at depth too', () => {
  it('#50 with a bag: confirmation, then the panel, both inside #50', async () => {
    await reset()
    await scrollTo(50)
    await page.click('#assign50')
    await page.click('[data-order="50"] .scanBag')
    const held = await probe(50)
    expect(held.bag).toBe('V8BAG150')

    // The button now reads Add New Bag; the confirmation belongs to this card.
    const before = await probe(50)
    await page.click('#assign50')
    const asked = await probe(50)
    expect(asked.owner).toBe(50)
    expect(asked.panelInCard).toBe(true)
    expect(asked.pageLevelPanels).toBe(0)
    expect(asked.scrollY).toBe(before.scrollY)
    expect(asked.scanInCard).toBe(true)
    expect(asked.cardVisible).toBe(true)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await new Promise((r) => setTimeout(r, 80))
    const reach = await probe(50)
    expect(reach.scanInView).toBe(true)
    expect(reach.scanClickable).toBe(true)
    // …and the bag it already holds is still shown on the same card.
    expect(asked.bag).toBe('V8BAG150')
  }, 60_000)
})

describe('5 · the component mounts every bag surface on its owning order', () => {
  it('all three interactive surfaces are order-guarded', () => {
    expect(code).toContain('{addBagFor?.orderId === o.orderId && (')
    expect(code).toContain('{confirmSecondBag?.orderId === o.orderId && (')
    expect(code).toContain('{bagNeededFor?.orderId === o.orderId && (')
  })

  it('and the feedback that answers them is too', () => {
    expect(code).toContain('{bagAssigned?.orderNumber === o.orderNumber && (')
    expect(code).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "SERVICE" && (')
    expect(code).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "BAG" && (')
  })

  it('no bag surface renders unconditionally at page level', () => {
    for (const s of ['{addBagFor && (', '{confirmSecondBag && (', '{bagNeededFor && (',
                     '{bagAssigned && (', '{wrongBag && wrongBag.kind === "SERVICE" && (',
                     '{wrongBag && wrongBag.kind === "BAG" && (']) {
      expect(code, s).not.toContain(s)
    }
  })

  it('the button that opens them lives on the order row', () => {
    expect(code).toContain('onClick={() => onAdd(svc.id, svc.name, hasBag)}')
    expect(code).toContain('hasBag ? <><Plus className="h-3 w-3" /> Add New Bag</> : <><Plus className="h-3 w-3" /> Assign First Bag</>')
  })

  it('the whole queue is rendered — a deep order is never omitted', () => {
    expect(code).toContain('visibleOrders.map((o) => {')
    expect(code).not.toMatch(/visibleOrders\s*\.\s*slice\(/)
  })

  it('and nothing repositions the page', () => {
    expect((code.match(/scrollIntoView/g) || []).length).toBe(1)   // locate() only
    expect((code.match(/\.focus\(/g) || []).length).toBe(0)
    expect(code).not.toContain('scrollTo(')
    expect(code).not.toContain('autoFocus')
  })
})

describe('6 · backend, scanner and bag rules are the deployed ones', () => {
  it('one assignment call, unchanged guards', () => {
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
    expect(code).toContain('action: "assign_bag"')
    expect(code).toContain('custodian: "PROCESSING_CENTER"')
  })

  it('first/second bag rule and the completion gate stand', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)\n                        else setAddBagFor(target)')
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    expect(code).toContain('setBagNeededFor(bag ? null : record)')
  })
})
