// Thermal garment-label printing — TSC TE244 (203 DPI) profile.
//
// The label carries TWO things and nothing else: a large Code 128 barcode of the
// Global Garment Number (GAR), and that same GAR in bold underneath. No garment
// name, service, customer, order number or quantity — every extra glyph steals
// width from the bars and costs first-scan reliability.
//
// SCAN RELIABILITY ON THERMAL PRINTERS comes from three things, all handled in
// computeLabelGeometry():
//   1. The narrow module must be a WHOLE number of printer dots. At 203 DPI one
//      dot is 0.125 mm; a fractional module makes the printer round some bars up
//      and others down, so bar widths become uneven and scanners misread them.
//   2. The image must print at its NATURAL size — one canvas pixel per printer
//      dot. Any CSS scaling (the old `width:98%`) resamples the bitmap and
//      smears bar edges, which is the classic cause of "sometimes it scans".
//   3. Quiet zones must survive. The bars take ~95% of the label and the
//      remainder is split evenly either side.
//
// IMPORTANT: printLabels() MUST be a pure side-effect — it opens a window and
// calls window.print(). It must NEVER mutate React state, call APIs, or trigger
// workflow transitions. See Bug 2.

import JsBarcode from "jsbarcode"

export interface LabelConfig {
  widthMm: number
  heightMm: number
  dpi: number // 203 | 300 | 600
  barcodeProfile?: BarcodeProfile
  moduleWidth?: number
  barcodeHeight?: number
  quietZone?: number
  fontSize?: number
  textPosition?: "top" | "bottom" | "hidden"
  marginLeft?: number
  marginRight?: number
  marginTop?: number
  marginBottom?: number
  scaling?: number
}

export type BarcodeProfile = "compact" | "standard" | "wide-scan" | "warehouse" | "custom"

// CODE128 encodes each character in 11 modules. A 15-character GAR code
// (GAR000000000001) requires 15 × 11 = 165 modules + start/stop + quiet zone.
// The width of each module (moduleWidth in pixels at 203 DPI) determines the
// physical barcode width. Narrow modules produce dense, hard-to-scan barcodes.
//
// Scanner minimums (industry standard):
//   Module width     ≥ 2 px @ 203 DPI  (≈ 0.25 mm per bar)
//   Quiet zone       ≥ 10 px            (≈ 1.25 mm)
//   Barcode height   ≥ 80 px            (≈ 10 mm)
//   Total barcode    ≥ 150 px per inch of label width
//
// Each profile is tuned for a specific label width.

export const BARCODE_PROFILES: Record<BarcodeProfile, { moduleWidth: number; barcodeHeight: number; quietZone: number; minModuleWidth: number; minBarcodeHeight: number; minQuietZone: number }> = {
  "compact":   { moduleWidth: 1.5, barcodeHeight: 100, quietZone: 6,  minModuleWidth: 1.2, minBarcodeHeight: 80,  minQuietZone: 5 },
  "standard":  { moduleWidth: 2.5, barcodeHeight: 160, quietZone: 10, minModuleWidth: 2,   minBarcodeHeight: 120, minQuietZone: 8 },
  "wide-scan": { moduleWidth: 3.5, barcodeHeight: 200, quietZone: 14, minModuleWidth: 2.5, minBarcodeHeight: 150, minQuietZone: 10 },
  "warehouse": { moduleWidth: 5,   barcodeHeight: 260, quietZone: 18, minModuleWidth: 3,   minBarcodeHeight: 200, minQuietZone: 12 },
  "custom":    { moduleWidth: 2.5, barcodeHeight: 160, quietZone: 10, minModuleWidth: 2,   minBarcodeHeight: 120, minQuietZone: 8 },
}

// Scanner quality rating based on barcode pixel density.
// Returns 1-5 stars and a label.
export interface ScannerQuality { stars: number; label: string }

/**
 * Rated against what actually drives handheld scan success on thermal labels:
 * whole-dot module width, quiet zone and bar height — measured from a real GAR
 * code at the configured label size rather than from the raw settings.
 */
export function scannerQuality(cfg: LabelConfig): ScannerQuality {
  const geo = computeLabelGeometry("GAR000000000001", cfg)
  if (!geo.fits || geo.modules === 0) return { stars: 1, label: "Unreliable" }
  const dotsPerMm = (cfg.dpi || 203) / 25.4
  const quietDots = geo.quietMm * dotsPerMm
  // 2-dot modules, ≥10-module quiet zone and ≥18mm bars is the reliable target.
  let score = 0
  if (geo.moduleDots >= 2) score += 2; else if (geo.moduleDots >= 1.5) score += 1
  if (quietDots >= geo.moduleDots * 10) score += 2
  else if (quietDots >= geo.moduleDots * 7) score += 1
  if (geo.barcodeHeightMm >= MIN_BARCODE_MM) score += 1
  const map: ScannerQuality[] = [
    { stars: 1, label: "Unreliable" }, { stars: 2, label: "Poor" }, { stars: 3, label: "Fair" },
    { stars: 4, label: "Good" }, { stars: 5, label: "Excellent" }, { stars: 5, label: "Excellent" },
  ]
  return map[Math.min(score, 5)]
}

export function resolveBarcodeOpts(cfg: LabelConfig) {
  const profile = cfg.barcodeProfile && cfg.barcodeProfile !== "custom" ? BARCODE_PROFILES[cfg.barcodeProfile] : null
  return {
    moduleWidth: cfg.moduleWidth ?? profile?.moduleWidth ?? 2.5,
    barcodeHeight: cfg.barcodeHeight ?? profile?.barcodeHeight ?? 160,
    quietZone: cfg.quietZone ?? profile?.quietZone ?? 10,
    fontSize: cfg.fontSize ?? 10,
    textPosition: cfg.textPosition ?? "bottom",
    marginLeft: cfg.marginLeft ?? 0.4,
    marginRight: cfg.marginRight ?? 0.4,
    marginTop: cfg.marginTop ?? 0.4,
    marginBottom: cfg.marginBottom ?? 0.4,
    scaling: cfg.scaling ?? 1,
  }
}

export type LabelLayoutOpts = ReturnType<typeof resolveBarcodeOpts>

// ─── TE244 label geometry ───────────────────────────────────────────────────
// Everything below is derived from the ACTUAL encoded barcode rather than
// assumed, so a longer code (legacy ORD-…-G1 garments) degrades predictably
// instead of running off the edge of the label.

// LAYOUT: 60mm (W) x 40mm (H).
// Both are fixed, but the WIDTH is a floor rather than a ceiling: if a code
// needs more than 60mm at full module width the label grows instead of the
// barcode being compressed. Nothing is ever squeezed to fit.
export const TARGET_MODULE_DOTS = 2   // narrow bar = 2 printer dots @203dpi = 0.25mm
export const FIXED_LABEL_HEIGHT_MM = 40
export const FIXED_LABEL_WIDTH_MM = 60
export const MIN_QUIET_MM = 3         // per the drawing: ≥3mm left and right
export const MIN_BARCODE_MM = 18
export const MAX_LABEL_WIDTH_MM = 108 // TE244 maximum printable width

/**
 * The width a code needs at FULL module width, including both quiet zones.
 * This is the whole point of the auto width: the module never shrinks, so a
 * longer code produces a longer label rather than a denser barcode.
 */
export function autoWidthMm(modules: number, dpi: number, moduleDots = TARGET_MODULE_DOTS): number {
  const dotsPerMm = dpi / 25.4
  const barsMm = (modules * moduleDots) / dotsPerMm
  return Math.ceil(barsMm + MIN_QUIET_MM * 2) // whole mm — a clean label pitch
}

/**
 * GAR type size that always fits the label width. The width is auto, so the
 * text has to be derived from it rather than fixed, otherwise a short code on a
 * narrow label would overflow.
 */
export function garFontPt(widthMm: number, chars: number): number {
  const usableMm = widthMm - MIN_QUIET_MM * 2
  // Courier advance ≈ 0.6em; convert mm → pt at 72pt/inch.
  const maxPt = (usableMm / Math.max(1, chars)) / 0.6 / (25.4 / 72)
  return Math.min(20, Math.max(7, Math.floor(maxPt)))
}

export interface LabelGeometry {
  moduleDots: number       // whole printer dots per narrow module
  modules: number          // encoded module count (bars only, no quiet zone)
  barsMm: number           // printed width of the bars
  quietMm: number          // quiet zone per side
  imageWidthMm: number     // natural print width of the <img> — never scaled
  barcodeHeightMm: number
  fits: boolean            // false → code too long for this label even at 1 dot
}

/**
 * Module count of the encoded symbol, measured by rendering a 1px-per-module
 * probe. Measuring beats deriving: it stays correct for any value and any
 * Code 128 subset switching JsBarcode chooses.
 */
function code128Modules(value: string): number {
  try {
    const probe = document.createElement("canvas")
    JsBarcode(probe, value, { format: "CODE128", displayValue: false, margin: 0, height: 1, width: 1 })
    return probe.width || 0
  } catch { return 0 }
}

/**
 * Pure fitting maths — the part that decides scan reliability, kept free of the
 * DOM so it can be tested directly.
 *
 * FLOOR, never round: a single dot of overshoot makes the image wider than the
 * label, and the label clips overflow — which would eat the quiet zone or the
 * outermost bars. Horizontal margins are 0 by design (see buildHTML): on a
 * thermal label the computed quiet zone IS the margin, and spending millimetres
 * on CSS padding would only shrink it.
 */
export function fitBarcode(modules: number, widthMm: number, dpi: number, targetModuleDots = TARGET_MODULE_DOTS) {
  const dotsPerMm = dpi / 25.4
  const labelDots = Math.floor(widthMm * dotsPerMm)
  // The module width is FIXED — the label width was computed to accommodate it,
  // so there is nothing to shrink. It only steps down if a caller forces a width
  // too narrow for the code (e.g. a code longer than the printer's 108mm limit).
  const minNeeded = Math.ceil(MIN_QUIET_MM * dotsPerMm) * 2
  let moduleDots = Math.max(1, Math.round(targetModuleDots))
  while (moduleDots > 1 && modules * moduleDots + minNeeded > labelDots) moduleDots--

  const barDots = modules * moduleDots
  const quietDots = Math.max(0, Math.floor((labelDots - barDots) / 2))
  // fits = full module width AND the drawing's ≥3mm quiet zone both honoured.
  const fits = modules > 0 && moduleDots >= Math.round(targetModuleDots) && quietDots >= Math.ceil(MIN_QUIET_MM * dotsPerMm)
  const imageDots = barDots + quietDots * 2
  // Never wider than the label — the label clips overflow, and a clipped symbol
  // is unscannable 100% of the time.
  const imageWidthMm = Math.min(imageDots / dotsPerMm, widthMm)
  return {
    moduleDots, barDots, quietDots, imageDots, fits, dotsPerMm,
    barsMm: barDots / dotsPerMm,
    quietMm: quietDots / dotsPerMm,
    imageWidthMm,
  }
}

/** Vertical space the GAR line needs at a given type size. */
export function textBlockMm(fontPt: number): number {
  return (fontPt / 72) * 25.4 * 1.3 // pt → mm, plus line-height headroom
}

export function computeLabelGeometry(value: string, cfg: LabelConfig, widthMm?: number): LabelGeometry {
  const dpi = cfg.dpi || 203
  const modules = code128Modules(value)
  const w = widthMm ?? autoWidthMm(modules, dpi, cfg.moduleWidth ?? TARGET_MODULE_DOTS)
  const f = fitBarcode(modules, w, dpi, cfg.moduleWidth ?? TARGET_MODULE_DOTS)

  // HEIGHT IS FIXED at 40mm. The bars take whatever remains after the GAR line
  // and the margins — no density maths, because the width already guarantees a
  // full-size module.
  const opts = resolveBarcodeOpts(cfg)
  const h = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const fontPt = garFontPt(w, value.length)
  const free = h - opts.marginTop - opts.marginBottom - textBlockMm(fontPt) - 1.2
  const barcodeHeightMm = Math.max(MIN_BARCODE_MM, free)

  return {
    moduleDots: f.moduleDots, modules,
    barsMm: f.barsMm, quietMm: f.quietMm, imageWidthMm: f.imageWidthMm,
    barcodeHeightMm, fits: f.fits,
  }
}

/**
 * ONE size for the whole print job.
 *
 * Height is the fixed 40mm. Width is AUTO — the widest code in the batch decides
 * it, so no barcode is ever compressed. Every label in the run gets that same
 * size: thermal printers feed on a fixed pitch, and varying the size between
 * labels would misalign every one after the first.
 */
export function computeJobLayout(values: string[], cfg: LabelConfig) {
  const dpi = cfg.dpi || 203
  const target = Math.max(1, Math.round(cfg.moduleWidth ?? TARGET_MODULE_DOTS))
  const maxModules = values.reduce((m, v) => Math.max(m, code128Modules(v)), 0)

  // Widest code decides the size. Normally that is the full module width; only a
  // code too long for the TE244's 108mm head forces a narrower module — and then
  // the label is sized to what THAT module needs, not padded out to the cap.
  let moduleDots = target
  let widest = autoWidthMm(maxModules, dpi, moduleDots)
  while (moduleDots > 1 && widest > MAX_LABEL_WIDTH_MM) {
    moduleDots--
    widest = autoWidthMm(maxModules, dpi, moduleDots)
  }

  // 60mm is the configured size and acts as a FLOOR — a longer code widens the
  // label rather than compressing the barcode.
  const widthMm = Math.min(MAX_LABEL_WIDTH_MM, Math.max(cfg.widthMm || FIXED_LABEL_WIDTH_MM, widest, 25))
  const heightMm = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const geos = values.map((v) => computeLabelGeometry(v, { ...cfg, moduleWidth: moduleDots }, widthMm))
  return {
    widthMm, heightMm, geos, moduleDots,
    fontPt: garFontPt(widthMm, values.reduce((m, v) => Math.max(m, v.length), 1)),
    anyOversized: geos.some((g) => !g.fits),
  }
}

// 40 × 30 mm landscape on the TE244 at 203 DPI.
// 60mm (W) x 40mm (H). Width is a floor: computeJobLayout widens it if a code
// needs more room, so the barcode is never compressed.
export const DEFAULT_LABEL_CONFIG: LabelConfig = { widthMm: FIXED_LABEL_WIDTH_MM, heightMm: FIXED_LABEL_HEIGHT_MM, dpi: 203 }
// Versioned: earlier keys hold sizes from the previous layouts (v1 fixed 20mm,
// v2 fixed 40mm WIDTH). This layout inverts that — 40mm HEIGHT, auto width — so
// v3 starts every workstation on the current defaults. Old keys are left alone.
const KEY = "qx-laundry-label-config-v4"
export function loadLabelConfig(): LabelConfig {
  if (typeof window === "undefined") return DEFAULT_LABEL_CONFIG
  try { return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return DEFAULT_LABEL_CONFIG }
}
export function saveLabelConfig(c: LabelConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch {} }

export interface LabelData { itemNumber: string; garment: string; service: string; garScanCode?: string | null; orderNumber?: string; storeName?: string }

/**
 * Render the bars at EXACTLY the computed geometry: `width` is whole printer
 * dots per module and `margin` is the quiet zone in the same dots, so one
 * canvas pixel equals one printer dot. The library's own human-readable text is
 * off — the GAR is printed separately underneath where we control the size.
 */
function barcodeDataURL(value: string, cfg: LabelConfig, geo: LabelGeometry): string {
  const dotsPerMm = (cfg.dpi || 203) / 25.4
  const canvas = document.createElement("canvas")
  try {
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      margin: Math.round(geo.quietMm * dotsPerMm),
      height: Math.round(geo.barcodeHeightMm * dotsPerMm),
      width: geo.moduleDots,
      background: "#ffffff",
      lineColor: "#000000",
    })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

function buildHTML(labels: LabelData[], cfg: LabelConfig): string {
  const opts = resolveBarcodeOpts(cfg)
  const values = labels.map((l) => l.garScanCode || l.itemNumber)
  // Height 40mm FIXED; width AUTO, sized so the barcode is never compressed.
  const job = computeJobLayout(values, cfg)
  const w = job.widthMm, h = job.heightMm
  const garPt = job.fontPt
  const rows = labels.map((l, i) => {
    const bcValue = values[i]
    const geo = job.geos[i]
    const bc = barcodeDataURL(bcValue, cfg, geo)
    // The image is given its NATURAL width in mm — never a percentage — so the
    // browser hands the printer a 1:1 bitmap with no resampling.
    return `<div class="label">
        ${bc ? `<img class="bc" src="${bc}" alt="" style="width:${geo.imageWidthMm.toFixed(3)}mm;height:${geo.barcodeHeightMm.toFixed(3)}mm"/>` : ""}
        <div class="gar">${escapeHtml(bcValue)}</div>
      </div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
    /* Horizontal padding is 0 on purpose — the barcode carries its own quiet
       zone, so CSS padding here would subtract from it rather than add to it. */
    .label { width:${w}mm; height:${h}mm; padding:${opts.marginTop}mm 0 ${opts.marginBottom}mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; overflow:hidden; }
    /* No scaling and no smoothing — the bitmap must reach the printer dot-for-dot. */
    .bc { display:block; image-rendering: pixelated; image-rendering: crisp-edges; margin:0 0 0.8mm; }
    .gar { font-family:'Courier New',monospace; font-weight:700; font-size:${garPt}pt; letter-spacing:0.5px; line-height:1.1; color:#000; white-space:nowrap; }
    @media screen { body{background:#eef2f7;padding:10px;} .label{border:1px dashed #cbd5e1;margin:6px auto;background:#fff;border-radius:2px;} }
  </style></head><body>${rows.join("")}</body></html>`
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

// The print/PDF filename: a single garment → its Item ID (falls back to the GAR
// code); multiple → the order number. Sanitised for use as a file name.
function printJobName(labels: LabelData[]): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "labels"
  if (labels.length === 1) {
    const l = labels[0]
    return clean(l.itemNumber || l.garScanCode || l.orderNumber || "label")
  }
  const order = labels.find((l) => l.orderNumber)?.orderNumber
  return clean(order ? `${order}-labels` : "labels")
}

// PURE side-effect: opens print window, no state mutation, no API calls.
// The returned Promise resolves when the window opens so callers can continue
// without blocking on the print dialog.
export function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || labels.length === 0) { resolve(); return }
    const html = buildHTML(labels, cfg)

    // PREVIEW: open in a tab so staff can eyeball the labels (explicit user intent).
    if (!autoPrint) {
      const win = window.open("", "_blank", "width=420,height=640")
      if (win) { win.document.open(); win.document.write(html); win.document.close() }
      resolve(); return
    }

    // PRINT: render into a hidden, same-page iframe and print THAT — never a popup.
    // A popup window is unreliable here: it can be blocked, it can leave a stuck
    // blank window, and window.print() on it froze the app for some users. The
    // iframe prints only the labels (its own document + @page size) and is removed
    // afterwards. Barcodes are inline data-URIs, so no external load to wait on.
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;"
    document.body.appendChild(iframe)

    // The browser derives the "Save as PDF" filename from the TOP document's title
    // (not the iframe's), so set it to the garment/order id while printing and
    // restore it after — otherwise the file is named after the app's <title>.
    const jobName = printJobName(labels)
    const prevTitle = document.title

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      document.title = prevTitle
      setTimeout(() => { try { iframe.remove() } catch { /* noop */ } }, 1000)
    }

    const doc = iframe.contentWindow?.document
    if (!doc || !iframe.contentWindow) { try { iframe.remove() } catch { /* noop */ }; resolve(); return }
    doc.open(); doc.write(html); doc.close()
    try { doc.title = jobName } catch { /* noop */ }

    let printed = false
    const printNow = () => {
      if (printed) return
      printed = true
      document.title = jobName
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { /* noop */ }
      resolve()
      cleanup()
    }
    // onload usually fires for a written doc; a short timeout is the safety net.
    iframe.contentWindow.onafterprint = cleanup
    iframe.onload = printNow
    setTimeout(printNow, 300)
  })
}
