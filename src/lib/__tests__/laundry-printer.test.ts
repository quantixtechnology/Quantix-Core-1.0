import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PRINTER_SETTINGS, normalizePrinterSettings, isRoll, paperWidthMm,
  printableWidthMm, pageCss, receiptColumns, fromConfigRow, toConfigRow,
  MIN_WIDTH_MM, MAX_WIDTH_MM,
} from '@/lib/laundry-printer'

const s = (over: Partial<typeof DEFAULT_PRINTER_SETTINGS> = {}) => ({ ...DEFAULT_PRINTER_SETTINGS, ...over })

describe('paper width — one source for preview and print', () => {
  it('58mm and 80mm resolve to their physical widths', () => {
    expect(paperWidthMm(s({ paperSize: '58mm' }))).toBe(58)
    expect(paperWidthMm(s({ paperSize: '80mm' }))).toBe(80)
  })

  it('A4 is a page, not a roll', () => {
    expect(paperWidthMm(s({ paperSize: 'A4' }))).toBeNull()
    expect(isRoll(s({ paperSize: 'A4' }))).toBe(false)
  })

  it('custom width applies on a thermal printer', () => {
    expect(paperWidthMm(s({ paperSize: 'custom', customWidthMm: 76 }))).toBe(76)
  })

  // A custom width on a laser printer is still a sheet of paper.
  it('custom width on a standard printer is still a page', () => {
    expect(paperWidthMm(s({ paperSize: 'custom', printerType: 'standard' }))).toBeNull()
  })

  it('58mm is narrower than 80mm — the visible difference in the preview', () => {
    expect(paperWidthMm(s({ paperSize: '58mm' }))!).toBeLessThan(paperWidthMm(s({ paperSize: '80mm' }))!)
    expect(receiptColumns(s({ paperSize: '58mm' }))).toBeLessThan(receiptColumns(s({ paperSize: '80mm' })))
  })

  it('leaves margin for the print head', () => {
    expect(printableWidthMm(s({ paperSize: '80mm' }))!).toBeLessThan(80)
    expect(printableWidthMm(s({ paperSize: 'A4' }))).toBeNull()
  })
})

describe('@page follows the paper', () => {
  it('a roll prints continuous with no margin', () => {
    expect(pageCss(s({ paperSize: '58mm' }))).toBe('@page{size:58mm auto;margin:0}')
  })

  it('a page keeps a normal document margin', () => {
    expect(pageCss(s({ paperSize: 'A4' }))).toBe('@page{margin:16mm}')
  })
})

describe('normalize never throws and never yields a broken printer', () => {
  it('fills in defaults from nothing', () => {
    expect(normalizePrinterSettings(undefined)).toEqual(DEFAULT_PRINTER_SETTINGS)
    expect(normalizePrinterSettings(null)).toEqual(DEFAULT_PRINTER_SETTINGS)
    expect(normalizePrinterSettings({})).toEqual(DEFAULT_PRINTER_SETTINGS)
  })

  it('rejects an unknown paper size and printer type', () => {
    const r = normalizePrinterSettings({ paperSize: 'A3', printerType: 'dot-matrix' })
    expect(r.paperSize).toBe('80mm')
    expect(r.printerType).toBe('thermal')
  })

  it('rejects a custom width outside the sane band', () => {
    expect(normalizePrinterSettings({ customWidthMm: MIN_WIDTH_MM - 1 }).customWidthMm).toBe(80)
    expect(normalizePrinterSettings({ customWidthMm: MAX_WIDTH_MM + 1 }).customWidthMm).toBe(80)
    expect(normalizePrinterSettings({ customWidthMm: 'wide' }).customWidthMm).toBe(80)
  })

  it('accepts a width inside the band', () => {
    expect(normalizePrinterSettings({ customWidthMm: 76 }).customWidthMm).toBe(76)
  })

  it('only accepts offered copy counts', () => {
    expect(normalizePrinterSettings({ copies: 2 }).copies).toBe(2)
    expect(normalizePrinterSettings({ copies: 99 }).copies).toBe(1)
    expect(normalizePrinterSettings({ copies: 0 }).copies).toBe(1)
  })

  it('keeps booleans that are actually booleans', () => {
    const r = normalizePrinterSettings({ autoPrintOrder: true, includeQr: false })
    expect(r.autoPrintOrder).toBe(true)
    expect(r.includeQr).toBe(false)
  })

  it('ignores non-boolean switch values rather than coercing them', () => {
    expect(normalizePrinterSettings({ includeQr: 'yes' }).includeQr).toBe(DEFAULT_PRINTER_SETTINGS.includeQr)
  })

  it('caps header and footer length', () => {
    expect(normalizePrinterSettings({ headerText: 'x'.repeat(500) }).headerText).toHaveLength(300)
  })

  it('allows an empty footer to be saved', () => {
    expect(normalizePrinterSettings({ footerText: '' }).footerText).toBe('')
  })
})

describe('round-trips through the config row', () => {
  it('survives save then load unchanged', () => {
    const original = s({
      paperSize: '58mm', printerType: 'thermal', customWidthMm: 58, autoPrintOrder: true,
      printOnPayment: true, includeQr: false, headerText: 'VASTRASUDHA', footerText: 'Thank You', copies: 3,
    })
    expect(fromConfigRow(toConfigRow(original))).toEqual(original)
  })

  it('reads a row that predates these columns', () => {
    expect(fromConfigRow({ codEnabled: true })).toEqual(DEFAULT_PRINTER_SETTINGS)
  })

  it('reads a row with nulls where columns are unset', () => {
    expect(fromConfigRow({ printerPaperSize: null, printerCopies: null })).toEqual(DEFAULT_PRINTER_SETTINGS)
  })
})
