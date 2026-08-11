// Laundry printer settings — the small-business version, matching Commerce.
//
// Deliberately NOT a printer-management system: no discovery, no device
// registry, no queues, no drivers. It answers one question — "what shape is the
// paper, and what should go on it" — and the existing invoice/receipt rendering
// does the rest.
//
// Shape and naming follow the Commerce store printer tab (paper size, printer
// type, the three switches, header/footer, copies) so the two products feel
// like one. One deliberate difference: Commerce's "Printer Type" list mixes in
// connection types (bluetooth/usb/network), which say nothing about how the
// receipt should look. Laundry keeps the two values that change the output —
// THERMAL (narrow roll) and STANDARD (full page) — because that is what drives
// the layout and the preview.

export type PaperSize = "58mm" | "80mm" | "A4" | "custom"
export type PrinterType = "thermal" | "standard"

export interface PrinterSettings {
  paperSize: PaperSize
  /** Only meaningful when paperSize is "custom". */
  customWidthMm: number
  printerType: PrinterType
  autoPrintOrder: boolean
  printOnPayment: boolean
  includeQr: boolean
  headerText: string
  footerText: string
  copies: number
}

export const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: "58mm", label: "58mm (2 inch)" },
  { value: "80mm", label: "80mm (3 inch)" },
  { value: "A4", label: "A4 (Full page)" },
  { value: "custom", label: "Custom width" },
]

export const PRINTER_TYPES: { value: PrinterType; label: string }[] = [
  { value: "thermal", label: "Thermal" },
  { value: "standard", label: "Standard / Inkjet / Laser" },
]

export const COPY_OPTIONS = [1, 2, 3]

/** Narrowest and widest rolls worth accepting; outside this a value is a typo. */
export const MIN_WIDTH_MM = 40
export const MAX_WIDTH_MM = 120

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperSize: "80mm",
  customWidthMm: 80,
  printerType: "thermal",
  autoPrintOrder: false,
  printOnPayment: false,
  includeQr: true,
  headerText: "",
  footerText: "Thank you for your business!",
  copies: 1,
}

const isPaperSize = (v: unknown): v is PaperSize => PAPER_SIZES.some((p) => p.value === v)
const isPrinterType = (v: unknown): v is PrinterType => PRINTER_TYPES.some((p) => p.value === v)

/**
 * Coerce anything (a DB row, a request body, a stale localStorage blob) into a
 * complete, valid settings object. Every unknown value falls back to the
 * default rather than throwing — a bad printer setting must never be able to
 * stop someone printing.
 */
export function normalizePrinterSettings(raw: unknown): PrinterSettings {
  const r = (raw ?? {}) as Record<string, unknown>
  const d = DEFAULT_PRINTER_SETTINGS
  const width = Math.round(Number(r.customWidthMm))
  const copies = Math.round(Number(r.copies))
  return {
    paperSize: isPaperSize(r.paperSize) ? r.paperSize : d.paperSize,
    customWidthMm: Number.isFinite(width) && width >= MIN_WIDTH_MM && width <= MAX_WIDTH_MM ? width : d.customWidthMm,
    printerType: isPrinterType(r.printerType) ? r.printerType : d.printerType,
    autoPrintOrder: typeof r.autoPrintOrder === "boolean" ? r.autoPrintOrder : d.autoPrintOrder,
    printOnPayment: typeof r.printOnPayment === "boolean" ? r.printOnPayment : d.printOnPayment,
    includeQr: typeof r.includeQr === "boolean" ? r.includeQr : d.includeQr,
    headerText: typeof r.headerText === "string" ? r.headerText.slice(0, 300) : d.headerText,
    footerText: typeof r.footerText === "string" ? r.footerText.slice(0, 300) : d.footerText,
    copies: COPY_OPTIONS.includes(copies) ? copies : d.copies,
  }
}

/**
 * Is this a narrow roll? A4 is never a roll, and "custom" only counts as one
 * when the printer is thermal — a custom width on a laser printer is still a
 * sheet.
 */
export function isRoll(s: PrinterSettings): boolean {
  if (s.paperSize === "A4") return false
  if (s.paperSize === "custom") return s.printerType === "thermal"
  return true
}

/**
 * Physical paper width in mm, or null for a full page. This is the ONE place
 * the width is decided, so the preview and the print path can never disagree.
 */
export function paperWidthMm(s: PrinterSettings): number | null {
  if (!isRoll(s)) return null
  if (s.paperSize === "custom") return s.customWidthMm
  return s.paperSize === "58mm" ? 58 : 80
}

/**
 * Printable width — a thermal head does not reach the edge of the roll. ~7mm of
 * total margin is the usual allowance and keeps text off the tear line.
 */
export function printableWidthMm(s: PrinterSettings): number | null {
  const w = paperWidthMm(s)
  return w === null ? null : Math.max(30, w - 7)
}

/** The @page rule for a print window. Rolls print continuous, so height is auto. */
export function pageCss(s: PrinterSettings): string {
  const w = paperWidthMm(s)
  return w === null ? "@page{margin:16mm}" : `@page{size:${w}mm auto;margin:0}`
}

/** Characters per line at a typical monospace receipt size — used by the preview. */
export function receiptColumns(s: PrinterSettings): number {
  const w = printableWidthMm(s)
  if (w === null) return 80
  return Math.max(24, Math.round(w / 1.55))
}

// ── persistence mapping ─────────────────────────────────────────────────────
// The DB columns are prefixed (printerPaperSize…) because they share
// LaundryOperationalConfig with everything else; the app-side object is not.

/* eslint-disable @typescript-eslint/no-explicit-any */
export function fromConfigRow(c: any): PrinterSettings {
  return normalizePrinterSettings({
    paperSize: c?.printerPaperSize,
    customWidthMm: c?.printerCustomWidthMm,
    printerType: c?.printerType,
    autoPrintOrder: c?.printerAutoPrintOrder,
    printOnPayment: c?.printerPrintOnPayment,
    includeQr: c?.printerIncludeQr,
    headerText: c?.printerHeaderText,
    footerText: c?.printerFooterText,
    copies: c?.printerCopies,
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function toConfigRow(s: PrinterSettings) {
  return {
    printerPaperSize: s.paperSize,
    printerCustomWidthMm: s.customWidthMm,
    printerType: s.printerType,
    printerAutoPrintOrder: s.autoPrintOrder,
    printerPrintOnPayment: s.printOnPayment,
    printerIncludeQr: s.includeQr,
    printerHeaderText: s.headerText,
    printerFooterText: s.footerText,
    printerCopies: s.copies,
  }
}
