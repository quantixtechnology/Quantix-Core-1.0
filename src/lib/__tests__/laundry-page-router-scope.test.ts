// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

// ============================================================================
// A dynamic() CALL BELONGS AT MODULE SCOPE.
//
// next/dynamic returns a NEW component type every time it is called, and React
// compares element types by reference. A dynamic() evaluated during render is
// therefore not a lazy import — it is an instruction to unmount and remount
// everything below it on every single re-render of the enclosing component.
//
// `LaundryPageRouter` was declared inside AppContent, which reads ~25 fields
// from the admin and auth stores. Any one of them changing — a background
// session sync is enough — destroyed the whole Laundry workspace and rebuilt
// it. On a Sorting queue of 121 orders the document collapsed from roughly
// 40,000px to the PageLoader's 60vh, so the browser clamped scrollY to 0. An
// operator part-way through assigning a bag to the 15th order was returned to
// the top of the page with the panel gone and the local state wiped.
//
// The measured jump, before the fix, on a 1440x900 viewport: order #3 scrollY
// 285 -> 0, #8 1522 -> 0, #15 3286 -> 0, #20 4546 -> 0.
//
// This is not something JSX placement can defend against — the card was already
// correct and was thrown away with everything else — so the guard is on the
// declaration itself, and the browser test proves what the declaration costs.
// ============================================================================

const SHELL = readFileSync(join(process.cwd(), 'src/app/home-shell.tsx'), 'utf8')

describe('1 · every dynamic() in the shell is module scope', () => {
  it('none is declared inside a component body', () => {
    // An indented `const X = dynamic(` is inside something — a component, a
    // hook, a callback — and is re-evaluated every time that thing runs.
    const indented = SHELL.split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => /^\s+const\s+[A-Za-z0-9_]+\s*=\s*dynamic\(/.test(l))
    expect(indented.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([])
  })

  it('and there are many at module scope, so the rule is the norm', () => {
    const atModule = SHELL.split('\n').filter((l) => /^const\s+[A-Za-z0-9_]+\s*=\s*dynamic\(/.test(l))
    expect(atModule.length).toBeGreaterThan(100)
  })
})

describe('2 · LaundryPageRouter specifically cannot move back inside AppContent', () => {
  it('is declared before AppContent begins', () => {
    const decl = SHELL.indexOf('const LaundryPageRouter = dynamic(')
    const appContent = SHELL.indexOf('function AppContent(')
    expect(decl).toBeGreaterThan(-1)
    expect(appContent).toBeGreaterThan(-1)
    expect(decl).toBeLessThan(appContent)
  })

  it('is declared exactly once, at the left margin', () => {
    const hits = SHELL.split('\n').filter((l) => l.includes('LaundryPageRouter = dynamic('))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatch(/^const /)
  })

  it('with its import, options and loading component unchanged', () => {
    expect(SHELL).toContain('() => import("@/components/laundry/laundry-page-router").then((m) => ({ default: m.LaundryPageRouter })),')
    expect(SHELL).toContain('{ loading: () => <PageLoader /> },')
  })
})

// ── What the declaration costs, measured ──────────────────────────────────
const FIXTURE = 'file://' + join(process.cwd(), 'src/lib/__tests__/fixtures/sorting-subtree-remount.fixture.html')
/** #3 and #8 near the top, #15 the order from the report, #20 deep. */
const ORDERS = [3, 8, 15, 20] as const

let browser: Browser
let page: Page

async function openAt(order: number, remount: boolean) {
  await page.goto(FIXTURE, { waitUntil: 'load' })
  await page.evaluate((r) => { (window as any).REMOUNT = r }, remount)
  await page.evaluate((i) => document.getElementById('order' + i)!.scrollIntoView({ block: 'center' }), order)
  await new Promise((r) => setTimeout(r, 60))
  await page.evaluate(() => { (window as any).__siv = 0; (window as any).__focus = 0 })
}

async function read(order: number) {
  return page.evaluate((i) => {
    const card = document.getElementById('order' + i)
    const all = [...document.querySelectorAll('.order')].map((e) => e.id)
    const bagEl = card?.querySelector('.bagNo')
    return {
      scrollY: Math.round(scrollY),
      cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
      docHeight: Math.round(document.documentElement.scrollHeight),
      listIndex: all.indexOf('order' + i),
      listLength: all.length,
      node: card ? (card as HTMLElement).dataset.node : null,
      panelOpen: !!document.querySelector(`[data-panel][data-order="${i}"]`),
      bag: bagEl ? bagEl.textContent : null,
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

describe('3 · the remount really did send every order back to the top', () => {
  // Without this the guard proves nothing: a harness that cannot reproduce the
  // fault cannot show it is gone.
  it.each(ORDERS)('order #%i collapsed to scrollY 0 and lost its panel', async (n) => {
    await openAt(n, true)
    const before = await read(n)
    await page.click('#assign' + n)
    const opened = await read(n)
    expect(opened.panelOpen).toBe(true)
    expect(opened.scrollY).toBe(before.scrollY)          // the click itself was fine

    await page.evaluate(() => (window as any).storeChanged())
    await new Promise((r) => setTimeout(r, 450))
    const after = await read(n)
    expect(before.scrollY).toBeGreaterThan(0)
    expect(after.scrollY).toBe(0)                        // …the store change was not
    expect(after.panelOpen).toBe(false)
    expect(after.node).not.toBe(before.node)             // every node replaced
  }, 60_000)
})

describe('4 · with the declaration at module scope, nothing moves', () => {
  it.each(ORDERS)('order #%i keeps its scroll, panel, node and bag', async (n) => {
    await openAt(n, false)
    const before = await read(n)
    expect(before.scrollY).toBeGreaterThan(0)

    await page.click('#assign' + n)
    const opened = await read(n)
    expect(opened.panelOpen).toBe(true)

    // The re-render that used to destroy the page.
    await page.evaluate(() => (window as any).storeChanged())
    await new Promise((r) => setTimeout(r, 450))
    const after = await read(n)

    expect(after.scrollY).toBe(before.scrollY)           // no collapse
    expect(after.scrollY).not.toBe(0)
    expect(after.cardTop).toBe(before.cardTop)           // card did not move
    expect(after.panelOpen).toBe(true)                   // panel still open
    expect(after.node).toBe(before.node)                 // same DOM node
    expect(after.listIndex).toBe(before.listIndex)       // list did not reorder
    expect(after.listLength).toBe(before.listLength)
  }, 60_000)

  it.each(ORDERS)('order #%i keeps the bag it was given across a store change', async (n) => {
    await openAt(n, false)
    await page.click('#assign' + n)
    await page.click(`[data-order="${n}"] .scanBag`)
    const assigned = await read(n)
    expect(assigned.bag).toBe('V8BAG' + (100 + n))

    await page.evaluate(() => (window as any).storeChanged())
    await new Promise((r) => setTimeout(r, 450))
    const after = await read(n)
    expect(after.bag).toBe('V8BAG' + (100 + n))          // bagsByOrder survived
    expect(after.scrollY).toBe(assigned.scrollY)
    expect(after.node).toBe(assigned.node)
  }, 60_000)

  it('a bag stays with the order it was scanned for, not its neighbour', async () => {
    await openAt(15, false)
    await page.click('#assign15')
    await page.click('[data-order="15"] .scanBag')
    await page.click('#assign16')
    await page.click('[data-order="16"] .scanBag')
    await page.evaluate(() => (window as any).storeChanged())
    await new Promise((r) => setTimeout(r, 450))
    expect((await read(15)).bag).toBe('V8BAG115')
    expect((await read(16)).bag).toBe('V8BAG116')
  }, 60_000)

  it('and none of it needed a scroll or focus workaround', async () => {
    const r = await read(15)
    expect(r.siv).toBe(0)
    expect(r.focus).toBe(0)
  }, 60_000)
})
