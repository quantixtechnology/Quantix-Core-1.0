// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

// ============================================================================
// ONE ORDER OWNS THE BAG PANEL, AND ITS CARD SHOWS THE RESULT.
//
// Two things have to hold at once for an operator working a queue of twenty
// orders. The panel they are typing into must belong to the order they clicked
// — visibly, in that card — and the moment a bag is scanned, that same card
// must say which bag it got, so "did I scan a bag for #15?" is answered by
// looking at #15 rather than remembered.
//
// The last page-level surface was BAG REQUIRED. It is raised by a GARMENT scan,
// and the line before it centres the queue on that order's card — so the
// operator was carried to the order while its input and Scan Bag QR button
// stayed at the top of the page, off-screen. Measured on a 1440x900 viewport:
// scanning a garment for order #15 left the prompt 1091px above the viewport.
//
// The state was already order-owned (`bagNeededFor.orderId`); only the mount
// point was wrong. These tests drive the real sequence in a browser and assert
// on ownership, DOM containment and position — not on source strings.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments describe the old placement and quote it. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

/** The deepest card in the fixture queue. */
const LAST = 20

const FIXTURE = 'file://' + join(process.cwd(), 'src/lib/__tests__/fixtures/sorting-bag-assignment.fixture.html')

let browser: Browser
let page: Page

/** Where a panel lives, and what its order card currently reads. */
async function probe(order: number) {
  return page.evaluate((i) => {
    const card = document.getElementById('order' + i)!
    const panel = document.querySelector(`[data-panel][data-order="${i}"]`)
    const strip = document.getElementById('strip')!
    const bagNo = card.querySelector('.bagNo')
    const scan = panel?.querySelector('.scanBag') as HTMLElement | null
    const r = scan?.getBoundingClientRect()
    const hit = r ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) : null
    return {
      scrollY: Math.round(scrollY),
      cardTop: Math.round(card.getBoundingClientRect().top),
      hasPanel: !!panel,
      panelInCard: panel ? card.contains(panel) : false,
      panelInStrip: panel ? strip.contains(panel) : false,
      stripPanels: strip.querySelectorAll('[data-panel]').length,
      banner: (card.querySelector('.bagbanner') as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      bagNumber: bagNo ? bagNo.textContent : null,
      scanTop: r ? Math.round(r.top) : null,
      scanInView: r ? r.top >= 0 && r.bottom <= innerHeight : false,
      scanClickable: hit ? hit.classList.contains('scanBag') : false,
      owner: (window as any).stateOwner(),
      neededOwner: (window as any).neededOwner(),
      siv: (window as any).__siv, focus: (window as any).__focus,
    }
  }, order)
}

async function reset(fixed = true) {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await page.evaluate((f) => { (window as any).FIXED = f }, fixed)
}
async function scrollTo(order: number) {
  await page.evaluate((i) => document.getElementById('order' + i)!.scrollIntoView({ block: 'center' }), order)
  await new Promise((r) => setTimeout(r, 60))
  await page.evaluate(() => { (window as any).__siv = 0; (window as any).__focus = 0 })
}
const click = (sel: string) => page.click(sel)

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
}, 60_000)
afterAll(async () => { await browser?.close() })

// ── The sequence the operator actually performs ────────────────────────────
describe('1 · order #15 → scan → order #16 → scan', () => {
  it('runs end to end with each card keeping its own bag', async () => {
    await reset()

    // 1-2. A queue of twenty, scrolled down to #15.
    await scrollTo(15)
    const start = await probe(15)
    expect(start.scrollY).toBeGreaterThan(0)
    expect(start.banner).toContain('BAG REQUIRED')
    expect(start.hasPanel).toBe(false)

    // 3-5. Assign First Bag on #15 → panel inside #15, nothing at page level.
    await click('#assign15')
    const opened15 = await probe(15)
    expect(opened15.owner).toBe(15)
    expect(opened15.panelInCard).toBe(true)
    expect(opened15.panelInStrip).toBe(false)
    expect(opened15.stripPanels).toBe(0)
    expect(opened15.scanClickable).toBe(true)
    expect(opened15.scrollY).toBe(start.scrollY)      // 15. no page jump
    expect(opened15.cardTop).toBe(start.cardTop)

    // 6-7. Scan a bag → #15 immediately reads it, panel closes.
    await click('[data-order="15"] .scanBag')
    const done15 = await probe(15)
    expect(done15.bagNumber).toBe('V8BAG115')
    expect(done15.banner).toContain('SORTING BAG ATTACHED')
    expect(done15.hasPanel).toBe(false)
    expect(done15.owner).toBe(null)

    // 8-10. Move to #16 and open its panel — in ITS card.
    await scrollTo(16)
    const before16 = await probe(16)
    expect(before16.banner).toContain('BAG REQUIRED')
    await click('#assign16')
    const opened16 = await probe(16)
    expect(opened16.owner).toBe(16)
    expect(opened16.panelInCard).toBe(true)
    expect(opened16.stripPanels).toBe(0)
    expect(opened16.scrollY).toBe(before16.scrollY)   // 15. still no jump
    expect(opened16.scanClickable).toBe(true)         // 16.

    // 11. …and #15 has not lost its bag, nor gained #16's panel.
    const still15 = await probe(15)
    expect(still15.bagNumber).toBe('V8BAG115')
    expect(still15.banner).toContain('SORTING BAG ATTACHED')
    expect(still15.hasPanel).toBe(false)

    // 12-14. Assign #16; both orders now hold their own, independent bag.
    await click('[data-order="16"] .scanBag')
    const done16 = await probe(16)
    const end15 = await probe(15)
    expect(done16.bagNumber).toBe('V8BAG116')
    expect(end15.bagNumber).toBe('V8BAG115')
    expect(done16.bagNumber).not.toBe(end15.bagNumber)
    expect(done16.hasPanel).toBe(false)

    // 11 (cont). No scroll or focus was performed by any of it.
    expect(done16.siv).toBe(0)
    expect(done16.focus).toBe(0)
  }, 60_000)
})

// ── The same, at the top, the second card, and deep in the list ────────────
describe('2 · first, second, lower and deep-list orders behave identically', () => {
  it.each([1, 2, 8, 15, 20])('order #%i owns its own panel and keeps its bag', async (n) => {
    await reset()
    await scrollTo(n)
    const before = await probe(n)
    await click('#assign' + n)
    const opened = await probe(n)
    expect(opened.owner).toBe(n)
    expect(opened.panelInCard).toBe(true)
    expect(opened.stripPanels).toBe(0)
    // The page never moves, whichever order it is.
    expect(opened.scrollY).toBe(before.scrollY)
    expect(opened.cardTop).toBe(before.cardTop)
    if (n === LAST) {
      // The last card in a fully scrolled list: opening the panel lengthens the
      // document (4496 -> 4595 measured), so its scanner sits just past the fold
      // at 912px on a 900px viewport. Nothing jumped and nothing moved to the
      // strip — the operator scrolls the remaining 99px and it is there.
      expect(opened.scanTop).toBeGreaterThan(0)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await new Promise((r) => setTimeout(r, 80))
    }
    const reachable = await probe(n)
    expect(reachable.scanInView).toBe(true)
    expect(reachable.scanClickable).toBe(true)
    await click(`[data-order="${n}"] .scanBag`)
    const after = await probe(n)
    expect(after.bagNumber).toBe('V8BAG' + (100 + n))
    expect(after.hasPanel).toBe(false)
  }, 60_000)
})

// ── Second bag, from a card deep in the list ───────────────────────────────
describe('3 · the second-bag flow stays with its order too', () => {
  it('#15 already holding a bag opens its next panel in its own card', async () => {
    await reset()
    await scrollTo(15)
    await click('#assign15')
    await click('[data-order="15"] .scanBag')
    const held = await probe(15)
    expect(held.bagNumber).toBe('V8BAG115')

    const before = await probe(15)
    await click('#assign15')                      // now reads "Add New Bag"
    const opened = await probe(15)
    expect(opened.owner).toBe(15)
    expect(opened.panelInCard).toBe(true)
    expect(opened.stripPanels).toBe(0)
    expect(opened.scrollY).toBe(before.scrollY)
    expect(opened.scanClickable).toBe(true)
  }, 60_000)
})

// ── The scan-driven prompt, which was the surface still at page level ──────
describe('4 · BAG REQUIRED from a garment scan', () => {
  it('the old placement left it off-screen after locate() moved the operator', async () => {
    // Proof the harness reproduces the reported problem before it is fixed.
    await reset(false)
    await page.evaluate(() => (window as any).garmentScan(15))
    await new Promise((r) => setTimeout(r, 120))
    const r = await probe(15)
    expect(r.neededOwner).toBe(15)
    expect(r.panelInStrip).toBe(true)
    expect(r.panelInCard).toBe(false)
    expect(r.scanTop).toBeLessThan(0)          // above the viewport
    expect(r.scanInView).toBe(false)
    expect(r.scanClickable).toBe(false)
  }, 60_000)

  it('now it is answered inside the order it names', async () => {
    await reset(true)
    await page.evaluate(() => (window as any).garmentScan(15))
    await new Promise((r) => setTimeout(r, 120))
    const r = await probe(15)
    expect(r.neededOwner).toBe(15)
    expect(r.panelInCard).toBe(true)
    expect(r.panelInStrip).toBe(false)
    expect(r.stripPanels).toBe(0)
    expect(r.scanInView).toBe(true)
    expect(r.scanClickable).toBe(true)
    // …and assigning from it puts the bag on that order.
    await click('[data-order="15"] .scanBag')
    const after = await probe(15)
    expect(after.bagNumber).toBe('V8BAG115')
    expect(after.hasPanel).toBe(false)
  }, 60_000)
})

// ── What the component itself declares ────────────────────────────────────
describe('5 · every interactive bag surface is order-scoped in the component', () => {
  it('all three mount on the order that owns them', () => {
    expect(code).toContain('{addBagFor?.orderId === o.orderId && (')
    expect(code).toContain('{confirmSecondBag?.orderId === o.orderId && (')
    expect(code).toContain('{bagNeededFor?.orderId === o.orderId && (')
  })

  it('and none of them render unconditionally at page level any more', () => {
    for (const s of ['{addBagFor && (', '{confirmSecondBag && (', '{bagNeededFor && (']) {
      expect(code, s).not.toContain(s)
    }
  })

  it('the only page-level remnant is a no-card fallback that carries no scanner', () => {
    const start = code.indexOf('{bagNeededOrphan && (')
    expect(start).toBeGreaterThan(-1)
    const block = code.slice(start, code.indexOf(')}', code.indexOf('Dismiss', start)))
    for (const w of ['BagScanButton', '<input', 'assignOrderBag', 'Add bag']) expect(block, w).not.toContain(w)
    expect(code).toContain('const bagNeededOrphan = !!bagNeededFor && !visibleOrders.some((o) => o.orderId === bagNeededFor.orderId)')
  })

  it('no scroll, focus or timing was added to reposition anything', () => {
    const before = SORT.split('bagNeededOrphan')[0]
    expect(before).not.toContain('autoFocus')
    expect((code.match(/scrollIntoView/g) || []).length).toBe(1)   // locate() only
    expect((code.match(/\.focus\(/g) || []).length).toBe(0)
    expect(code).not.toContain('scrollTo(')
  })
})

// ── Untouched ─────────────────────────────────────────────────────────────
describe('6 · assignment, scanning and completion are unchanged', () => {
  it('the one assignment call and its guards still stand', () => {
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
    expect(code).toContain('action: "assign_bag"')
    expect(code).toContain('custodian: "PROCESSING_CENTER"')
  })

  it('the prompt is still raised by the same scan branch', () => {
    expect(code).toContain('setBagNeededFor(bag ? null : record)')
    expect(code).toContain('if (c) assignOrderBag(c, bagNeededFor)')
  })

  it('the first/second bag rule and the completion gate still stand', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)\n                        else setAddBagFor(target)')
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
  })
})
