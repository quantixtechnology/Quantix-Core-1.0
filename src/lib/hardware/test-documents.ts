// Self-contained documents for the Hardware Manager's test buttons.
//
// A technician must be able to prove a printer works without creating an
// order, so none of these touch the database or any workflow. They are plain
// HTML strings handed to the PrintEngine like any other job.

import QRCode from "qrcode"
import JsBarcode from "jsbarcode"

const shell = (title: string, body: string, pageCss = "@page { margin: 8mm; }") => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title><style>
  ${pageCss}
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 15px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td, th { padding: 4px 6px; border-bottom: 1px solid #ddd; text-align: left; }
  .muted { color: #666; font-size: 11px; }
  .right { text-align: right; }
</style></head><body>${body}</body></html>`

const stamp = () => new Date().toLocaleString("en-IN")

/** 60 × 40 mm label matching the garment-label stock. */
export function testLabelHtml(): string {
  return shell("Test Label", `
    <div style="width:60mm;height:40mm;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px dashed #999">
      <div style="font-size:13px;font-weight:700">QUANTIX TEST LABEL</div>
      <div class="muted">60 mm × 40 mm</div>
      <div class="muted">${stamp()}</div>
    </div>`, "@page { size: 60mm 40mm; margin: 0; }")
}

/**
 * Alignment target — rules at the exact edges plus a 10 mm grid, so a operator
 * can see head offset and skew at a glance.
 */
export function alignmentTestHtml(): string {
  const ticks = Array.from({ length: 6 }, (_, i) =>
    `<div style="position:absolute;left:${i * 10}mm;top:0;width:0.2mm;height:4mm;background:#000"></div>` +
    `<div style="position:absolute;left:0;top:${i * 10 > 40 ? 40 : i * 10}mm;width:4mm;height:0.2mm;background:#000"></div>`).join("")
  return shell("Alignment Test", `
    <div style="position:relative;width:60mm;height:40mm;border:0.3mm solid #000">
      ${ticks}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px">
        ALIGNMENT · 10&nbsp;mm grid
      </div>
    </div>
    <p class="muted">Every edge line should print fully. Ticks mark 10 mm intervals.</p>`,
    "@page { size: 60mm 40mm; margin: 0; }")
}

export async function qrTestHtml(value = "QUANTIX-HARDWARE-TEST"): Promise<string> {
  const url = await QRCode.toDataURL(value, { margin: 1, width: 240 })
  return shell("QR Test", `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <img src="${url}" alt="QR" style="width:30mm;height:30mm;image-rendering:pixelated" />
      <div style="font-family:monospace;font-size:10px">${value}</div>
      <div class="muted">${stamp()}</div>
    </div>`, "@page { size: 60mm 40mm; margin: 2mm; }")
}

export function barcodeTestHtml(value = "QX1234567890"): string {
  // Rendered off-screen into a canvas, exactly like the garment label, so the
  // bars reach the printer as a 1:1 bitmap with no resampling.
  let dataUrl = ""
  try {
    const canvas = document.createElement("canvas")
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 })
    dataUrl = canvas.toDataURL("image/png")
  } catch { /* fall through to the text-only card below */ }
  return shell("Barcode Test", `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      ${dataUrl ? `<img src="${dataUrl}" alt="barcode" style="height:15mm;image-rendering:pixelated" />` : `<div class="muted">Barcode could not be rendered in this browser</div>`}
      <div style="font-family:monospace;font-size:11px;font-weight:700">${value}</div>
      <div class="muted">${stamp()}</div>
    </div>`, "@page { size: 60mm 40mm; margin: 2mm; }")
}

export function sampleInvoiceHtml(businessName = "Quantix Laundry"): string {
  return shell("Sample Invoice", `
    <h1>${businessName}</h1>
    <p class="muted">SAMPLE INVOICE — not a real transaction · ${stamp()}</p>
    <table>
      <tr><th>Item</th><th class="right">Qty</th><th class="right">Amount</th></tr>
      <tr><td>Shirt — Wash &amp; Iron</td><td class="right">3</td><td class="right">₹150.00</td></tr>
      <tr><td>Trousers — Dry Clean</td><td class="right">2</td><td class="right">₹240.00</td></tr>
      <tr><td><b>Total</b></td><td class="right"><b>5</b></td><td class="right"><b>₹390.00</b></td></tr>
    </table>
    <p class="muted">Printed from Hardware Manager to verify the A4 / invoice printer.</p>`)
}

export function sampleReceiptHtml(businessName = "Quantix Laundry"): string {
  return shell("Sample Receipt", `
    <div style="width:72mm;font-family:'Courier New',monospace;font-size:11px">
      <div style="text-align:center;font-weight:700">${businessName}</div>
      <div style="text-align:center" class="muted">SAMPLE RECEIPT</div>
      <div>--------------------------------</div>
      <div>Shirt x3 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 150.00</div>
      <div>Trousers x2 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 240.00</div>
      <div>--------------------------------</div>
      <div><b>TOTAL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 390.00</b></div>
      <div style="text-align:center;margin-top:6px" class="muted">${stamp()}</div>
    </div>`, "@page { size: 80mm auto; margin: 3mm; }")
}
