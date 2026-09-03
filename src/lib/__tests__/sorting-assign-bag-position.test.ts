import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============================================================================
// ASSIGN BAG → SCAN LAUNDRY BAG, WITHOUT LOSING THE CONTROL OFF-SCREEN.
//
// The assign panel rendered in the banner strip ABOVE the order grid, while the
// button that opens it lives at the bottom of an order card. With the operator
// scrolled down to an order, clicking Assign put the "Scan Laundry Bag" control
// roughly a screenful above the viewport, and inserting the strip shifted the
// document by its own height underneath them.
//
// Measured in a real browser on a 1440x900 viewport, card 8 of 12 centred:
//
//   panel in the top strip : scrollΔ = +89px, scan button top = -352px,
//                            in viewport = false, clickable = false
//   panel inside the card  : scrollΔ =   0px, scan button top =  693px,
//                            in viewport = true,  clickable = true
//
// It was never focus: activeElement after the click was the Assign button
// itself, and no scrollIntoView / autoFocus / preventScroll is involved. It is
// purely WHERE the panel renders, which is what these pin.
// ============================================================================

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const WS = read('src/components/laundry/views/laundry-sorting-workstation.tsx')
const code = WS.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/^\s*\/\/.*$/gm, '')

describe('1,2 · the panel opens where the operator clicked', () => {
  it('renders INSIDE the order card, keyed to the order that opened it', () => {
    expect(code).toContain('{addBagFor?.orderId === o.orderId && (')
  })

  it('is no longer a bare block in the strip above the grid', () => {
    // The old form was an unconditional `{addBagFor && (` at strip indentation.
    expect(code).not.toMatch(/\n {8}\{addBagFor && \(/)
  })

  it('sits directly under the button that opens it', () => {
    const card = code.slice(code.indexOf('<OrderBags'))
    const btn = card.indexOf('onAdd={(serviceId, serviceName, hasBag)')
    const panel = card.indexOf('{addBagFor?.orderId === o.orderId && (')
    expect(btn).toBeGreaterThan(-1)
    expect(panel).toBeGreaterThan(btn)
  })
})

describe('3,4 · nothing scrolls the page or steals focus', () => {
  it('the assign flow adds no scroll or focus machinery', () => {
    // onAdd only sets state; it must not scroll, focus or navigate.
    const onAdd = code.slice(code.indexOf('onAdd={(serviceId, serviceName, hasBag)'), code.indexOf('{addBagFor?.orderId === o.orderId && ('))
    for (const w of ['scrollIntoView', '.focus(', 'autoFocus', 'scrollTo', 'preventScroll']) {
      expect(onAdd, w).not.toContain(w)
    }
  })

  it('the ONE scrollIntoView on the screen is still only the garment-scan locate()', () => {
    expect((code.match(/scrollIntoView/g) || []).length).toBe(1)
    expect(WS).toContain('const locate = useCallback((orderId: string, itemId: string | null)')
    const locate = code.slice(code.indexOf('const locate = useCallback'), code.indexOf('const scanErrTimer'))
    expect(locate).toContain('scrollIntoView')
  })

  it('no autofocus was introduced anywhere on the workstation', () => {
    expect(code).not.toContain('autoFocus')
  })
})

describe('5,6,7 · the assignment workflow itself is untouched', () => {
  it('the same panel, the same handlers, the same endpoint', () => {
    expect(code).toContain('onScan={(code) => assignOrderBag(code, { ...addBagFor, customer: null })}')
    expect(code).toContain('onClick={() => { const c = bagCode.trim(); if (c) assignOrderBag(c, { ...addBagFor, customer: null }) }}')
    expect(code).toContain('<BagScanButton')
    expect(code).toContain('onClick={() => setAddBagFor(null)}')
  })

  it('first-bag vs second-bag routing is unchanged', () => {
    expect(code).toContain('if (hasBag) setConfirmSecondBag(target)')
    expect(code).toContain('else setAddBagFor(target)')
    expect(code).toContain('Yes, Add Second Bag')
  })

  it('the typed-code path keeps its Enter handling and does not touch the scanner', () => {
    // Three preventDefault() calls, ALL pre-existing and all narrowly scoped:
    // the search form's submit, and Enter inside each of the two bag-code
    // fields (this panel and the separate bagNeededFor advisory). None is a
    // generic keyboard handler, so a USB/Bluetooth wedge is never intercepted.
    expect(code).toContain('if (e.key !== "Enter") return')
    expect((code.match(/preventDefault\(\)/g) || []).length).toBe(3)
    expect((code.match(/if \(e\.key !== "Enter"\) return/g) || []).length).toBe(2)
  })
})

describe('8,9,10,11,12 · everything else on the screen is unchanged', () => {
  it('garment scanning and sorting counts are untouched', () => {
    expect(code).toContain('<LaundryBarcodeScanner onDetect={handleGarmentScan}')
    expect(code).toContain('g.expected++')
    expect(code).toContain('{done} / {o.expected} scanned')
  })

  it('sorting completion is still the bag scan on the Complete Sorting card', () => {
    expect(WS).toContain('to complete Sorting')
    expect(code).toContain('onScan={(code) => handleAssignBag(code, o)}')
  })

  it('the simplified bag display survives on both sides', () => {
    expect(code).toContain('🟢 Sorting Bag{many ? "s" : ""} Attached')
    expect(code).toContain('🟠 Bag Required')
    expect(code).toContain('⚠ Bag Required')
    expect((code.match(/sortingBagStatus\(/g) || []).length).toBe(2)
    expect((code.match(/sortingOrderSummary\(\{ garments: o\.garments, garmentCount: o\.garments\.length, totalWeightKg: o\.totalWeightKg \}\)/g) || []).length).toBe(2)
  })

  it('12 · still no per-card bag request', () => {
    expect(code).not.toContain('useOrderBags(')
    expect(code).not.toContain('order-bag-list')
    expect((code.match(/\/api\/laundry\/orders\/\$\{orderId\}\/bags/g) || []).length).toBe(1)
  })
})
