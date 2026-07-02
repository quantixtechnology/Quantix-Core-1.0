// Thermal garment-label printing. Renders professional labels (Code128 barcode
// + QR + human-readable Item ID) sized for thermal ribbon printers (20mm
// default, configurable) using print-specific CSS — no A4, no browser margins,
// no scaling. Client-side only (jsbarcode + qrcode).

import JsBarcode from "jsbarcode"
import QRCode from "qrcode"

export interface LabelConfig {
  widthMm: number
  heightMm: number
  dpi: number       // 203 | 300 | 600
  printLogo: boolean
  printCustomer: boolean
  printOrder: boolean
  printQR: boolean
  printBarcode: boolean
}
export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  widthMm: 20, heightMm: 30, dpi: 203,
  printLogo: false, printCustomer: true, printOrder: true, printQR: true, printBarcode: true,
}
const KEY = "qx-laundry-label-config"
export function loadLabelConfig(): LabelConfig {
  if (typeof window === "undefined") return DEFAULT_LABEL_CONFIG
  try { return { ...DEFAULT_LABEL_CONFIG, ...JSON.parse(localStorage.getItem(KEY) || "{}") } } catch { return DEFAULT_LABEL_CONFIG }
}
export function saveLabelConfig(c: LabelConfig) { try { localStorage.setItem(KEY, JSON.stringify(c)) } catch {} }

export interface LabelData { itemNumber: string; garment: string; service: string; customer?: string | null; orderNumber?: string | null; brand?: string | null }

function barcodeDataURL(value: string, cfg: LabelConfig): string {
  const canvas = document.createElement("canvas")
  try {
    JsBarcode(canvas, value, { format: "CODE128", displayValue: false, margin: 0, height: Math.max(24, cfg.dpi / 6), width: cfg.dpi >= 300 ? 1.4 : 1 })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

async function buildHTML(labels: LabelData[], cfg: LabelConfig): Promise<string> {
  const w = cfg.widthMm, h = cfg.heightMm
  const fs = Math.max(6, Math.round(w / 3)) // font scales with label width
  const rows: string[] = []
  for (const l of labels) {
    const bc = cfg.printBarcode ? barcodeDataURL(l.itemNumber, cfg) : ""
    const qr = cfg.printQR ? await QRCode.toDataURL(l.itemNumber, { margin: 0, width: 120 }).catch(() => "") : ""
    rows.push(`
      <div class="label">
        <div class="g">${escapeHtml(l.garment)}</div>
        <div class="s">${escapeHtml(l.service)}</div>
        ${cfg.printCustomer && l.customer ? `<div class="c">${escapeHtml(l.customer)}</div>` : ""}
        ${bc ? `<img class="bc" src="${bc}" alt="barcode"/>` : ""}
        <div class="id">${escapeHtml(l.itemNumber)}</div>
        ${qr ? `<img class="qr" src="${qr}" alt="qr"/>` : ""}
        ${cfg.printOrder && l.orderNumber ? `<div class="o">${escapeHtml(l.orderNumber)}</div>` : ""}
      </div>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, sans-serif; }
    .label { width:${w}mm; height:${h}mm; padding:1mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; overflow:hidden; }
    .g { font-weight:700; font-size:${fs}pt; line-height:1.05; }
    .s { font-size:${fs - 1}pt; }
    .c { font-size:${fs - 2}pt; }
    .bc { width:${w - 3}mm; height:${Math.round(h * 0.28)}mm; object-fit:contain; margin:0.5mm 0; }
    .id { font-size:${Math.max(4, fs - 3)}pt; font-family:monospace; word-break:break-all; line-height:1; }
    .qr { width:${Math.min(w - 6, 12)}mm; height:${Math.min(w - 6, 12)}mm; margin-top:0.5mm; }
    .o { font-size:${Math.max(4, fs - 3)}pt; font-family:monospace; }
    @media screen { body{background:#eef2f7;padding:10px;} .label{border:1px dashed #cbd5e1;margin:6px auto;background:#fff;} }
  </style></head><body>${rows.join("")}</body></html>`
}

function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)) }

// Open a print window. autoPrint=false → preview only (no dialog).
export async function printLabels(labels: LabelData[], cfg: LabelConfig, autoPrint = true) {
  if (labels.length === 0) return
  const html = await buildHTML(labels, cfg)
  const win = window.open("", "_blank", "width=420,height=640")
  if (!win) return
  win.document.open(); win.document.write(html); win.document.close()
  if (autoPrint) { win.onload = () => { win.focus(); win.print() }; setTimeout(() => { try { win.focus(); win.print() } catch {} }, 400) }
}
