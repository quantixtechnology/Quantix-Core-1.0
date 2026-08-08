import { describe, it, expect } from 'vitest'
import {
  fitBarcode, autoWidthMm, garFontPt, textBlockMm,
  TARGET_MODULE_DOTS, MIN_QUIET_MM, MIN_BARCODE_MM,
  FIXED_LABEL_HEIGHT_MM, FIXED_LABEL_WIDTH_MM, MAX_LABEL_WIDTH_MM,
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

describe('fixed 60 x 40mm label', () => {
  it('the size constants match the requested label', () => {
    expect(FIXED_LABEL_WIDTH_MM).toBe(60)
    expect(FIXED_LABEL_HEIGHT_MM).toBe(40)
  })

  it('a GAR barcode fits at full module width with room to spare', () => {
    const f = fitBarcode(GAR_MODULES, FIXED_LABEL_WIDTH_MM, DPI)
    expect(f.moduleDots).toBe(TARGET_MODULE_DOTS)
    expect(f.fits).toBe(true)
    expect(f.quietMm).toBeGreaterThan(MIN_QUIET_MM)
    expect(f.imageWidthMm).toBeLessThanOrEqual(FIXED_LABEL_WIDTH_MM)
  })

  it('leaves well over the minimum bar height after the GAR line', () => {
    const w = FIXED_LABEL_WIDTH_MM
    const pt = garFontPt(w, 15)
    const bars = FIXED_LABEL_HEIGHT_MM - 0.4 - 0.4 - textBlockMm(pt) - 1.2
    expect(bars).toBeGreaterThan(MIN_BARCODE_MM)
  })
})

describe('GAR text always fits the auto width', () => {
  it('never overflows the usable width at any label size', () => {
    for (const [w, chars] of [[42, 15], [30, 15], [108, 37], [60, 20]] as const) {
      const pt = garFontPt(w, chars)
      const textMm = chars * pt * 0.6 * (25.4 / 72)
      expect(textMm).toBeLessThanOrEqual(w - MIN_QUIET_MM * 2 + 0.01)
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
