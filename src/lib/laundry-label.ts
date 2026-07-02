// Thermal garment-label printing. A garment label carries ONLY: garment name,
// service, Code128 barcode and the human-readable Item ID — nothing else (no
// QR, no customer, no order number). QR lives at the PACKAGE level, not the
// garment. Sized for thermal ribbon printers (20mm default, configurable) with
// print-specific CSS — no A4, no browser margins, no scaling. Client-side only.

import JsBarcode from "jsbarcode"

export interface LabelConfig {
  widthMm: number
  heightMm: number
  dpi: number // 203 | 300 | 600
}
export const DEFAULT_LABEL_CONFIG: LabelConfig = { widthMm: 20, heightMm: 30, dpi: 203 }
const KEY = "qx-laundry-label-config"
export function loadLabelConfig(): LabelConfig {
  if (typeof window === "undefined") return DEFAULT_LABEL_CONFIG
  try { return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return DEFAULT_LABEL_CONFIG }
}
export function saveLabelConfig(c: LabelConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch {} }

export interface LabelData { itemNumber: string; garment: string; service: string }

function barcodeDataURL(value: string, cfg: LabelConfig): string {
  const canvas = document.createElement("canvas")
  try {
    JsBarcode(canvas, value, { format: "CODE128", displayValue: false, margin: 0, height: Math.max(30, cfg.dpi / 4), width: cfg.dpi >= 300 ? 1.6 : 1.2 })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

function buildHTML(labels: LabelData[], cfg: LabelConfig): string {
  const w = cfg.widthMm, h = cfg.heightMm
  const fs = Math.max(6, Math.round(w / 3))
  const rows = labels.map((l) => {
    const bc = barcodeDataURL(l.itemNumber, cfg)
    return `<div class="label">
        <div class="g">${escapeHtml(l.garment)}</div>
        <div class="s">${escapeHtml(l.service)}</div>
        ${bc ? `<img class="bc" src="${bc}" alt="barcode"/>` : ""}
        <div class="id">${escapeHtml(l.itemNumber)}</div>
      </div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, sans-serif; }
    .label { width:${w}mm; height:${h}mm; padding:1mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; overflow:hidden; }
    .g { font-weight:800; font-size:${fs}pt; line-height:1.05; }
    .s { font-size:${fs - 1}pt; margin-bottom:0.5mm; }
    .bc { width:${w - 2}mm; height:${Math.round(h * 0.42)}mm; object-fit:contain; }
    .id { font-size:${Math.max(5, fs - 2)}pt; font-family:monospace; word-break:break-all; line-height:1.05; margin-top:0.3mm; }
    @media screen { body{background:#eef2f7;padding:10px;} .label{border:1px dashed #cbd5e1;margin:6px auto;background:#fff;} }
  </style></head><body>${rows.join("")}</body></html>`
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

// Open a print window. autoPrint=false → preview only (no dialog).
export function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true) {
  if (labels.length === 0) return
  const html = buildHTML(labels, cfg)
  const win = window.open("", "_blank", "width=420,height=640")
  if (!win) return
  win.document.open(); win.document.write(html); win.document.close()
  if (autoPrint) { win.onload = () => { win.focus(); win.print() }; setTimeout(() => { try { win.focus(); win.print() } catch {} }, 400) }
}
