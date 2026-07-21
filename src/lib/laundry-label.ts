// Thermal garment-label printing. The barcode encodes the Global Garment Number
// (GAR) for scanning, while the human-readable garment ID (ITM-format) is shown
// for reference. Sized for thermal ribbon printers (20mm default, configurable)
// with print-specific CSS. Client-side only.

import JsBarcode from "jsbarcode"

export interface LabelConfig {
  widthMm: number
  heightMm: number
  dpi: number // 203 | 300 | 600
  // Barcode appearance (defaults match current output for backward compat)
  barcodeProfile?: BarcodeProfile
  moduleWidth?: number    // JsBarcode width param (default 2)
  barcodeHeight?: number  // JsBarcode height param (default 150)
  quietZone?: number      // margin around barcode (default 10)
  fontSize?: number       // human-readable text below barcode (default 10)
  textPosition?: "top" | "bottom" | "hidden"
  // Margins around the label content (mm, default 0.4)
  marginLeft?: number
  marginRight?: number
  marginTop?: number
  marginBottom?: number
  // Scaling multiplier for thermal printer (default 1)
  scaling?: number
}

export type BarcodeProfile = "compact" | "standard" | "wide-scan" | "warehouse" | "custom"

export const BARCODE_PROFILES: Record<BarcodeProfile, { moduleWidth: number; barcodeHeight: number; quietZone: number; fontSize: number; textPosition: "top" | "bottom" | "hidden" }> = {
  "compact":   { moduleWidth: 1.2, barcodeHeight: 80,  quietZone: 5,  fontSize: 7,  textPosition: "bottom" },
  "standard":  { moduleWidth: 2,   barcodeHeight: 150, quietZone: 10, fontSize: 10, textPosition: "bottom" },
  "wide-scan": { moduleWidth: 3,   barcodeHeight: 180, quietZone: 12, fontSize: 11, textPosition: "bottom" },
  "warehouse": { moduleWidth: 4,   barcodeHeight: 220, quietZone: 14, fontSize: 12, textPosition: "bottom" },
  "custom":    { moduleWidth: 2,   barcodeHeight: 150, quietZone: 10, fontSize: 10, textPosition: "bottom" },
}

export function resolveBarcodeOpts(cfg: LabelConfig) {
  const profile = cfg.barcodeProfile && cfg.barcodeProfile !== "custom" ? BARCODE_PROFILES[cfg.barcodeProfile] : null
  return {
    moduleWidth: cfg.moduleWidth ?? profile?.moduleWidth ?? 2,
    barcodeHeight: cfg.barcodeHeight ?? profile?.barcodeHeight ?? 150,
    quietZone: cfg.quietZone ?? profile?.quietZone ?? 10,
    fontSize: cfg.fontSize ?? profile?.fontSize ?? 10,
    textPosition: cfg.textPosition ?? profile?.textPosition ?? "bottom",
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
      fontSize: opts.fontSize,
      textMargin: 4,
    })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

function idHtml(value: string): string {
  return escapeHtml(value).replace(/-/g, "-<wbr>")
}

function buildHTML(labels: LabelData[], cfg: LabelConfig): string {
  const w = cfg.widthMm, h = cfg.heightMm
  const opts = resolveBarcodeOpts(cfg)
  const rows = labels.map((l) => {
    const bcValue = l.garScanCode || l.itemNumber
    const bc = barcodeDataURL(bcValue, cfg)
    const hasGar = !!l.garScanCode
    const hasItm = !!l.itemNumber
    return `<div class="label">
        <div class="g">${escapeHtml(l.garment)}</div>
        <div class="s">${escapeHtml(l.service)}</div>
        <div class="sep"></div>
        ${hasGar ? `<div class="gar">${escapeHtml(l.garScanCode)}</div>` : ""}
        ${bc ? `<img class="bc" src="${bc}" alt=""/>` : ""}
        ${hasItm ? `<div class="id"><span class="lbl">Item Code</span> ${idHtml(l.itemNumber)}</div>` : ""}
        ${l.orderNumber ? `<div class="meta"><span class="lbl">Order</span> ${escapeHtml(l.orderNumber)}</div>` : ""}
        ${l.storeName ? `<div class="meta"><span class="lbl">Store</span> ${escapeHtml(l.storeName)}</div>` : ""}
      </div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
    .label { width:${w}mm; height:${h}mm; padding:${opts.marginTop}mm ${opts.marginRight}mm ${opts.marginBottom}mm ${opts.marginLeft}mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; text-align:center; overflow:hidden; justify-content:center; }
    .g { font-weight:800; text-transform:uppercase; letter-spacing:0.3px; font-size:${Math.max(7, Math.round(w / 2.8))}pt; line-height:1.15; margin-bottom:0.6mm; }
    .s { font-weight:600; font-size:${Math.max(6, Math.round(w / 3.5))}pt; color:#444; line-height:1.15; margin-bottom:0.4mm; }
    .sep { width:60%; height:0.5px; background:#bbb; margin:0.4mm auto 0.6mm; }
    .gar { font-family:'Courier New',monospace; font-weight:800; font-size:${Math.max(7, Math.round(w / 2.5))}pt; letter-spacing:0.5px; line-height:1.2; margin-bottom:0.4mm; }
    .bc { width:96%; max-height:${Math.max(30, Math.round(h * 0.35))}mm; object-fit:contain; margin-bottom:0.6mm; }
    .id, .meta { font-family:'Courier New',monospace; font-weight:500; font-size:${Math.max(5, Math.round(w / 4.5))}pt; line-height:1.3; color:#555; max-width:100%; word-break:break-all; }
    .id { margin-bottom:0.3mm; }
    .lbl { color:#999; font-size:90%; margin-right:0.5mm; }
    @media screen { body{background:#eef2f7;padding:10px;} .label{border:1px dashed #cbd5e1;margin:6px auto;background:#fff;border-radius:2px;} }
  </style></head><body>${rows.join("")}</body></html>`
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

export function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true) {
  if (labels.length === 0) return
  const html = buildHTML(labels, cfg)
  const win = window.open("", "_blank", "width=420,height=640")
  if (!win) return
  win.document.open(); win.document.write(html); win.document.close()
  if (autoPrint) { win.onload = () => { win.focus(); win.print() }; setTimeout(() => { try { win.focus(); win.print() } catch {} }, 400) }
}
