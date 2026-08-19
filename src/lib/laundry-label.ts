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
//   3. Quiet zones must survive, INSIDE a 2mm safe margin that no ink may enter.
//      Bars are sized to be read rather than to fill the label: a 15-char GAR
//      occupies ~36mm of the 50mm width, and the rest is deliberate white space.
//
// IMPORTANT: printLabels() MUST be a pure side-effect — it opens a window and
// calls window.print(). It must NEVER mutate React state, call APIs, or trigger
// workflow transitions. See Bug 2.
//
// ORIENTATION — why there are two boxes, not one.
//
// A browser decides the print job's orientation from the @page size: wider than
// tall is a LANDSCAPE job, taller than wide is PORTRAIT. The driver holds its own
// orientation for the loaded stock. When the two DISAGREE the driver rotates the
// raster 90° to reconcile them, and a 50mm-wide barcode lands on the 38.1mm feed
// axis — rotated and clipped. That disagreement, not the barcode, is the bug.
//
// So two dimensions are tracked separately and neither is guessed:
//   stockHeightMm  the PHYSICAL label pitch (38.1mm). This is the @page height,
//                  so the declared page is the loaded media exactly — nothing for
//                  a driver to scale or fit.
//   heightMm       the CONTENT box (30mm) the barcode and GAR are laid out in.
//                  Barcode geometry is derived from this and this alone, so the
//                  page can match the stock without resizing a single bar.
//
// orientation states which way the driver is set, and the page is declared to
// AGREE with it. Landscape (the TE244 default for this stock) declares 50 × 38.1
// and draws upright. Portrait declares 38.1 × 50 and pre-rotates the content 90°,
// so the ink lands identically on the label when the driver cannot be changed.

import JsBarcode from "jsbarcode"
import QRCode from "qrcode"

/**
 * Which way the PRINTER is set for the loaded stock. The page is declared to
 * match; see the orientation note at the top of the file.
 */
export type LabelOrientation = "landscape" | "portrait"

export interface LabelConfig {
  widthMm: number
  /** Content box — what the barcode and GAR are laid out in. NOT the page. */
  heightMm: number
  /** Physical label pitch — the @page height. Defaults to the 38.1mm TE244 stock. */
  stockHeightMm?: number
  orientation?: LabelOrientation
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

// LAYOUT: 50mm (W) x 38.1mm (H) landscape — the physical die-cut stock. The
// barcode and GAR live in a 50 x 30mm content box centred on it.
//
// BOTH ARE HARD. The printed page is exactly the label, so @page, the .page box
// and the media in the printer all agree; a page that disagrees with the stock is
// what makes a driver scale, rotate or clip, and any of those ruins the print.
//
// The previous layout treated width as a FLOOR and grew both the module and the
// bar height to consume every spare millimetre. That is why the customer's sample
// shows a barcode filling the label with the GAR crammed against the bottom edge.
// Bars are now sized to be READ, not to fill: a 2-dot module is the scanner
// optimum at 203 DPI, and anything past it is spent on white space that keeps the
// symbol clear of the edges.
export const TARGET_MODULE_DOTS = 2   // narrow bar: 2 dots @203dpi = 0.25mm
export const MAX_MODULE_DOTS = 3      // past 3 dots a 15-char GAR outgrows 50mm
/** CONTENT box height. Barcode geometry is derived from this, so it must not be
 *  moved to chase the stock — that would resize the bars. */
export const FIXED_LABEL_HEIGHT_MM = 30
/** PHYSICAL stock pitch: TSC TE244 die-cut 1.97in x 1.50in. This is the @page height. */
export const STOCK_HEIGHT_MM = 38.1
export const FIXED_LABEL_WIDTH_MM = 50
/** The TE244 is set to Landscape for this stock, so the page is declared landscape too. */
export const DEFAULT_ORIENTATION: LabelOrientation = "landscape"
export const MIN_QUIET_MM = 2.5       // Code 128 standard, measured from the bars
export const MIN_BARCODE_MM = 18
export const MAX_LABEL_WIDTH_MM = 108 // TE244 maximum printable width

/**
 * Ink-free border on every side. Nothing — bars, quiet zone or text — is allowed
 * inside it, so a millimetre of feed drift or die-cut tolerance cannot clip the
 * symbol. This is ON TOP of the Code 128 quiet zone, not a substitute for it.
 */
export const SAFE_MARGIN_MM = 2

/**
 * Ceiling on bar height, as a share of the label. Previously the bars simply took
 * whatever vertical space was left over — on a 40mm label that was 30mm, i.e. 75%
 * of the label, which is exactly the oversized result being reported. Code 128 is
 * a 1-D symbology: height past ~20mm buys no scan reliability, it only crowds the
 * human-readable line.
 */
export const MAX_BARCODE_HEIGHT_FRACTION = 0.55

/** Largest GAR type size. Auto-sizing from label width reached 17pt at 60mm — a
 *  7.8mm text block that pushed itself onto the bottom edge. */
export const MAX_GAR_PT = 10

/** Printable width once both safe margins are removed. */
export function usableWidthMm(widthMm: number): number {
  return Math.max(0, widthMm - SAFE_MARGIN_MM * 2)
}

/**
 * The LARGEST whole-dot module a code can use on a given label while keeping the
 * minimum quiet zone. Bars are grown to fill the label, because a wider bar is
 * what a scanner reads most reliably — width is never left unused.
 *
 * Returns 0 when the code will not fit even at one dot.
 */
export function bestModuleDots(modules: number, widthMm: number, dpi: number): number {
  if (modules <= 0) return 0
  const dotsPerMm = dpi / 25.4
  // Measured across the SAFE area, not the whole label — the outer 2mm is not
  // available to the symbol, and pretending it is puts bars near the edge.
  const labelDots = Math.floor(usableWidthMm(widthMm) * dotsPerMm)
  const quietDots = Math.ceil(MIN_QUIET_MM * dotsPerMm)
  const usable = labelDots - quietDots * 2
  return Math.max(0, Math.min(MAX_MODULE_DOTS, Math.floor(usable / modules)))
}

/**
 * The width a code needs at a given module width, including both quiet zones.
 * Used when a code is too long for the configured label: the label widens rather
 * than the barcode being compressed.
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
  const usableMm = usableWidthMm(widthMm)
  // Courier advance ≈ 0.6em; convert mm → pt at 72pt/inch.
  const maxPt = (usableMm / Math.max(1, chars)) / 0.6 / (25.4 / 72)
  // Capped: the width-derived size is a CEILING for fitting on one line, never a
  // target. Bigger type here only steals height from the bars and the margin.
  return Math.min(MAX_GAR_PT, Math.max(7, Math.floor(maxPt)))
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
  // fits = at least the floor module width AND the minimum quiet zone.
  const fits = modules > 0 && moduleDots >= TARGET_MODULE_DOTS && quietDots >= Math.ceil(MIN_QUIET_MM * dotsPerMm)
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

/** Breathing room between the bars and the GAR line. */
export const BARCODE_TEXT_GAP_MM = 1.2

/** Vertical space the GAR line needs at a given type size. */
export function textBlockMm(fontPt: number): number {
  return (fontPt / 72) * 25.4 * 1.3 // pt → mm, plus line-height headroom
}

export function computeLabelGeometry(value: string, cfg: LabelConfig, widthMm?: number): LabelGeometry {
  const dpi = cfg.dpi || 203
  const modules = code128Modules(value)
  const w = widthMm ?? autoWidthMm(modules, dpi, cfg.moduleWidth ?? TARGET_MODULE_DOTS)
  // Fit inside the safe area. fitBarcode centres the image across whatever width
  // it is handed, so handing it the label width would push the image to the very
  // edges; the CSS padding then supplies the untouchable border.
  const f = fitBarcode(modules, usableWidthMm(w), dpi, cfg.moduleWidth ?? TARGET_MODULE_DOTS)

  // HEIGHT: the bars get a CAPPED share, not the leftovers. Cap first, then the
  // free space, so a short label still cannot overflow.
  const h = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const fontPt = garFontPt(w, value.length)
  const free = h - SAFE_MARGIN_MM * 2 - textBlockMm(fontPt) - BARCODE_TEXT_GAP_MM
  const barcodeHeightMm = Math.max(
    Math.min(MIN_BARCODE_MM, free),           // never overflow, even on a tiny label
    Math.min(h * MAX_BARCODE_HEIGHT_FRACTION, free),
  )

  return {
    moduleDots: f.moduleDots, modules,
    barsMm: f.barsMm, quietMm: f.quietMm, imageWidthMm: f.imageWidthMm,
    barcodeHeightMm, fits: f.fits,
  }
}

export interface PageBox {
  pageWidthMm: number
  pageHeightMm: number
  /** Degrees the CONTENT is turned inside the page. 0 when the driver agrees. */
  rotateDeg: 0 | 90
}

/**
 * The @page box for a given driver orientation, and how far the content has to
 * be turned inside it.
 *
 * LANDSCAPE — the driver is set the way the stock is loaded (50mm across the
 * head). The page is declared 50 x 38.1: wider than tall, which is a landscape
 * job, so the browser and the driver agree and NOBODY rotates. Content upright.
 *
 * PORTRAIT — the driver insists on a portrait job. The page is declared
 * 38.1 x 50 so it still matches the media the driver expects, and the content is
 * turned 90° inside it. The driver's own rotation then undoes ours and the ink
 * lands exactly as it does in landscape: barcode across the 50mm web, full size.
 *
 * Either way the 50mm content width lies along the page's 50mm axis, so the
 * barcode cannot be clipped by the page in either mode.
 */
export function pageBoxFor(orientation: LabelOrientation, widthMm: number, stockHeightMm: number): PageBox {
  return orientation === "portrait"
    ? { pageWidthMm: stockHeightMm, pageHeightMm: widthMm, rotateDeg: 90 }
    : { pageWidthMm: widthMm, pageHeightMm: stockHeightMm, rotateDeg: 0 }
}

/**
 * The stock pitch actually used. Never shorter than the content box — a page
 * smaller than what sits on it is the other way to clip a barcode.
 */
export function resolveStockHeightMm(cfg: LabelConfig): number {
  const content = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  return Math.max(content, cfg.stockHeightMm ?? STOCK_HEIGHT_MM)
}

/**
 * ONE size for the whole print job.
 *
 * Content height is fixed. Width is AUTO — the widest code in the batch decides
 * it, so no barcode is ever compressed. Every label in the run gets that same
 * size: thermal printers feed on a fixed pitch, and varying the size between
 * labels would misalign every one after the first.
 */
export function computeJobLayout(values: string[], cfg: LabelConfig) {
  const dpi = cfg.dpi || 203
  const labelWidth = cfg.widthMm || FIXED_LABEL_WIDTH_MM
  const maxModules = values.reduce((m, v) => Math.max(m, code128Modules(v)), 0)

  // THE PAGE IS THE STOCK. Width stays exactly as configured for every code that
  // fits, because @page is what the driver matches against the loaded media — a
  // page wider than the label is precisely what produces a scaled or clipped
  // print. bestModuleDots already caps at MAX_MODULE_DOTS and measures inside the
  // safe area, so the bars land well clear of the edges.
  let moduleDots = cfg.moduleWidth ?? bestModuleDots(maxModules, labelWidth, dpi)
  let widthMm = labelWidth

  // ESCAPE HATCH, not the normal path: a legacy ORD-…-G1 item number encodes to
  // ~442 modules and physically cannot fit 50mm at even one dot. Printing it
  // clipped would guarantee an unscannable label, so that job — and only that
  // job — widens. Every GAR code fits, so GAR labels are always exactly 50×38.
  if (moduleDots < 1) {
    moduleDots = TARGET_MODULE_DOTS
    let needed = autoWidthMm(maxModules, dpi, moduleDots) + SAFE_MARGIN_MM * 2
    while (moduleDots > 1 && needed > MAX_LABEL_WIDTH_MM) {
      moduleDots--
      needed = autoWidthMm(maxModules, dpi, moduleDots) + SAFE_MARGIN_MM * 2
    }
    widthMm = Math.min(MAX_LABEL_WIDTH_MM, Math.max(labelWidth, needed, 25))
  }

  const heightMm = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const geos = values.map((v) => computeLabelGeometry(v, { ...cfg, moduleWidth: moduleDots }, widthMm))
  const stockHeightMm = resolveStockHeightMm({ ...cfg, heightMm })
  const orientation = cfg.orientation ?? DEFAULT_ORIENTATION
  return {
    widthMm, heightMm, stockHeightMm, orientation,
    page: pageBoxFor(orientation, widthMm, stockHeightMm),
    geos, moduleDots,
    fontPt: garFontPt(widthMm, values.reduce((m, v) => Math.max(m, v.length), 1)),
    anyOversized: geos.some((g) => !g.fits),
  }
}

// 50mm (W) x 38.1mm (H) stock, printed LANDSCAPE on the TE244 at 203 DPI, with
// the barcode and GAR in a 50 x 30mm content box centred on it.
export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  widthMm: FIXED_LABEL_WIDTH_MM,
  heightMm: FIXED_LABEL_HEIGHT_MM,
  stockHeightMm: STOCK_HEIGHT_MM,
  orientation: DEFAULT_ORIENTATION,
  dpi: 203,
}

// VERSIONED, and the version MUST be bumped whenever the physical size changes.
//
// loadLabelConfig merges the saved object OVER the defaults, so a workstation
// that once saved {widthMm:60, heightMm:40} keeps printing 60x40 no matter what
// DEFAULT_LABEL_CONFIG says. That is a large part of why the customer's label
// stayed oversized: the new size never reached the terminal that had a stale
// entry. v5 abandons those keys, so every workstation starts at 50x38.
//
// v6 adds the stock/orientation split. A v5 blob carries neither key, so merging
// it would leave the page at the CONTENT height and the orientation unstated —
// exactly the mismatch that made the driver rotate. Bumping drops those blobs so
// every workstation starts at 50 x 38.1 landscape with a 50 x 30 content box,
// which is the barcode size already in use.
const KEY = "qx-laundry-label-config-v6"
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

// ─── The printed page ───────────────────────────────────────────────────────
// ONE page shell for every label type. The @page rule, the stock-sized .page
// box, the centred content box, the safe margin and the driver-compensating
// rotation are decided here and NOWHERE else, so a garment barcode and a bag QR
// physically land on the stock the same way. A label type only supplies the ink
// that goes inside the content box (its own CSS and its own markup).

/** What a label type contributes to the shared page: its CSS and its content. */
interface LabelDocument {
  title: string
  page: PageBox
  /** Content box, centred on the stock. */
  widthMm: number
  heightMm: number
  /** Physical stock pitch — what the .page box is on screen. */
  stockHeightMm: number
  /** Rules for the label type's own elements. Must state every size in mm/pt. */
  css: string
  /** One `<div class="page"><div class="label">…</div></div>` per label. */
  body: string
}

function renderLabelDocument(d: LabelDocument): string {
  const { pageWidthMm: pw, pageHeightMm: ph, rotateDeg } = d.page
  const w = d.widthMm, h = d.heightMm
  // The content box is CENTRED on the stock, stated in millimetres rather than
  // percentages so a rotation cannot change where it lands.
  const left = (pw - w) / 2, top = (ph - h) / 2
  // EVERY dimension below is in millimetres. No percentages, no vw/vh, no
  // transform: scale() — the page, the box and the bitmap are all stated in
  // physical units so the browser has nothing to reinterpret at print time.
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(d.title)}</title><style>
    /* The page IS the stock, in the orientation the printer is set to. Zero
       margin, and the size declared here is what the driver matches to the loaded
       media — print at 100% / Actual Size, never "Fit to page", which would
       rescale all of this. A page that disagrees with the driver's orientation is
       what makes it rotate the label 90° and clip the bars. */
    @page { size: ${pw}mm ${ph}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
    /* One .page per physical label, exactly the stock pitch. */
    .page { position:relative; width:${pw}mm; height:${ph}mm; overflow:hidden; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    /* SAFE MARGIN on all four sides. A symbol still carries its own quiet zone
       INSIDE this box — the two add up rather than one replacing the other — so
       feed drift cannot bring a bar or a QR module to the edge.
       The rotation is turned about the box's own centre, so the content stays
       centred on the stock and the 50mm width always lies along the page's 50mm
       axis — full size, nothing clipped, nothing re-scaled. */
    .label { position:absolute; left:${left.toFixed(3)}mm; top:${top.toFixed(3)}mm; width:${w}mm; height:${h}mm; padding:${SAFE_MARGIN_MM}mm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; transform: rotate(${rotateDeg}deg); transform-origin: 50% 50%; }
    /* The human-readable code under the symbol. */
    .gar { font-family:'Courier New',monospace; font-weight:700; letter-spacing:0.5px; line-height:1.1; color:#000; white-space:nowrap; }
${d.css}
    /* On screen the label is shown the way it lands on the stock — upright, at
       the physical 50 x 38.1 — so a preview stays readable whichever orientation
       the printer needs. The rotation is a driver compensation, not a design. */
    @media screen {
      body { background:#eef2f7; padding:10px; }
      .page { width:${w}mm; height:${d.stockHeightMm}mm; margin:6px auto; border:1px dashed #cbd5e1; background:#fff; border-radius:2px; }
      .label { left:0; top:${((d.stockHeightMm - h) / 2).toFixed(3)}mm; transform:none; }
    }
  </style></head><body>${d.body}</body></html>`
}

/**
 * Exported for tests: the @page rule this emits is what the driver reconciles
 * against the loaded media, so it is the one line that decides whether the label
 * prints straight or gets rotated and clipped. It is worth asserting directly.
 */
export function buildHTML(labels: LabelData[], cfg: LabelConfig): string {
  const values = labels.map((l) => l.garScanCode || l.itemNumber)
  // 50 x 38.1mm stock, 50 x 30mm content. One size for the whole run — thermal
  // stock feeds on a fixed pitch, so a per-label size would misregister
  // everything after the first.
  const job = computeJobLayout(values, cfg)
  const rows = labels.map((l, i) => {
    const bcValue = values[i]
    const geo = job.geos[i]
    const bc = barcodeDataURL(bcValue, cfg, geo)
    // The image is given its NATURAL width in mm — never a percentage — so the
    // browser hands the printer a 1:1 bitmap with no resampling.
    return `<div class="page"><div class="label">
        ${bc ? `<img class="bc" src="${bc}" alt="" style="width:${geo.imageWidthMm.toFixed(3)}mm;height:${geo.barcodeHeightMm.toFixed(3)}mm"/>` : ""}
        <div class="gar">${escapeHtml(bcValue)}</div>
      </div></div>`
  })
  return renderLabelDocument({
    title: "Labels",
    page: job.page,
    widthMm: job.widthMm,
    heightMm: job.heightMm,
    stockHeightMm: job.stockHeightMm,
    css: `    /* No scaling and no smoothing — the bitmap must reach the printer dot-for-dot. */
    .bc { display:block; image-rendering: pixelated; image-rendering: crisp-edges; margin:0 0 ${BARCODE_TEXT_GAP_MM}mm; }
    .gar { font-size:${job.fontPt}pt; }`,
    body: rows.join(""),
  })
}

// ─── Bag QR labels ──────────────────────────────────────────────────────────
// A reusable bag carries a QR rather than a Code 128, because a bag is scanned
// off a crumpled, folded surface from whatever angle the executive is holding
// their phone — a 2-D symbol survives that, a 1-D barcode does not.
//
// Everything else is the garment label: the SAME TE244, the SAME 50 x 38.1mm
// stock, the SAME saved LabelConfig (loadLabelConfig), the SAME @page contract
// with the driver and the SAME hidden-iframe print. Only the ink differs. There
// is no second printer configuration and nothing for staff to set up twice.
//
// The QR obeys the same two rules that make a thermal symbol scan:
//   1. A module is a WHOLE number of printer dots, so the printer never rounds
//      one module up and its neighbour down.
//   2. The image prints at its NATURAL size — one canvas pixel per printer dot,
//      never a CSS percentage — so no resampling smears the module edges.

/** Quiet zone around a QR, in modules. 4 is the ISO/IEC 18004 minimum. */
export const QR_QUIET_MODULES = 4
/** Below 2 dots a module the TE244 cannot hold the module edges apart. */
export const MIN_QR_MODULE_DOTS = 2
/** M tolerates ~15% damage — the right level for a bag that gets wet and creased. */
export const QR_ERROR_CORRECTION = "M" as const

export interface BagLabelData {
  bagNumber: string
  /** What the QR encodes. Bags store qrValue === bagNumber; falls back to it. */
  qrValue?: string | null
}

export interface QrGeometry {
  /** Symbol size in modules, excluding the quiet zone. */
  matrixModules: number
  /** Symbol + both quiet zones — what is actually printed. */
  totalModules: number
  moduleDots: number
  sizeMm: number
  /** false → the label cannot hold a reliably scannable QR at this size. */
  fits: boolean
}

/** Modules across the QR symbol for a value. Measured, never assumed. */
function qrModules(value: string): number {
  try { return QRCode.create(value, { errorCorrectionLevel: QR_ERROR_CORRECTION }).modules.size } catch { return 0 }
}

/**
 * The largest whole-dot QR that fits the content box with the safe margin and
 * the bag code still on the label. A QR is square, so it is bounded by the
 * SHORTER of the two: the label's usable width, or what is left of its height
 * once the code line and the gap are taken out.
 */
export function computeQrGeometry(value: string, cfg: LabelConfig, codeChars = value.length): QrGeometry {
  const dpi = cfg.dpi || 203
  const dotsPerMm = dpi / 25.4
  const w = cfg.widthMm || FIXED_LABEL_WIDTH_MM
  const h = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const fontPt = garFontPt(w, codeChars)
  const availMm = Math.min(
    usableWidthMm(w),
    h - SAFE_MARGIN_MM * 2 - textBlockMm(fontPt) - BARCODE_TEXT_GAP_MM,
  )
  const matrixModules = qrModules(value)
  if (matrixModules <= 0 || availMm <= 0) return { matrixModules: 0, totalModules: 0, moduleDots: 0, sizeMm: 0, fits: false }
  const totalModules = matrixModules + QR_QUIET_MODULES * 2
  // FLOOR, never round: one dot of overshoot makes the image wider than the
  // content box, and the box clips overflow — which would eat the quiet zone.
  const moduleDots = Math.max(0, Math.floor((availMm * dotsPerMm) / totalModules))
  return {
    matrixModules, totalModules, moduleDots,
    sizeMm: (totalModules * moduleDots) / dotsPerMm,
    fits: moduleDots >= MIN_QR_MODULE_DOTS,
  }
}

/**
 * ONE size for the whole run, exactly as the garment labels do it: the QR that
 * needs the most modules sets the module width for every label in the batch, so
 * a mixed run cannot register differently label to label.
 */
export function computeBagJobLayout(bags: BagLabelData[], cfg: LabelConfig) {
  const widthMm = cfg.widthMm || FIXED_LABEL_WIDTH_MM
  const heightMm = cfg.heightMm || FIXED_LABEL_HEIGHT_MM
  const codeChars = bags.reduce((m, b) => Math.max(m, b.bagNumber.length), 1)
  const geos = bags.map((b) => computeQrGeometry(b.qrValue || b.bagNumber, { ...cfg, widthMm, heightMm }, codeChars))
  const moduleDots = geos.reduce((m, g) => Math.min(m, g.moduleDots), Number.POSITIVE_INFINITY)
  const dotsPerMm = (cfg.dpi || 203) / 25.4
  const stockHeightMm = resolveStockHeightMm({ ...cfg, heightMm })
  const orientation = cfg.orientation ?? DEFAULT_ORIENTATION
  return {
    widthMm, heightMm, stockHeightMm, orientation,
    page: pageBoxFor(orientation, widthMm, stockHeightMm),
    geos,
    moduleDots: Number.isFinite(moduleDots) ? moduleDots : 0,
    // Every QR in the run is drawn at the shared module width, so its printed
    // size follows its own module count.
    sizeMmFor: (g: QrGeometry) => (g.totalModules * (Number.isFinite(moduleDots) ? moduleDots : 0)) / dotsPerMm,
    fontPt: garFontPt(widthMm, codeChars),
    anyOversized: geos.some((g) => !g.fits),
  }
}

/**
 * Exported for tests, for the same reason buildHTML is: the @page rule is the
 * contract with the driver, and a bag label that declares a different page from
 * a garment label is a bag label that prints rotated or on A4.
 *
 * Async because the QR encoder is — the garment path is synchronous only because
 * JsBarcode draws onto a canvas we already own.
 */
export async function buildBagLabelHTML(bags: BagLabelData[], cfg: LabelConfig): Promise<string> {
  const job = computeBagJobLayout(bags, cfg)
  const rows = await Promise.all(bags.map(async (b, i) => {
    const geo = job.geos[i]
    const sizeMm = job.sizeMmFor(geo)
    // scale = dots per module and margin = the quiet zone in the SAME modules,
    // so one canvas pixel is one printer dot and the <img> is then given that
    // exact size in millimetres — nothing to resample.
    let qr = ""
    if (geo.moduleDots > 0) {
      try {
        qr = await QRCode.toDataURL(b.qrValue || b.bagNumber, {
          errorCorrectionLevel: QR_ERROR_CORRECTION,
          margin: QR_QUIET_MODULES,
          scale: job.moduleDots,
          color: { dark: "#000000ff", light: "#ffffffff" },
        })
      } catch { qr = "" }
    }
    return `<div class="page"><div class="label">
        ${qr ? `<img class="qr" src="${qr}" alt="" style="width:${sizeMm.toFixed(3)}mm;height:${sizeMm.toFixed(3)}mm"/>` : ""}
        <div class="gar">${escapeHtml(b.bagNumber)}</div>
      </div></div>`
  }))
  return renderLabelDocument({
    title: bagJobName(bags),
    page: job.page,
    widthMm: job.widthMm,
    heightMm: job.heightMm,
    stockHeightMm: job.stockHeightMm,
    css: `    /* No scaling and no smoothing — the bitmap must reach the printer dot-for-dot. */
    .qr { display:block; image-rendering: pixelated; image-rendering: crisp-edges; margin:0 0 ${BARCODE_TEXT_GAP_MM}mm; }
    .gar { font-size:${job.fontPt}pt; }`,
    body: rows.join(""),
  })
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

const cleanJobName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim()

// The print/PDF filename: a single garment → its Item ID (falls back to the GAR
// code); multiple → the order number. Sanitised for use as a file name.
function printJobName(labels: LabelData[]): string {
  if (labels.length === 1) {
    const l = labels[0]
    return cleanJobName(l.itemNumber || l.garScanCode || l.orderNumber || "label") || "labels"
  }
  const order = labels.find((l) => l.orderNumber)?.orderNumber
  return cleanJobName(order ? `${order}-labels` : "labels") || "labels"
}

/** Same rule for bags: one bag → its number, a batch → "Bag Labels". */
function bagJobName(bags: BagLabelData[]): string {
  return (bags.length === 1 ? cleanJobName(bags[0].bagNumber) : "") || "Bag Labels"
}

/**
 * THE print side-effect, shared by every label type.
 *
 * PURE: it writes a document into a hidden iframe and prints THAT — no state
 * mutation, no API calls, no workflow transitions. See Bug 2.
 *
 * Never a popup: window.open + print can be blocked, can leave a stuck blank
 * window, and froze the app for some users. The iframe prints only the labels
 * (its own document and its own @page size) and is removed afterwards. Symbols
 * are inline data-URIs, so there is no external load to wait on.
 *
 * The returned Promise resolves once the print has been asked for, so callers
 * never block on the dialog.
 */
function printLabelDocument(html: string, jobName: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe")
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;"
    document.body.appendChild(iframe)

    // The browser derives the "Save as PDF" filename from the TOP document's title
    // (not the iframe's), so set it to the garment/bag/order id while printing and
    // restore it after — otherwise the file is named after the app's <title>.
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

/** PREVIEW: open the same document in a tab so staff can eyeball it first. */
function previewLabelDocument(html: string): void {
  const win = window.open("", "_blank", "width=420,height=640")
  if (win) { win.document.open(); win.document.write(html); win.document.close() }
}

// PURE side-effect: no state mutation, no API calls. See Bug 2.
export function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true): Promise<void> {
  if (typeof window === "undefined" || labels.length === 0) return Promise.resolve()
  const html = buildHTML(labels, cfg)
  if (!autoPrint) { previewLabelDocument(html); return Promise.resolve() }
  return printLabelDocument(html, printJobName(labels))
}

/**
 * Bag QR labels — the same printer, the same stock, the same pipeline.
 *
 * cfg defaults to the workstation's SAVED label configuration, so a bag label
 * comes off the machine set up for garment barcodes with nothing extra to
 * configure. PURE side-effect, exactly like printLabels.
 */
export async function printBagLabels(bags: BagLabelData[], cfg: LabelConfig = loadLabelConfig(), autoPrint = true): Promise<void> {
  if (typeof window === "undefined" || bags.length === 0) return
  const html = await buildBagLabelHTML(bags, cfg)
  if (!autoPrint) { previewLabelDocument(html); return }
  return printLabelDocument(html, bagJobName(bags))
}
