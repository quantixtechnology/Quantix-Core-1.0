// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

// ============================================================================
// THE SECOND-BAG QUESTION IS ASKED WHERE IT WAS RAISED.
//
// Clicking "Add New Bag" on an order used to raise the confirmation in the
// banner strip ABOVE the two columns. For the first order on screen that reads
// fine — the strip is already in view. For every order below it the question
// was inserted at the top of the document, hundreds or thousands of pixels
// above the operator: measured on a 1440x900 viewport with the real column
// layout, the confirmation rendered 219px above the viewport for order 2, and
// 1935px, 2507px and 2687px above it for orders 8, 10 and 12. To answer, the
// operator had to leave the order and scroll to the top; dismissing the strip
// block then collapsed the page to scrollY 0, so the panel that opened landed
// out of reach for every order past the second.
//
// The fix is positional only. Same question, same two buttons, same handlers,
// same state — it now renders inside the card whose button raised it, so the
// answer is given next to the order it is about, and the scan panel that opens
// on Yes appears in that same card.
//
// A source-string test alone could not catch this: the previous placement was
// also "correctly written JSX in the component". Only layout can tell you where
// the operator's eyes end up, so this measures it in a real browser.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments describe the old placement and may quote it. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const FIXTURE = 'file://' + join(process.cwd(), 'src/lib/__tests__/fixtures/sorting-order-list.fixture.html')
/** #1-#3 are on the first screen; #8, #10 and #12 are the ones that jumped. */
const ORDERS = [1, 2, 3, 8, 10, 12] as const

type Reading = {
  before: { y: number; cardTop: number; buttonTop: number }
  confirm: { y: number; cardTop: number; top: number; inView: boolean; insideCard: boolean }
  scan: { y: number; cardTop: number; top: number; inView: boolean; clickable: boolean; insideCard: boolean }
  scrollIntoViewCalls: number
  focusCalls: number
  sameCardNode: boolean
}

let browser: Browser
/** Both placements, measured once each, then asserted over. */
const strip = new Map<number, Reading>()
const inCard = new Map<number, Reading>()

/** Click Add New Bag on order `n`, reading the page at each step. */
async function run(page: Page, n: number, fixed: boolean): Promise<Reading> {
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await page.evaluate((f) => { (window as any).FIXED = f; (window as any).SECOND = true }, fixed)
  // Put the order on screen the way an operator scrolling the queue would.
  await page.evaluate((i) => document.getElementById('assign' + i)!.scrollIntoView({ block: 'center' }), n)
  await new Promise((r) => setTimeout(r, 80))
  // Count only what the click itself does.
  await page.evaluate(() => { (window as any).__siv = 0; (window as any).__focus = 0 })

  const before = await page.evaluate((i) => ({
    y: Math.round(scrollY),
    cardTop: Math.round(document.getElementById('order' + i)!.getBoundingClientRect().top),
    buttonTop: Math.round(document.getElementById('assign' + i)!.getBoundingClientRect().top),
  }), n)

  await page.click('#assign' + n)
  await new Promise((r) => setTimeout(r, 140))
  const confirm = await page.evaluate((i) => {
    const card = document.getElementById('order' + i)!
    const el = document.getElementById('confirmBlock')!
    const r = el.getBoundingClientRect()
    return {
      y: Math.round(scrollY), cardTop: Math.round(card.getBoundingClientRect().top),
      top: Math.round(r.top), inView: r.top >= 0 && r.bottom <= innerHeight,
      insideCard: card.contains(el),
    }
  }, n)

  await page.click('#yesSecond')
  await new Promise((r) => setTimeout(r, 140))
  const rest = await page.evaluate((i) => {
    const card = document.getElementById('order' + i)!
    const el = document.getElementById('scanBag')!
    const r = el.getBoundingClientRect()
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2))
    return {
      scan: {
        y: Math.round(scrollY), cardTop: Math.round(card.getBoundingClientRect().top),
        top: Math.round(r.top), inView: r.top >= 0 && r.bottom <= innerHeight,
        clickable: hit ? hit.id === 'scanBag' : false, insideCard: card.contains(el),
      },
      scrollIntoViewCalls: (window as any).__siv as number,
      focusCalls: (window as any).__focus as number,
      // The card is keyed by orderId, so opening a panel must not replace it.
      sameCardNode: card === document.getElementById('order' + i),
    }
  }, n)
  return { before, confirm, ...rest }
}

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  for (const n of ORDERS) {
    strip.set(n, await run(page, n, false))
    inCard.set(n, await run(page, n, true))
  }
  await page.close()
}, 120_000)

afterAll(async () => { await browser?.close() })

describe('1 · the old placement really did throw the operator to the top', () => {
  // Without this the fixture proves nothing: a harness that never reproduces
  // the bug cannot demonstrate that it is gone.
  it.each([2, 3, 8, 10, 12])('order #%i raised the question above the viewport', (n) => {
    const r = strip.get(n)!
    expect(r.before.y).toBeGreaterThan(0)
    expect(r.confirm.inView).toBe(false)
    // Off the top of the screen by the full distance the operator had scrolled.
    expect(r.confirm.top).toBeLessThan(0)
  })

  it.each([3, 8, 10, 12])('order #%i then collapsed to the top of the page', (n) => {
    // Removing the strip block un-anchors the scroll: the page falls to 0 and
    // the order the operator was working on is gone from the screen.
    const r = strip.get(n)!
    expect(r.scan.y).toBe(0)
    expect(r.scan.inView).toBe(false)
  })

  it('order #1 did not, because the strip was already in view', () => {
    // Why this was reported as "sometimes" rather than "always".
    expect(strip.get(1)!.before.y).toBe(0)
    expect(strip.get(1)!.confirm.inView).toBe(true)
  })
})

describe('2 · Add New Bag now leaves the page where the operator left it', () => {
  it.each([1, 2, 3, 8, 10])('order #%i does not scroll at all', (n) => {
    const r = inCard.get(n)!
    expect(r.confirm.y).toBe(r.before.y)
    expect(r.confirm.cardTop).toBe(r.before.cardTop)
  })

  it('order #12, at the very bottom, keeps its card on screen', () => {
    // The last card grows past the document end, so the browser reclaims the
    // overscroll. That is ordinary layout, not a jump: the card stays visible.
    const r = inCard.get(12)!
    expect(r.confirm.y).toBeGreaterThan(0)
    expect(Math.abs(r.confirm.y - r.before.y)).toBeLessThan(200)
    expect(r.confirm.cardTop).toBeGreaterThan(0)
  })

  it.each(ORDERS)('order #%i never gets thrown to the top of the page', (n) => {
    const r = inCard.get(n)!
    // The one failure mode being fixed: scrolled queue, then scrollY 0.
    if (r.before.y > 0) expect(r.confirm.y).toBeGreaterThan(0)
  })
})

describe('3 · the question is asked inside the order it is about', () => {
  it.each(ORDERS)('order #%i renders the confirmation within its own card', (n) => {
    expect(inCard.get(n)!.confirm.insideCard).toBe(true)
  })

  it.each([1, 2, 3, 8, 10])('order #%i shows it without scrolling', (n) => {
    expect(inCard.get(n)!.confirm.inView).toBe(true)
  })
})

describe('4 · answering Yes keeps the operator with the same order', () => {
  it.each(ORDERS)('order #%i opens Scan Laundry Bag in that same card', (n) => {
    const r = inCard.get(n)!
    expect(r.scan.insideCard).toBe(true)
    expect(r.sameCardNode).toBe(true)
  })

  it.each(ORDERS)('order #%i leaves the scanner visible and hittable', (n) => {
    const r = inCard.get(n)!
    expect(r.scan.inView).toBe(true)
    expect(r.scan.clickable).toBe(true)
  })

  it('the old placement could not say the same', () => {
    // #8/#10/#12 opened the panel below a page that had jumped to the top.
    for (const n of [3, 8, 10, 12]) expect(strip.get(n)!.scan.clickable).toBe(false)
  })
})

describe('5 · nothing was moved by scrolling, focusing or timing', () => {
  it.each(ORDERS)('order #%i calls no scrollIntoView and no focus()', (n) => {
    expect(inCard.get(n)!.scrollIntoViewCalls).toBe(0)
    expect(inCard.get(n)!.focusCalls).toBe(0)
  })

  it('and the component adds none of those on this path either', () => {
    const card = code.slice(code.indexOf('{confirmSecondBag?.orderId === o.orderId && ('))
    const panel = card.slice(0, card.indexOf('</BagScanButton>') + 1 || card.indexOf('Cancel', card.indexOf('addBagFor')))
    for (const w of ['scrollIntoView', 'scrollTo(', 'autoFocus', '.focus(', 'setTimeout']) {
      expect(panel, w).not.toContain(w)
    }
  })
})

describe('6 · both bag surfaces are scoped to their order, none to the strip', () => {
  it('the confirmation is rendered per order', () => {
    expect(code).toContain('{confirmSecondBag?.orderId === o.orderId && (')
    // …and no longer unconditionally, above the columns.
    expect(code).not.toContain('{confirmSecondBag && (')
  })

  it('so is the scan panel it opens', () => {
    expect(code).toContain('{addBagFor?.orderId === o.orderId && (')
    expect(code).not.toContain('{addBagFor && (')
  })

  it('the confirmation sits above the panel it opens, in one card', () => {
    const c = code.indexOf('{confirmSecondBag?.orderId === o.orderId && (')
    const a = code.indexOf('{addBagFor?.orderId === o.orderId && (')
    expect(c).toBeGreaterThan(-1)
    expect(a).toBeGreaterThan(c)
    // Both inside the mapped card, which is keyed by orderId.
    expect(code.lastIndexOf('key={o.orderId}', c)).toBeGreaterThan(-1)
  })
})

describe('7 · the behaviour behind the buttons is byte-for-byte what it was', () => {
  it('the same handlers, unchanged', () => {
    expect(code).toContain('onClick={() => setConfirmSecondBag(null)}')
    expect(code).toContain('onClick={() => { setAddBagFor(confirmSecondBag); setConfirmSecondBag(null) }}')
    expect(code).toContain('Yes, Add Second Bag')
    expect(code).toContain('Is the first bag full?')
  })

  it('the first-bag path still skips the question entirely', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)\n                        else setAddBagFor(target)')
  })

  it('assignment, scanning and completion are untouched', () => {
    expect(code).toContain('action: "assign_bag"')
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
  })
})
