// What this browser is actually willing to do.
//
// Feature detection only — no permission is requested here, so probing is safe
// to run at startup. Asking for a device is always a deliberate, user-gestured
// act in the Hardware Manager.
//
// Availability differs sharply by browser and is not a defect in Laundry OS:
// WebUSB / WebHID / Web Serial are Chromium-only and require a secure context,
// and Safari and Firefox ship none of them. A terminal with nothing but browser
// print is fully supported — it simply shows fewer details.

import type { BrowserCapabilities } from "./types"

type Nav = Navigator & {
  usb?: unknown
  hid?: unknown
  serial?: unknown
  bluetooth?: unknown
  mediaDevices?: MediaDevices
}

export function probeCapabilities(): BrowserCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { browserPrint: false, webUsb: false, webHid: false, webSerial: false, bluetooth: false, camera: false, barcodeDetector: false, clipboard: false, wakeLock: false }
  }
  const n = navigator as Nav
  return {
    // Always true in a real browser — the guaranteed floor every other path
    // falls back to.
    browserPrint: typeof window.print === "function",
    webUsb: !!n.usb,
    webHid: !!n.hid,
    webSerial: !!n.serial,
    bluetooth: !!n.bluetooth,
    camera: !!n.mediaDevices?.getUserMedia,
    barcodeDetector: "BarcodeDetector" in window,
    clipboard: !!navigator.clipboard?.writeText,
    // Keeps a counter terminal awake during a long sorting run.
    wakeLock: "wakeLock" in navigator,
  }
}

/** Per-capability explanation shown in the Hardware Manager support table. */
export const CAPABILITY_NOTES: Record<keyof BrowserCapabilities, string> = {
  browserPrint: "Always available. The guaranteed fallback every print path uses.",
  webUsb: "Chromium only, HTTPS only. Lists devices the operator has paired through the browser's picker — it cannot enumerate what is plugged in.",
  webHid: "Chromium only, HTTPS only. Most barcode scanners present as keyboards and work without it.",
  webSerial: "Chromium only, HTTPS only. Used for serial and some network label printers.",
  bluetooth: "Chromium only, HTTPS only. A Bluetooth scanner paired at the operating system already types like a USB one and needs no permission here.",
  camera: "Widely available, HTTPS only. Device labels and resolution stay hidden until the operator grants access.",
  barcodeDetector: "Chromium and Safari. When missing, camera scanning falls back to the bundled ZXing decoder.",
  clipboard: "Used to copy diagnostics into a support ticket.",
  wakeLock: "Keeps a counter terminal awake during a long scanning run.",
}

export function capabilityLabel(c: BrowserCapabilities): string {
  const on = [
    c.browserPrint && "Browser print",
    c.webUsb && "WebUSB",
    c.webHid && "WebHID",
    c.webSerial && "Web Serial",
    c.bluetooth && "Bluetooth",
    c.camera && "Camera",
  ].filter(Boolean) as string[]
  return on.length ? on.join(" · ") : "Browser print only"
}

/**
 * Secure context is a hard prerequisite for every device API. Worth surfacing
 * plainly, because "no devices found" on plain http looks like broken hardware
 * when it is really the page's origin.
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext === true
}
