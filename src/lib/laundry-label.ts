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
    // margin = quiet zone baked into the image (scales with the barcode);
    // tall bars + a crisp module width for reliable scanning on thermal heads.
    JsBarcode(canvas, value, { format: "CODE128", displayValue: false, margin: 10, height: 150, width: cfg.dpi >= 300 ? 3 : 2 })
    return canvas.toDataURL("image/png")
  } catch { return "" }
}

// Break a long Item ID cleanly at its hyphen segments (2–3 logical lines)
// rather than splitting at random character positions.
function idHtml(value: string): string {
  return escapeHtml(value).replace(/-/g, "-<wbr>")
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
        <div class="id">${idHtml(l.itemNumber)}</div>
      </div>`
  })
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html,body { margin:0; padding:0; background:#fff; font-family: Arial, Helvetica, sans-serif; }
    .label { width:${w}mm; height:${h}mm; padding:0.8mm 0.4mm; page-break-after: always; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; overflow:hidden; }
    .g { font-weight:800; text-transform:uppercase; letter-spacing:0.3px; font-size:${fs + 1}pt; line-height:1.1; margin-bottom:1mm; }
    .s { font-weight:700; font-size:${fs}pt; line-height:1.1; margin-bottom:1.2mm; }
    /* Code128 ~98% of the printable width; quiet zones come from the baked-in image margin. */
    .bc { width:98%; height:${Math.round(h * 0.47)}mm; object-fit:fill; margin-bottom:1.2mm; }
    .id { font-family:'Roboto Mono','Consolas','Courier New',monospace; font-weight:600; font-size:${Math.max(5, fs - 1)}pt; line-height:1.25; letter-spacing:-0.2px; word-break:normal; overflow-wrap:break-word; max-width:100%; }
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
