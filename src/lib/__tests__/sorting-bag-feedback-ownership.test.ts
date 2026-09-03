// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

// ============================================================================
// THE ANSWER TO A BAG SCAN BELONGS TO THE ORDER THAT WAS SCANNED FOR.
//
// Every surface that starts a bag assignment is order-scoped. The two states
// that ANSWER one were not: BAG ASSIGNED and the two refusals rendered at page
// level. Scanning for an order deep in the queue, the operator watched the card
// and was told the outcome at the top of the page — and on a refusal the panel
// simply stayed open with no stated reason. Measured on a 1440x900 viewport, a
// wrong bag scanned for order #15 put the refusal 3556px above the viewport.
//
// Both states already name their order: WrongBag.orderNumber and
// BagAssigned.orderNumber, both set from the same `rec` the assignment used, at
// the single site inside assignOrderBag that creates each. So this is a mount
// point change and nothing else — no new state, no new ownership concept, and
// the refusal's own wording, fields, dismiss buttons and timers are untouched.
//
// LAST SCANNED, the search results and workstation status stay page-level: they
// are not the outcome of assigning one order's bag.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
/** Rendered code only — comments describe the old placement and quote it. */
const code = SORT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')

const FIXTURE = 'file://' + join(process.cwd(), 'src/lib/__tests__/fixtures/sorting-bag-assignment.fixture.html')

let browser: Browser
let page: Page

/** Feedback, status and panel, read per order card. */
async function probe(order: number) {
  return page.evaluate((i) => {
    const card = document.getElementById('order' + i)!
    const strip = document.getElementById('strip')!
    const pick = (root: ParentNode, kind: string) => root.querySelector(`[data-fb="${kind}"][data-order="${i}"]`)
    const assigned = pick(document, 'assigned')
    const wrong = pick(document, 'wrong')
    const bagNo = card.querySelector('.bagNo')
    const txt = (el: Element | null) => (el ? (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : null)
    const rect = wrong?.getBoundingClientRect()
    return {
      scrollY: Math.round(scrollY),
      cardTop: Math.round(card.getBoundingClientRect().top),
      // success
      hasAssigned: !!assigned,
      assignedInCard: assigned ? card.contains(assigned) : false,
      assignedBag: txt(assigned?.querySelector('.fbBag') ?? null),
      // refusal
      hasWrong: !!wrong,
      wrongInCard: wrong ? card.contains(wrong) : false,
      wrongScanned: txt(wrong?.querySelector('.fbScanned') ?? null),
      wrongTop: rect ? Math.round(rect.top) : null,
      wrongInView: rect ? rect.top >= 0 && rect.bottom <= innerHeight : false,
      // page level
      stripFeedback: strip.querySelectorAll('[data-fb]').length,
      stripPanels: strip.querySelectorAll('[data-panel]').length,
      // persistent status + panel
      banner: (card.querySelector('.bagbanner') as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      bagNumber: bagNo ? bagNo.textContent : null,
      hasPanel: !!document.querySelector(`[data-panel][data-order="${i}"]`),
      assignedOwner: (window as any).assignedOwner(),
      wrongOwner: (window as any).wrongOwner(),
      siv: (window as any).__siv, focus: (window as any).__focus,
    }
  }, order)
}

/** `feedback: false` reproduces the state before this change: the panels are
    already order-scoped (shipped), only the answer is still page-level. */
async function reset({ feedback = true }: { feedback?: boolean } = {}) {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await page.evaluate((f) => { (window as any).FIXED = true; (window as any).FIXED_FEEDBACK = f }, feedback)
}
async function scrollTo(order: number) {
  await page.evaluate((i) => document.getElementById('order' + i)!.scrollIntoView({ block: 'center' }), order)
  await new Promise((r) => setTimeout(r, 60))
  await page.evaluate(() => { (window as any).__siv = 0; (window as any).__focus = 0 })
}

beforeAll(async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
}, 60_000)
afterAll(async () => { await browser?.close() })

describe('1 · the old placement answered a deep order at the top of the page', () => {
  it('a wrong bag for #15 was explained 3556px above the operator', async () => {
    await reset({ feedback: false })
    await scrollTo(15)
    await page.click('#assign15')
    await page.click('[data-order="15"] .scanBadBag')
    await new Promise((r) => setTimeout(r, 100))
    const r = await probe(15)
    expect(r.hasWrong).toBe(true)
    expect(r.wrongInCard).toBe(false)
    expect(r.stripFeedback).toBeGreaterThan(0)
    expect(r.wrongTop).toBeLessThan(0)
    expect(r.wrongInView).toBe(false)
  }, 60_000)
})

describe('2 · #15 → wrong bag → the refusal is on #15', () => {
  it('shows on the order, in view, with nothing at page level', async () => {
    await reset()
    await scrollTo(15)
    const before = await probe(15)
    await page.click('#assign15')
    await page.click('[data-order="15"] .scanBadBag')
    await new Promise((r) => setTimeout(r, 100))
    const r = await probe(15)
    expect(r.wrongOwner).toBe(15)
    expect(r.hasWrong).toBe(true)
    expect(r.wrongInCard).toBe(true)
    expect(r.wrongScanned).toBe('BADBAG115')
    expect(r.wrongInView).toBe(true)
    expect(r.stripFeedback).toBe(0)
    // Nothing was assigned and the panel is still open to try again.
    expect(r.bagNumber).toBe(null)
    expect(r.banner).toContain('BAG REQUIRED')
    expect(r.hasPanel).toBe(true)
    // 15. no page jump
    expect(r.scrollY).toBe(before.scrollY)
    expect(r.cardTop).toBe(before.cardTop)
  }, 60_000)

  it('and no other order shows it', async () => {
    for (const other of [14, 16]) {
      const o = await probe(other)
      expect(o.hasWrong).toBe(false)
      expect(o.hasAssigned).toBe(false)
    }
  }, 60_000)
})

describe('3 · #15 → correct bag → the success is on #15', () => {
  it('replaces the refusal, on the same card, and the status follows', async () => {
    await page.click('[data-order="15"] .scanBag')
    await new Promise((r) => setTimeout(r, 100))
    const r = await probe(15)
    expect(r.assignedOwner).toBe(15)
    expect(r.assignedInCard).toBe(true)
    expect(r.assignedBag).toBe('V8BAG115')
    expect(r.hasWrong).toBe(false)              // the refusal is superseded
    expect(r.stripFeedback).toBe(0)
    // The persistent status is there too, and the panel has closed.
    expect(r.banner).toContain('SORTING BAG ATTACHED')
    expect(r.bagNumber).toBe('V8BAG115')
    expect(r.hasPanel).toBe(false)
  }, 60_000)
})

describe('4 · #16 gets its own feedback, and #15 keeps everything', () => {
  it('a wrong bag on #16 lands on #16 only', async () => {
    await scrollTo(16)
    const before = await probe(16)
    await page.click('#assign16')
    await page.click('[data-order="16"] .scanBadBag')
    await new Promise((r) => setTimeout(r, 100))
    const r16 = await probe(16)
    expect(r16.wrongOwner).toBe(16)
    expect(r16.wrongInCard).toBe(true)
    expect(r16.wrongScanned).toBe('BADBAG116')
    expect(r16.stripFeedback).toBe(0)
    expect(r16.scrollY).toBe(before.scrollY)

    // 10. no cross-order feedback: #15 shows neither, and keeps its bag.
    const r15 = await probe(15)
    expect(r15.hasWrong).toBe(false)
    expect(r15.hasAssigned).toBe(false)
    expect(r15.bagNumber).toBe('V8BAG115')
    expect(r15.banner).toContain('SORTING BAG ATTACHED')
  }, 60_000)

  it('then a correct bag on #16 stays on #16', async () => {
    await page.click('[data-order="16"] .scanBag')
    await new Promise((r) => setTimeout(r, 100))
    const r16 = await probe(16)
    const r15 = await probe(15)
    expect(r16.assignedOwner).toBe(16)
    expect(r16.assignedInCard).toBe(true)
    expect(r16.assignedBag).toBe('V8BAG116')
    expect(r16.bagNumber).toBe('V8BAG116')
    expect(r15.hasAssigned).toBe(false)
    expect(r15.bagNumber).toBe('V8BAG115')
    expect(r16.stripFeedback).toBe(0)
    expect(r16.siv).toBe(0)
    expect(r16.focus).toBe(0)
  }, 60_000)
})

describe('5 · the component keeps every bag surface order-scoped', () => {
  it('feedback is guarded on the order that owns it', () => {
    expect(code).toContain('{bagAssigned?.orderNumber === o.orderNumber && (')
    expect(code).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "SERVICE" && (')
    expect(code).toContain('{wrongBag?.orderNumber === o.orderNumber && wrongBag.kind === "BAG" && (')
  })

  it('and no longer renders unconditionally at page level', () => {
    for (const s of ['{bagAssigned && (', '{wrongBag && wrongBag.kind === "SERVICE" && (', '{wrongBag && wrongBag.kind === "BAG" && (']) {
      expect(code, s).not.toContain(s)
    }
  })

  it('the interactive surfaces stay order-scoped as well', () => {
    expect(code).toContain('{addBagFor?.orderId === o.orderId && (')
    expect(code).toContain('{confirmSecondBag?.orderId === o.orderId && (')
    expect(code).toContain('{bagNeededFor?.orderId === o.orderId && (')
  })

  it('the persistent status still renders above the feedback', () => {
    const bags = code.indexOf('<OrderBags')
    expect(bags).toBeGreaterThan(-1)
    expect(code.indexOf('{bagAssigned?.orderNumber === o.orderNumber && (')).toBeGreaterThan(bags)
    expect(code.indexOf('{wrongBag?.orderNumber === o.orderNumber', bags)).toBeGreaterThan(bags)
  })
})

describe('6 · unrelated page-level feedback was NOT moved', () => {
  it('LAST SCANNED, search and workstation status stay above the columns', () => {
    const grid = code.indexOf('grid grid-cols-1 lg:grid-cols-2')
    expect(grid).toBeGreaterThan(-1)
    for (const s of ['{lastScanned && (', '{searching && (', '{offline &&']) {
      const at = code.indexOf(s)
      expect(at, s).toBeGreaterThan(-1)
      expect(at, s).toBeLessThan(grid)
    }
  })
})

describe('7 · validation, assignment and scanning are untouched', () => {
  it('the refusal is still built by the same single site, with its own wording', () => {
    expect(code).toContain('kind: j?.code === "SERVICE_REQUIRED" ? "SERVICE" : "BAG"')
    expect((code.match(/setWrongBag\(\{/g) || []).length).toBe(1)
    expect((code.match(/setBagAssigned\(\{/g) || []).length).toBe(1)
    expect(code).toContain('Nothing was changed — both bags keep their orders, and the garment count is unaffected.')
  })

  it('the timers and dismiss behaviour are unchanged', () => {
    expect(code).toContain('setTimeout(() => setWrongBag(null), 10000)')
    expect(code).toContain('setTimeout(() => setBagAssigned(null), 12000)')
    expect(code).toContain('if (bag) { setBagAssigned(null); setWrongBag(null) }')
  })

  it('the one assignment call, its guards and the completion gate still stand', () => {
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
    expect(code).toContain('action: "assign_bag"')
    expect(code).toContain('custodian: "PROCESSING_CENTER"')
    expect(code).toContain('setBagNeededFor(bag ? null : record)')
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
  })

  it('nothing was repositioned with scroll, focus or timing', () => {
    expect((code.match(/scrollIntoView/g) || []).length).toBe(1)   // locate() only
    expect((code.match(/\.focus\(/g) || []).length).toBe(0)
    expect(code).not.toContain('scrollTo(')
    expect(code).not.toContain('autoFocus')
  })
})
