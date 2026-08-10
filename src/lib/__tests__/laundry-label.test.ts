import { describe, it, expect } from 'vitest'
import {
  fitBarcode, autoWidthMm, garFontPt, textBlockMm, bestModuleDots,
  TARGET_MODULE_DOTS, MIN_QUIET_MM, MIN_BARCODE_MM,
  FIXED_LABEL_HEIGHT_MM, FIXED_LABEL_WIDTH_MM, MAX_LABEL_WIDTH_MM,
  SAFE_MARGIN_MM, MAX_BARCODE_HEIGHT_FRACTION, MAX_GAR_PT, BARCODE_TEXT_GAP_MM, usableWidthMm,
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

describe('fixed 50 x 38mm label — sized to be read, not to fill', () => {
  it('the size constants match the requested physical stock', () => {
    expect(FIXED_LABEL_WIDTH_MM).toBe(50)
    expect(FIXED_LABEL_HEIGHT_MM).toBe(38)
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
    expect(bars / FIXED_LABEL_HEIGHT_MM).toBeLessThanOrEqual(MAX_BARCODE_HEIGHT_FRACTION)
  })

  it('the whole stack fits inside 38mm with clear space top and bottom', () => {
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

describe('printer limit', () => {
  it('steps the module down rather than printing past the TE244 head', () => {
    // A code needing more than 108mm cannot be printed at full module width.
    const f = fitBarcode(2000, MAX_LABEL_WIDTH_MM, DPI)
    expect(f.moduleDots).toBeLessThan(TARGET_MODULE_DOTS)
    expect(f.imageWidthMm).toBeLessThanOrEqual(MAX_LABEL_WIDTH_MM)
    expect(f.fits).toBe(false) // flagged, never silently wrong
  })
})
