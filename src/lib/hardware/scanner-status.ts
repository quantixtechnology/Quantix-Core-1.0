// What Hardware Manager may honestly say about a barcode scanner.
//
// A keyboard-emulation scanner is a keyboard as far as the browser is
// concerned. There is no handle to hold, nothing to poll, and no disconnect
// event — so the only evidence it exists is that it has typed. That evidence is
// HISTORICAL: it proves a scanner was here, never that one is here now. Unplug
// the scanner and every fact the browser holds stays exactly as it was.
//
// The dashboard read "Active · last 8:33:36 AM" off that evidence, which turned
// a record of the past into a claim about the present and kept claiming it with
// the scanner sitting unplugged on the desk. Nothing was wrong with the
// detection — the scan really happened — only with the word.
//
// So this module answers one question, "has a scanner proven itself on this
// terminal", and refuses the other. Physical connection is reported only where
// a device API genuinely holds the device and can watch it; everywhere else the
// honest answer is that it is not detectable, said plainly rather than guessed.

import type { DiscoverySource } from "./types"

export type ScannerVerification = "NOT_VERIFIED" | "VERIFIED" | "AWAITING_SCAN"

export interface ScannerStatusInput {
  /** ISO timestamp of the last scan the engine dispatched, or null. */
  lastScanAt: string | null
  /** The engine's own recency window — reused, never re-derived here. */
  recentlyScanned: boolean
}

export interface ScannerStatus {
  state: ScannerVerification
  /**
   * Dashboard tile headline. It names WHAT WAS VERIFIED — a scan — so the
   * green light beside it cannot be read as "the scanner is plugged in".
   */
  tile: string
  /** Second line under the tile: the evidence, kept separate from the claim. */
  tileNote: string
  /** Scanner page wording. */
  status: string
  /** True once a scan has ever been received: the tile's green light. */
  verified: boolean
}

export const NOT_VERIFIED_DETAIL = "No barcode scan has been received on this terminal."

export function scannerStatus(i: ScannerStatusInput, formatTime: (iso: string) => string): ScannerStatus {
  if (!i.lastScanAt) {
    return {
      state: "NOT_VERIFIED",
      tile: "Not Verified",
      tileNote: NOT_VERIFIED_DETAIL,
      status: "Scanner Not Verified",
      verified: false,
    }
  }
  const at = formatTime(i.lastScanAt)
  // Both remaining states are verified — the scanner HAS proven itself here.
  // "Awaiting Scan" says only that nothing has come in lately; it is never a
  // claim that the scanner has been unplugged, because that is unknowable.
  //
  // The headline is "Scan Verified", not "Verified": what has been verified is
  // a SCAN. Reading the tile aloud should leave nobody thinking the cable has
  // been checked.
  return {
    state: i.recentlyScanned ? "VERIFIED" : "AWAITING_SCAN",
    tile: "Scan Verified",
    tileNote: `Last scan: ${at}`,
    status: i.recentlyScanned ? "Scanner Verified" : `Awaiting Scan · last successful scan ${at}`,
    verified: true,
  }
}

/**
 * How the barcode currently reaches Laundry OS.
 *
 * Two different questions again. A wedge scanner delivers KEYSTROKES — that is
 * "Keyboard Emulation", and it is what a counter scanner almost always does.
 * A device paired through WebHID/WebUSB/Web Serial/Bluetooth is a browser-held
 * DEVICE, and only then is there a connection to report. The two can coexist:
 * a paired printer says nothing about how the scanner talks.
 *
 * `Unknown` is reserved for the case where nothing has been seen at all — not
 * used as a shrug over a scanner that is plainly typing.
 */
export type ScannerInputMode = "Keyboard Emulation" | "WebHID" | "WebUSB" | "Web Serial" | "Bluetooth" | "Unknown"

const SOURCE_MODE: Partial<Record<DiscoverySource, ScannerInputMode>> = {
  WEBHID: "WebHID",
  WEBUSB: "WebUSB",
  WEBSERIAL: "Web Serial",
  BLUETOOTH: "Bluetooth",
}

export function scannerInputMode(
  device: { source: DiscoverySource } | null,
  everScanned: boolean,
): ScannerInputMode {
  // A paired scanner device names its own transport.
  const paired = device ? SOURCE_MODE[device.source] : undefined
  if (paired) return paired
  // Otherwise: if barcodes are arriving, they are arriving as keystrokes.
  if (everScanned) return "Keyboard Emulation"
  return "Unknown"
}

/** Device APIs that hold a real handle and can therefore report connection. */
const MONITORABLE: DiscoverySource[] = ["WEBHID", "WEBUSB", "WEBSERIAL", "BLUETOOTH"]

export const PHYSICAL_CONNECTION_UNKNOWN = "Not detectable by browser"
export const PHYSICAL_CONNECTION_PERMISSION = "Permission required"
export const PHYSICAL_CONNECTION_NOTE =
  "This scanner operates as a keyboard-emulation device. The browser cannot reliably determine whether the physical scanner is currently connected. Connection is verified through scan activity."

/**
 * Physical connection, or an honest refusal.
 *
 * `connected` is returned ONLY for a device paired through an API that can
 * observe it. A wedge scanner always lands on "not detectable", however many
 * scans it has produced.
 */
export function physicalConnection(
  device: { source: DiscoverySource; connection?: string } | null,
  opts: { apiSupported?: boolean; anyGranted?: boolean } = {},
): { detectable: boolean; label: string } {
  if (device && MONITORABLE.includes(device.source)) {
    const via = SOURCE_MODE[device.source] ?? device.connection ?? device.source
    return { detectable: true, label: `Connected via ${via}` }
  }
  // The browser CAN hold devices here but the operator has granted none, so the
  // honest answer is that nothing has been permitted — not that nothing is
  // plugged in. Distinct from a browser that cannot do this at all.
  if (opts.apiSupported && opts.anyGranted === false) {
    return { detectable: false, label: PHYSICAL_CONNECTION_PERMISSION }
  }
  return { detectable: false, label: PHYSICAL_CONNECTION_UNKNOWN }
}

/**
 * A value the browser did not give us.
 *
 * "Not available" says the browser withheld it; "Unknown" would suggest we
 * looked and could not tell. For a vendor id or a serial number that
 * difference matters to whoever is diagnosing the terminal.
 */
export const NOT_EXPOSED = "Not available"
