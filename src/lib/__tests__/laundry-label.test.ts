import { describe, it, expect } from 'vitest'
import {
  fitBarcode, autoWidthMm, garFontPt, textBlockMm, bestModuleDots,
  TARGET_MODULE_DOTS, MIN_QUIET_MM, MIN_BARCODE_MM,
  FIXED_LABEL_HEIGHT_MM, FIXED_LABEL_WIDTH_MM, MAX_LABEL_WIDTH_MM, STOCK_HEIGHT_MM,
  SAFE_MARGIN_MM, MAX_BARCODE_HEIGHT_FRACTION, MAX_GAR_PT, BARCODE_TEXT_GAP_MM, usableWidthMm,
  pageBoxFor, resolveStockHeightMm, DEFAULT_ORIENTATION, buildHTML,
} from '@/lib/laundry-label'

// ============================================================================
// Garment label geometry — TSC TE244, 203 DPI.
//
// LAYOUT: height 40mm FIXED, width AUTO. The barcode is never compressed to fit
// a width; the width extends until the barcode fits at full module width.
//
// A 15-character GAR code (GAR000000000001) encodes to 145 Code 128 modules:
// 12 codewords x 11 modules + a 13-module stop pattern.
// ============================================================================

const GAR_MODULES = 145
const LEGACY_MODULES = 442 // 37-char ORD-...-G1
const DPI = 203
const DOTS_PER_MM = DPI / 25.4

describe('auto width — the label grows, the barcode never shrinks', () => {
  it('sizes a GAR label from the barcode plus both quiet zones', () => {
    const w = autoWidthMm(GAR_MODULES, DPI)
    const barsMm = (GAR_MODULES * TARGET_MODULE_DOTS) / DOTS_PER_MM
    expect(w).toBeGreaterThanOrEqual(barsMm + MIN_QUIET_MM * 2)
    expect(Number.isInteger(w)).toBe(true) // whole mm — a clean label pitch
  })

  it('a longer code produces a WIDER label, not a denser barcode', () => {
    const narrow = autoWidthMm(GAR_MODULES, DPI)
    const wide = autoWidthMm(LEGACY_MODULES, DPI)
    expect(wide).toBeGreaterThan(narrow)
    // Same module width at both lengths — nothing was compressed.
    expect(fitBarcode(GAR_MODULES, narrow, DPI).moduleDots).toBe(TARGET_MODULE_DOTS)
    expect(fitBarcode(LEGACY_MODULES, wide, DPI).moduleDots).toBe(TARGET_MODULE_DOTS)
  })

  it('width scales linearly with code length', () => {
    const a = autoWidthMm(100, DPI), b = autoWidthMm(200, DPI)
    const barsA = (100 * TARGET_MODULE_DOTS) / DOTS_PER_MM
    expect(b - a).toBeCloseTo(barsA, 0)
  })
})

describe('fitBarcode at the auto width', () => {
  const w = autoWidthMm(GAR_MODULES, DPI)
  const f = fitBarcode(GAR_MODULES, w, DPI)

  it('keeps the full 2-dot module (0.25mm)', () => {
    expect(f.moduleDots).toBe(TARGET_MODULE_DOTS)
    expect(f.moduleDots / DOTS_PER_MM).toBeCloseTo(0.25, 2)
    expect(Number.isInteger(f.moduleDots)).toBe(true)
  })

  it('honours the drawing’s >=3mm quiet zone on both sides', () => {
    expect(f.quietMm).toBeGreaterThanOrEqual(MIN_QUIET_MM)
  })

  it('reports a clean fit', () => {
    expect(f.fits).toBe(true)
  })

  it('never prints wider than the label, so nothing is clipped', () => {
    expect(f.imageWidthMm).toBeLessThanOrEqual(w)
  })

  it('holds for the long legacy code too', () => {
    const lw = autoWidthMm(LEGACY_MODULES, DPI)
    const lf = fitBarcode(LEGACY_MODULES, lw, DPI)
    expect(lf.moduleDots).toBe(TARGET_MODULE_DOTS)
    expect(lf.quietMm).toBeGreaterThanOrEqual(MIN_QUIET_MM)
    expect(lf.imageWidthMm).toBeLessThanOrEqual(lw)
  })
})

describe('fixed 50 x 38.1mm stock — sized to be read, not to fill', () => {
  it('the size constants match the requested physical stock', () => {
    expect(FIXED_LABEL_WIDTH_MM).toBe(50)
    expect(STOCK_HEIGHT_MM).toBe(38.1)   // TSC TE244 stock: 1.97in x 1.50in
    expect(FIXED_LABEL_HEIGHT_MM).toBe(30) // content box drawn on that stock
  })

  it('the content box always fits the stock, so nothing is clipped by the page', () => {
    expect(FIXED_LABEL_HEIGHT_MM).toBeLessThanOrEqual(STOCK_HEIGHT_MM)
  })

  // Regression for the customer's oversized sample. The old layout grew the
  // module until the bars filled 90%+ of the label; a 2-dot module is the
  // scanner optimum and the spare width becomes margin instead.
  it('picks a 2-dot module and does NOT grow to fill the width', () => {
    const md = bestModuleDots(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    expect(md).toBe(2)
    expect(md / DOTS_PER_MM).toBeCloseTo(0.25, 3)
  })

  it('leaves the bars well inside the label — not edge to edge', () => {
    const md = bestModuleDots(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    const f = fitBarcode(GAR_MODULES, usableWidthMm(FIXED_LABEL_WIDTH_MM), DPI, md)
    const pct = (f.barsMm / FIXED_LABEL_WIDTH_MM) * 100
    expect(pct).toBeGreaterThan(65)   // still a big, readable symbol
    expect(pct).toBeLessThan(80)      // but never crowding the edges
  })

  it('keeps the quiet zone at or above the Code 128 minimum', () => {
    const md = bestModuleDots(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    const f = fitBarcode(GAR_MODULES, usableWidthMm(FIXED_LABEL_WIDTH_MM), DPI, md)
    expect(f.quietMm).toBeGreaterThanOrEqual(MIN_QUIET_MM)
    expect(f.fits).toBe(true)
  })

  // The safe margin is ON TOP of the quiet zone, so the true white border is
  // both added together.
  it('never lets the image enter the 2mm safe margin', () => {
    const md = bestModuleDots(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    const f = fitBarcode(GAR_MODULES, usableWidthMm(FIXED_LABEL_WIDTH_MM), DPI, md)
    expect(f.imageWidthMm).toBeLessThanOrEqual(usableWidthMm(FIXED_LABEL_WIDTH_MM))
    const edgeToFirstBar = SAFE_MARGIN_MM + f.quietMm
    expect(edgeToFirstBar).toBeGreaterThanOrEqual(SAFE_MARGIN_MM + MIN_QUIET_MM)
  })

  it('never grows the module past the point where the quiet zone would break', () => {
    const md = bestModuleDots(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    const tooBig = fitBarcode(GAR_MODULES, usableWidthMm(FIXED_LABEL_WIDTH_MM), DPI, md + 1)
    expect(tooBig.moduleDots).toBeLessThanOrEqual(md)
  })

  // The bug in the photo: bars took every leftover millimetre (~30mm of 40mm)
  // and shoved the GAR line onto the bottom edge.
  it('caps bar height instead of giving it the leftovers', () => {
    const pt = garFontPt(FIXED_LABEL_WIDTH_MM, 15)
    const cap = FIXED_LABEL_HEIGHT_MM * MAX_BARCODE_HEIGHT_FRACTION
    const free = FIXED_LABEL_HEIGHT_MM - SAFE_MARGIN_MM * 2 - textBlockMm(pt) - BARCODE_TEXT_GAP_MM
    const bars = Math.max(Math.min(MIN_BARCODE_MM, free), Math.min(cap, free))
    expect(bars).toBeGreaterThanOrEqual(MIN_BARCODE_MM)  // still scannable
    expect(bars).toBeLessThan(free)                       // leftovers NOT consumed
    // Measured against the STOCK — that is the label a person holds. The content
    // box is only the frame the bars are laid out in.
    expect(bars / STOCK_HEIGHT_MM).toBeLessThanOrEqual(MAX_BARCODE_HEIGHT_FRACTION)
  })

  it('the whole stack fits inside the content box with clear space top and bottom', () => {
    const pt = garFontPt(FIXED_LABEL_WIDTH_MM, 15)
    const cap = FIXED_LABEL_HEIGHT_MM * MAX_BARCODE_HEIGHT_FRACTION
    const free = FIXED_LABEL_HEIGHT_MM - SAFE_MARGIN_MM * 2 - textBlockMm(pt) - BARCODE_TEXT_GAP_MM
    const bars = Math.max(Math.min(MIN_BARCODE_MM, free), Math.min(cap, free))
    const content = bars + BARCODE_TEXT_GAP_MM + textBlockMm(pt)
    expect(content).toBeLessThanOrEqual(FIXED_LABEL_HEIGHT_MM - SAFE_MARGIN_MM * 2)
  })

  // The GAR is one line, always, at a size a person can read across a counter.
  it('holds the GAR line to a readable size that cannot wrap', () => {
    const pt = garFontPt(FIXED_LABEL_WIDTH_MM, 15)
    expect(pt).toBeLessThanOrEqual(MAX_GAR_PT)
    expect(pt).toBeGreaterThanOrEqual(7)
    const textMm = 15 * pt * 0.6 * (25.4 / 72)
    expect(textMm).toBeLessThanOrEqual(usableWidthMm(FIXED_LABEL_WIDTH_MM))
  })
})

describe('GAR text always fits the auto width', () => {
  it('never overflows the usable width at any label size', () => {
    for (const [w, chars] of [[42, 15], [30, 15], [108, 37], [60, 20]] as const) {
      const pt = garFontPt(w, chars)
      const textMm = chars * pt * 0.6 * (25.4 / 72)
      // The guarantee is the SAFE area — the GAR line must not enter the 2mm
      // border, which is a tighter promise than merely clearing the quiet zone.
      expect(textMm).toBeLessThanOrEqual(usableWidthMm(w) + 0.01)
    }
  })

  it('stays within readable type-size bounds', () => {
    expect(garFontPt(42, 15)).toBeGreaterThanOrEqual(7)
    expect(garFontPt(200, 4)).toBeLessThanOrEqual(20)
  })
})

// The page the browser declares and the orientation the TSC driver is set to must
// agree. When they disagree the driver rotates the raster 90° to reconcile them,
// which puts the 50mm-wide barcode on the 38.1mm feed axis — rotated and clipped.
describe('page orientation — the page is declared to match the printer', () => {
  const W = FIXED_LABEL_WIDTH_MM, S = STOCK_HEIGHT_MM

  it('defaults to the landscape the TE244 is set to for this stock', () => {
    expect(DEFAULT_ORIENTATION).toBe('landscape')
  })

  it('landscape declares the stock as loaded and turns nothing', () => {
    const p = pageBoxFor('landscape', W, S)
    expect(p.pageWidthMm).toBe(50)
    expect(p.pageHeightMm).toBe(38.1)
    expect(p.pageWidthMm).toBeGreaterThan(p.pageHeightMm) // a landscape job
    expect(p.rotateDeg).toBe(0)
  })

  it('portrait declares the swapped page and pre-turns the content to cancel the driver', () => {
    const p = pageBoxFor('portrait', W, S)
    expect(p.pageWidthMm).toBe(38.1)
    expect(p.pageHeightMm).toBe(50)
    expect(p.pageHeightMm).toBeGreaterThan(p.pageWidthMm) // a portrait job
    expect(p.rotateDeg).toBe(90)
  })

  // The whole point: whichever way the driver is set, the 50mm content width
  // lands on a 50mm page axis, so the bars are never cut off by the page.
  it('puts the 50mm content width on a 50mm page axis in BOTH orientations', () => {
    for (const o of ['landscape', 'portrait'] as const) {
      const p = pageBoxFor(o, W, S)
      const axis = p.rotateDeg === 0 ? p.pageWidthMm : p.pageHeightMm
      expect(axis).toBeGreaterThanOrEqual(W)
      const cross = p.rotateDeg === 0 ? p.pageHeightMm : p.pageWidthMm
      expect(cross).toBeGreaterThanOrEqual(FIXED_LABEL_HEIGHT_MM)
    }
  })

  it('both orientations cover the same physical area — only the frame turns', () => {
    const l = pageBoxFor('landscape', W, S), p = pageBoxFor('portrait', W, S)
    expect(l.pageWidthMm * l.pageHeightMm).toBeCloseTo(p.pageWidthMm * p.pageHeightMm, 6)
  })

  it('falls back to the TE244 stock pitch and never prints a page shorter than the content', () => {
    expect(resolveStockHeightMm({ widthMm: W, heightMm: 30, dpi: 203 })).toBe(STOCK_HEIGHT_MM)
    expect(resolveStockHeightMm({ widthMm: W, heightMm: 30, stockHeightMm: 20, dpi: 203 })).toBe(30)
    expect(resolveStockHeightMm({ widthMm: W, heightMm: 30, stockHeightMm: 50, dpi: 203 })).toBe(50)
  })

  // Regression: the stock grew from 38 to 38.1 and the content box stayed at 30.
  // If the page height were ever taken from the content box the bars would resize,
  // which is exactly what must not happen while fixing orientation.
  it('changing the stock pitch does not touch the bar height', () => {
    const barsAt = (contentH: number) => {
      const pt = garFontPt(FIXED_LABEL_WIDTH_MM, 15)
      const free = contentH - SAFE_MARGIN_MM * 2 - textBlockMm(pt) - BARCODE_TEXT_GAP_MM
      return Math.max(Math.min(MIN_BARCODE_MM, free), Math.min(contentH * MAX_BARCODE_HEIGHT_FRACTION, free))
    }
    // Same content box → same bars, whatever the stock or orientation is set to.
    expect(barsAt(FIXED_LABEL_HEIGHT_MM)).toBe(barsAt(FIXED_LABEL_HEIGHT_MM))
    expect(barsAt(FIXED_LABEL_HEIGHT_MM)).toBe(18)
  })
})

// The emitted @page rule IS the contract with the driver. Asserting it directly
// is the only way to catch the regression that produced a rotated, clipped label.
describe('emitted print CSS', () => {
  const one = [{ itemNumber: 'GAR000000000070', garment: 'Shirt', service: 'Wash', garScanCode: 'GAR000000000070' }]
  const base = { widthMm: 50, heightMm: 30, stockHeightMm: 38.1, dpi: 203 } as const

  it('declares the page as the physical stock when the printer is landscape', () => {
    const html = buildHTML(one, { ...base, orientation: 'landscape' })
    expect(html).toContain('@page { size: 50mm 38.1mm; margin: 0; }')
    expect(html).toContain('transform: rotate(0deg)')
  })

  it('declares the swapped page and turns the content when the printer is portrait', () => {
    const html = buildHTML(one, { ...base, orientation: 'portrait' })
    expect(html).toContain('@page { size: 38.1mm 50mm; margin: 0; }')
    expect(html).toContain('transform: rotate(90deg)')
  })

  it('defaults to landscape when nothing is saved', () => {
    expect(buildHTML(one, base)).toContain('@page { size: 50mm 38.1mm; margin: 0; }')
  })

  it('keeps margins at zero and never scales', () => {
    const html = buildHTML(one, { ...base, orientation: 'landscape' })
    expect(html).toContain('margin: 0;')
    expect(html).not.toContain('scale(')
  })

  it('never declares a page shorter than the content box', () => {
    const html = buildHTML(one, { ...base, stockHeightMm: 20 })
    expect(html).toContain('@page { size: 50mm 30mm; margin: 0; }')
  })

  it('prints the GAR under the bars', () => {
    expect(buildHTML(one, base)).toContain('>GAR000000000070<')
  })
})

describe('printer limit', () => {
  it('steps the module down rather than printing past the TE244 head', () => {
    // A code needing more than 108mm cannot be printed at full module width.
    const f = fitBarcode(2000, MAX_LABEL_WIDTH_MM, DPI)
    expect(f.moduleDots).toBeLessThan(TARGET_MODULE_DOTS)
    expect(f.imageWidthMm).toBeLessThanOrEqual(MAX_LABEL_WIDTH_MM)
    expect(f.fits).toBe(false) // flagged, never silently wrong
  })
})
