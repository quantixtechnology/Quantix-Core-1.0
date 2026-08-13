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
  /** Dashboard tile wording. */
  tile: string
  /** Scanner page wording. */
  status: string
  /** True once a scan has ever been received: the tile's green light. */
  verified: boolean
}

export const NOT_VERIFIED_DETAIL = "No barcode scan has been received on this terminal."

export function scannerStatus(i: ScannerStatusInput, formatTime: (iso: string) => string): ScannerStatus {
  if (!i.lastScanAt) {
    return { state: "NOT_VERIFIED", tile: "Not Verified", status: "Scanner Not Verified", verified: false }
  }
  const at = formatTime(i.lastScanAt)
  // Both remaining states are verified — the scanner HAS proven itself here.
  // "Awaiting Scan" says only that nothing has come in lately; it is never a
  // claim that the scanner has been unplugged, because that is unknowable.
  if (i.recentlyScanned) {
    return { state: "VERIFIED", tile: `Verified · last ${at}`, status: "Scanner Verified", verified: true }
  }
  return {
    state: "AWAITING_SCAN",
    tile: `Verified · last ${at}`,
    status: `Awaiting Scan · last successful scan ${at}`,
    verified: true,
  }
}

/** Device APIs that hold a real handle and can therefore report connection. */
const MONITORABLE: DiscoverySource[] = ["WEBHID", "WEBUSB", "WEBSERIAL", "BLUETOOTH"]

export const PHYSICAL_CONNECTION_UNKNOWN = "Not detectable"
export const PHYSICAL_CONNECTION_NOTE =
  "This scanner operates as a keyboard-emulation device. The browser cannot reliably determine whether the physical scanner is currently connected. Connection is verified through scan activity."

/**
 * Physical connection, or an honest refusal.
 *
 * `connected` is returned ONLY for a device paired through an API that can
 * observe it. A wedge scanner always lands on "not detectable", however many
 * scans it has produced.
 */
export function physicalConnection(device: { source: DiscoverySource; connection?: string } | null): {
  detectable: boolean
  label: string
} {
  if (device && MONITORABLE.includes(device.source)) {
    return { detectable: true, label: `Connected · ${device.connection ?? device.source}` }
  }
  return { detectable: false, label: PHYSICAL_CONNECTION_UNKNOWN }
}
