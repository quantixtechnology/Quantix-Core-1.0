// The QR engine — one implementation, shared by every QR in Laundry OS.
//
// Extracted from the Store Location QR so the Customer App QR is the SAME
// engine rather than a lookalike. Two QR implementations drift: one gets a
// quiet-zone fix or a share fallback and the other silently does not, and the
// difference only shows up on printed material.
//
// Behaviour here is exactly what the Location QR already shipped with.

import QRCode from "qrcode"

/**
 * Print resolution for every downloaded QR, in both products.
 *
 * 2048px survives what these files are actually used for: a counter card, a
 * reception sign, an A3 poster on a wall. The on-screen preview stays small —
 * the point of exporting at a fixed high resolution is that print quality never
 * depends on how big the QR happens to be rendered in the page.
 */
export const QR_PNG_SIZE = 2048

/**
 * margin 4 = the four-module quiet zone the QR spec requires. Without it a
 * scanner pressed against printed material often fails to lock on, which is
 * the one failure you cannot fix after the posters are printed.
 */
const PRINT_OPTS = {
  margin: 4,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000", light: "#ffffff" },
}

export const qrSlug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr"

/** On-screen preview. Softer black, smaller quiet zone — never downloaded. */
export function qrPreviewDataUrl(value: string, width = 320): Promise<string> {
  return QRCode.toDataURL(value, { width, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
}

/**
 * Download without touching layout.
 *
 * The anchor is never appended to the document, so it cannot occupy space,
 * shift content or create overflow. Revoking is deferred because doing it in
 * the same tick as click() cancels the download in some browsers, and the
 * try/finally releases the URL even if click() throws.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.rel = "noopener"
    a.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}

export async function downloadQrPng(value: string, fileBase: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(value, { width: QR_PNG_SIZE, ...PRINT_OPTS })
  downloadBlob(await (await fetch(dataUrl)).blob(), `${fileBase}.png`)
}

/** Vector, for a designer placing it on a card or poster at any size. */
export async function downloadQrSvg(value: string, fileBase: string): Promise<void> {
  const svg = await QRCode.toString(value, { type: "svg", ...PRINT_OPTS })
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${fileBase}.svg`)
}

export const canShareQr = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.share === "function"

/**
 * Share the image where the platform allows it, the link where it does not.
 * Returns false only on a real failure — a dismissed sheet is not one.
 */
export async function shareQr(value: string, fileBase: string, title: string, text: string): Promise<boolean> {
  const dataUrl = await QRCode.toDataURL(value, { width: QR_PNG_SIZE, ...PRINT_OPTS })
  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], `${fileBase}.png`, { type: "image/png" })
  const payload: ShareData = { title, text, url: value }
  const withFile = { ...payload, files: [file] } as ShareData
  try {
    if (navigator.canShare?.(withFile)) await navigator.share(withFile)
    else await navigator.share(payload)
    return true
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return true
    return false
  }
}

/**
 * Print a QR straight from the dialog.
 *
 * A hidden iframe, never window.open: a popup print froze the app once before
 * (see the barcode label fix) and browsers increasingly block them anyway. The
 * image is already a data: URL, so there is nothing to load and nothing to wait
 * for beyond the frame itself.
 */
export function printQrImage(dataUrl: string, title: string, caption: string): void {
  if (typeof document === "undefined") return
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;"
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) { frame.remove(); return }
  doc.open()
  doc.write(`<!doctype html><html><head><title>${title}</title><style>
    @page { margin: 12mm }
    body { font-family: ui-sans-serif, system-ui, sans-serif; text-align: center; margin: 0; padding: 8mm }
    h1 { font-size: 16pt; margin: 0 0 2mm }
    p { font-size: 10pt; color: #475569; margin: 0 0 6mm; word-break: break-all }
    img { width: 74mm; height: 74mm; image-rendering: pixelated }
  </style></head><body><h1>${title}</h1><p>${caption}</p><img src="${dataUrl}" alt="QR" /></body></html>`)
  doc.close()
  const done = () => { setTimeout(() => frame.remove(), 1000) }
  frame.contentWindow?.addEventListener("afterprint", done)
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(done, 60000)
}
