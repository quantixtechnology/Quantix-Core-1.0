// Thermal garment-label printing. The barcode encodes the Global Garment Number
// (GAR) for scanning, while the human-readable garment ID (ITM-format) is shown
// for reference. Sized for thermal ribbon printers (20mm default, configurable)
// with print-specific CSS. Client-side only.
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
export function scannerQuality(cfg: LabelConfig): ScannerQuality {
  const opts = resolveBarcodeOpts(cfg)
  const totalW = (15 * 11 * opts.moduleWidth) + (2 * opts.quietZone) // ~width in px at 203 DPI for GAR codes
  const totalH = opts.barcodeHeight
  const ratio = Math.min(totalW, totalH) / 200 // normalised against reference 200px
  if (ratio >= 2) return { stars: 5, label: "Excellent" }
  if (ratio >= 1.5) return { stars: 4, label: "Good" }
  if (ratio >= 1) return { stars: 3, label: "Fair" }
  if (ratio >= 0.7) return { stars: 2, label: "Poor" }
  return { stars: 1, label: "Unreliable" }
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

export const DEFAULT_LABEL_CONFIG: LabelConfig = { widthMm: 20, heightMm: 30, dpi: 203 }
const KEY = "qx-laundry-label-config"
export function loadLabelConfig(): LabelConfig {
  if (typeof window === "undefined") return DEFAULT_LABEL_CONFIG
  try { return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return DEFAULT_LABEL_CONFIG }
}
export function saveLabelConfig(c: LabelConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch {} }

export interface LabelData { itemNumber: string; garment: string; service: string; garScanCode?: string | null; orderNumber?: string; storeName?: string }

function barcodeDataURL(value: string, cfg: LabelConfig): string {
  const opts = resolveBarcodeOpts(cfg)
  const canvas = document.createElement("canvas")
  try {
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false, // GAR rendered as separate .gar div
      margin: opts.quietZone,
      height: opts.barcodeHeight,
      width: opts.moduleWidth,
    })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

function buildHTML(labels: LabelData[], cfg: LabelConfig): string {
  const w = cfg.widthMm, h = cfg.heightMm
  const opts = resolveBarcodeOpts(cfg)
  const rows = labels.map((l) => {
    const bcValue = l.garScanCode || l.itemNumber
    const bc = barcodeDataURL(bcValue, cfg)
    return `<div class="label">
        <div class="gar">${escapeHtml(l.garScanCode || bcValue)}</div>
        ${bc ? `<img class="bc" src="${bc}" alt=""/>` : ""}
        <div class="g">${escapeHtml(l.garment)}</div>
        <div class="s">${escapeHtml(l.service)}</div>
        <div class="footer">
          ${l.orderNumber ? `<span class="meta"><span class="lbl">Order</span> ${escapeHtml(l.orderNumber)}</span>` : ""}
          ${l.storeName ? `<span class="meta"><span class="lbl">Store</span> ${escapeHtml(l.storeName)}</span>` : ""}
          ${l.itemNumber ? `<span class="meta itm"><span class="lbl">Ref</span> ${escapeHtml(l.itemNumber).replace(/-/g, "-<wbr>")}</span>` : ""}
        </div>
      </div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
    .label { width:${w}mm; height:${h}mm; padding:${opts.marginTop}mm ${opts.marginRight}mm ${opts.marginBottom}mm ${opts.marginLeft}mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; text-align:center; overflow:hidden; justify-content:center; }
    .gar { font-family:'Courier New',monospace; font-weight:800; font-size:${Math.max(8, Math.round(w / 2.2))}pt; letter-spacing:0.8px; line-height:1.15; margin-bottom:0.3mm; }
    .bc { width:98%; max-height:${Math.max(35, Math.round(h * 0.38))}mm; object-fit:contain; margin-bottom:0.5mm; }
    .g { font-weight:700; font-size:${Math.max(7, Math.round(w / 3))}pt; line-height:1.15; margin-bottom:0.3mm; }
    .s { font-weight:500; font-size:${Math.max(6, Math.round(w / 3.8))}pt; color:#555; line-height:1.15; margin-bottom:0.2mm; }
    .footer { display:flex; flex-wrap:wrap; justify-content:center; gap:0.4mm 1.2mm; margin-top:0.3mm; }
    .meta { font-family:'Courier New',monospace; font-weight:400; font-size:${Math.max(4.5, Math.round(w / 5))}pt; color:#666; }
    .meta.itm { color:#999; font-size:${Math.max(4, Math.round(w / 5.5))}pt; }
    .lbl { color:#aaa; margin-right:0.3mm; }
    @media screen { body{background:#eef2f7;padding:10px;} .label{border:1px dashed #cbd5e1;margin:6px auto;background:#fff;border-radius:2px;} }
  </style></head><body>${rows.join("")}</body></html>`
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

// PURE side-effect: opens print window, no state mutation, no API calls.
// The returned Promise resolves when the window opens so callers can continue
// without blocking on the print dialog.
export function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true): Promise<void> {
  return new Promise((resolve) => {
    if (labels.length === 0) { resolve(); return }
    const html = buildHTML(labels, cfg)
    const win = window.open("", "_blank", "width=420,height=640")
    if (!win) { resolve(); return }
    win.document.open(); win.document.write(html); win.document.close()
    if (autoPrint) {
      win.onload = () => { win.focus(); win.print() }
      setTimeout(() => { try { win.focus(); win.print() } catch {}; resolve() }, 400)
    } else {
      resolve()
    }
  })
}
