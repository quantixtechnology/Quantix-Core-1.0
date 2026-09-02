import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { shouldReclaimFocus } from '@/components/laundry/laundry-barcode-scanner'

// ============================================================================
// TWO BUGS THE OPERATOR FELT AS ONE: "copy moves the page, and I cannot see
// everything I scanned."
//
// BUG 1 — the page jumped to the top on any Copy click. Not CopyButton: it is
// type="button", navigates nowhere and scrolls nothing. The workstation scanner
// keeps itself permanently focused and reclaims focus after ANY focus loss that
// did not go to an editable field. A <button> is not editable, so clicking Copy
// handed focus to the button, the scanner took it straight back, and focusing
// an input at the top of the page scrolls the page there.
//
// The scanner is shared by every workstation, so it is left alone. The button
// declines the focus instead — opt-in, mouse-only, off everywhere else.
//
// BUG 2 — the badge counted `scannedFor(orderId).length` (raw ids) while the
// list rendered the intersection with the order's loaded garments. Two
// calculations, so "3 / 25 scanned" could render fewer than three rows. There
// is now ONE collection, and the test below is written so a second calculation
// cannot come back unnoticed.
// ============================================================================

const SORT = readFileSync(join(process.cwd(), 'src/components/laundry/views/laundry-sorting-workstation.tsx'), 'utf8')
const BTN = readFileSync(join(process.cwd(), 'src/components/ui/copy-button.tsx'), 'utf8')
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+\/\/.*$/gm, '')
const code = strip(SORT)
const btn = strip(BTN)

// ── BUG 1, at the exact mechanism ───────────────────────────────────────────
describe('1 · the scanner reclaims focus from a button — that is the jump', () => {
  const input = { tagName: 'INPUT', isContentEditable: false } as unknown as HTMLElement
  const button = { tagName: 'BUTTON', isContentEditable: false } as unknown as HTMLElement

  it('it stands aside for an editable field', () => {
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: input, self: null })).toBe(false)
  })

  it('but NOT for a button — this is why Copy scrolled the page', () => {
    // Documents the live behaviour. The scanner is shared by every workstation,
    // so it is deliberately unchanged; the fix is that the button never takes
    // focus in the first place, asserted below.
    expect(shouldReclaimFocus({ busyElsewhere: false, relatedTarget: button, self: null })).toBe(true)
  })

  it('and it still stands aside while another surface owns the scanner', () => {
    expect(shouldReclaimFocus({ busyElsewhere: true, relatedTarget: button, self: null })).toBe(false)
    expect(shouldReclaimFocus({ busyElsewhere: false, cameraOpen: true, relatedTarget: button, self: null })).toBe(false)
  })
})

describe('1 · the fix: the copy button declines the focus, opt-in', () => {
  it('CopyButton takes focus by default — no other screen changes', () => {
    expect(btn).toContain('preventFocusSteal = false')
    expect(btn).toContain('onMouseDown={preventFocusSteal ? (e) => e.preventDefault() : undefined}')
  })

  it('it is prevented on MOUSEDOWN, before focus moves', () => {
    // On click the focus has already moved and the reclaim is already queued.
    expect(btn).toContain('onMouseDown=')
    expect(btn).not.toContain('onFocus={')
  })

  it('every Sorting copy opts in — order number, GAR, bag, copy-all, attached bag', () => {
    // 5 since the Complete Sorting card names the attached bag and lets the
    // operator copy it. Every one still opts in — that is what this pins.
    expect((code.match(/preventFocusSteal/g) || []).length).toBe(5)
  })

  it('the button is still a plain non-submitting button that navigates nowhere', () => {
    expect(btn).toContain('type="button"')
    for (const w of ['href', '<a ', 'router', 'location.', 'scrollIntoView', 'fetch(']) {
      expect(btn, w).not.toContain(w)
    }
  })

  it('copying invokes neither locate() nor a scroll', () => {
    const block = code.slice(code.indexOf('scannedGarments.length > 0 &&'), code.indexOf('<OrderBags'))
    expect(block.length).toBeGreaterThan(400)
    for (const w of ['locate(', 'scrollIntoView', 'fetch(', 'setOrders', 'setScanned', 'setAddBagFor']) {
      expect(block, w).not.toContain(w)
    }
  })
})

// ── BUG 2, and the guard against it returning ───────────────────────────────
describe('2 · ONE collection feeds the count, the list and Copy All', () => {
  it('the card derives scanned garments exactly once', () => {
    expect(code).toContain('const scannedIds = new Set(scannedFor(o.orderId))')
    expect(code).toContain('const scannedGarments = o.garments.filter((g) => scannedIds.has(g.id))')
    expect(code).toContain('const done = scannedGarments.length')
  })

  it('THE GUARD — no second scanned calculation exists inside the card', () => {
    // If anyone reintroduces a separate count, this fails. The only other use
    // of scannedFor is the completion gate, which is deliberately untouched.
    const uses = code.match(/scannedFor\(o\.orderId\)/g) || []
    expect(uses).toHaveLength(2)
    expect(code).toContain('const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)')
    // and the card's own membership test reads the same set
    expect(code).toContain('const isScanned = scannedIds.has(g.id)')
    expect(code).not.toContain('scannedFor(o.orderId).includes(')
  })

  it('the badge and the list print the same number, from the same array', () => {
    expect(code).toContain('{done} / {o.expected} scanned')
    expect(code).toContain('{scannedGarments.length} / {o.expected}')
    expect(code).toContain('{scannedGarments.map((g) => {')
  })
})

// ── the collection rule itself, run for real ────────────────────────────────
type G = { id: string; garmentScanCode?: string | null; barcode?: string | null; garmentName: string }
const garOf = (g: G) => (g.garmentScanCode || g.barcode || '').trim()
const scannedOf = (garments: G[], ids: string[]) => {
  const set = new Set(ids)
  return garments.filter((g) => set.has(g.id))
}
const copyAll = (list: G[]) => list.map((g) => `${garOf(g) || '—'} — ${g.garmentName}`).join('\n')

const many = (n: number): G[] =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i}`, garmentScanCode: `GAR${String(i).padStart(11, '0')}`, garmentName: `Item ${i}` }))

describe('2 · the count always equals the rows', () => {
  it.each([0, 1, 3, 10, 25])('%i scanned → exactly that many rows', (n) => {
    const garments = many(25)
    const list = scannedOf(garments, many(25).slice(0, n).map((g) => g.id))
    expect(list).toHaveLength(n)
    if (n > 0) expect(copyAll(list).split('\n')).toHaveLength(n)
  })

  it('unscanned garments never appear', () => {
    const garments = many(25)
    expect(scannedOf(garments, ['i0', 'i1']).map((g) => g.id)).toEqual(['i0', 'i1'])
  })

  it('a duplicate scanned id is one row', () => {
    expect(scannedOf(many(3), ['i0', 'i0', 'i0'])).toHaveLength(1)
  })

  it("another order's id contributes nothing", () => {
    expect(scannedOf(many(3), ['other-1'])).toEqual([])
  })

  it('0 scanned renders no block at all', () => {
    expect(scannedOf(many(25), [])).toHaveLength(0)
    expect(code).toContain('{scannedGarments.length > 0 && (')
  })
})

describe('2 · Copy All copies every scanned garment, never a subset', () => {
  it('25 scanned → 25 lines, in order, one per garment', () => {
    const list = scannedOf(many(25), many(25).map((g) => g.id))
    const lines = copyAll(list).split('\n')
    expect(lines).toHaveLength(25)
    expect(lines[0]).toBe('GAR00000000000 — Item 0')
    expect(lines[24]).toBe('GAR00000000024 — Item 24')
  })

  it('a garment with no GAR is copied as shown, not dropped', () => {
    const list: G[] = [
      { id: 'a', garmentScanCode: 'GAR1', garmentName: 'Shirt' },
      { id: 'b', garmentScanCode: null, barcode: null, garmentName: 'Towel' },
    ]
    expect(copyAll(list).split('\n')).toEqual(['GAR1 — Shirt', '— — Towel'])
  })

  it('it is not filtered by anything the viewport can see', () => {
    const value = code.slice(code.indexOf('value={scannedGarments.map('), code.indexOf('label="Scanned garments"'))
    expect(value.length).toBeGreaterThan(20)
    for (const w of ['slice(', 'RECENT_LIMIT', 'visible', 'filter(Boolean)']) expect(value, w).not.toContain(w)
  })
})

describe('2 · one intentional scroll region for the scanned list', () => {
  it('the list scrolls internally rather than stretching the card', () => {
    const block = code.slice(code.indexOf('Scanned garments'), code.indexOf('<OrderBags'))
    expect((block.match(/overflow-y-auto/g) || []).length).toBe(1)
    expect(block).toContain('max-h-40 overflow-y-auto')
  })
})

describe('REGRESSION · bag, scan and completion untouched', () => {
  it('first bag, second-bag confirmation and its two answers', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)')
    expect(code).toContain('else setAddBagFor(target)')
    expect(code).toContain('Assign First Bag')
    expect(code).toContain('Is the first bag full?')
    expect(code).toContain('Yes, Add Second Bag')
    expect(code).toContain('onClick={() => setConfirmSecondBag(null)}')
  })

  it('completion, History, Last 5 Scans and the filter', () => {
    expect(code).toContain('action: "assign_bag"')
    expect(code).toContain('<SortingHistory businessId=')
    expect(code).toContain('const RECENT_LIMIT = 5')
    expect(code).toContain('Filter these orders — number, customer, GAR or bag')
    expect(code).toContain('const readyOrders = visibleOrders.filter')
  })

  it('no endpoint was added', () => {
    expect((code.match(/\/api\/laundry\/orders\/\$\{[^}]+\}\/bags/g) || []).length).toBe(2)
  })
})
