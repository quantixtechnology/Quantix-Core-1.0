// Quantix Hardware Integration Layer — shared vocabulary.
//
// Everything the rest of Laundry OS knows about hardware lives here. Workflows
// never name a transport: they ask the ScanEngine for input and hand the
// PrintEngine a job, and this layer decides which physical device serves it.
//
// Adding a device type is a matter of extending DeviceKind and teaching the
// registry how to discover it — no existing module changes.

export type DeviceKind =
  | "BARCODE_SCANNER"
  | "LABEL_PRINTER"
  | "DOCUMENT_PRINTER"
  | "RECEIPT_PRINTER"
  | "CAMERA"
  // Reserved so a profile saved today stays valid when these arrive. Adding
  // one means teaching the registry to discover it — no workflow changes.
  | "WEIGHT_SCALE"
  | "RFID_READER"
  | "NFC_READER"
  | "SIGNATURE_PAD"
  | "CASH_DRAWER"
  | "PAYMENT_TERMINAL"
  | "FINGERPRINT_READER"

export type ConnectionType = "USB" | "BLUETOOTH" | "NETWORK" | "SERIAL" | "BROWSER" | "CAMERA" | "UNKNOWN"

/** How a device was found — drives what information we can honestly show. */
export type DiscoverySource = "WEBUSB" | "WEBHID" | "WEBSERIAL" | "BLUETOOTH" | "MEDIA_DEVICES" | "BROWSER_PRINT" | "KEYBOARD_WEDGE"

export type DeviceStatus = "ONLINE" | "OFFLINE" | "UNKNOWN"

/**
 * A device as the browser is willing to describe it.
 *
 * Every descriptive field is optional on purpose. Browsers expose vendor and
 * product only for devices the user has explicitly granted through a WebUSB /
 * WebHID / Web Serial picker; a printer reached through the ordinary print
 * dialog is anonymous by design. A device we cannot name is still a usable
 * device — it renders as "Unknown Printer · Connected · Ready" and prints.
 * Never infer a model from a vendor id.
 */
export interface HardwareDevice {
  /** Stable within a browser profile, so a saved default survives a reload. */
  id: string
  kind: DeviceKind
  connection: ConnectionType
  source: DiscoverySource
  /** Best available label. Falls back to a generic name, never a guess. */
  name: string
  manufacturer?: string | null
  product?: string | null
  model?: string | null
  vendorId?: number | null
  productId?: number | null
  serialNumber?: string | null
  status: DeviceStatus
  /** True when this entry is the browser's own print dialog rather than a device. */
  isBrowserPrint?: boolean
  lastSeenAt?: string | null
}

/** Print roles an administrator can bind a device to. */
export type PrinterRole = "BARCODE" | "INVOICE" | "A4" | "QR" | "RECEIPT"

export const PRINTER_ROLES: { role: PrinterRole; label: string; kind: DeviceKind }[] = [
  { role: "BARCODE", label: "Default Barcode Printer", kind: "LABEL_PRINTER" },
  { role: "QR", label: "Default QR Printer", kind: "LABEL_PRINTER" },
  { role: "INVOICE", label: "Default Invoice Printer", kind: "DOCUMENT_PRINTER" },
  { role: "A4", label: "Default A4 Printer", kind: "DOCUMENT_PRINTER" },
  { role: "RECEIPT", label: "Default Receipt Printer", kind: "RECEIPT_PRINTER" },
]

/** What this browser can actually do — probed once, shown in the Hardware Manager. */
export interface BrowserCapabilities {
  browserPrint: boolean
  webUsb: boolean
  webHid: boolean
  webSerial: boolean
  bluetooth: boolean
  camera: boolean
  barcodeDetector: boolean
  clipboard: boolean
  wakeLock: boolean
}

/** Where a scan came from. The ladder in priority order. */
export type ScanSource = "USB_SCANNER" | "BLUETOOTH_SCANNER" | "CAMERA" | "MANUAL"

export type ScanStatus = "SCANNER_READY" | "CAMERA_READY" | "MANUAL_ENTRY"

export interface ScanEvent {
  code: string
  source: ScanSource
  at: number
  /** Milliseconds between first and last keystroke; only for wedge input. */
  durationMs?: number
}

export const UNKNOWN_PRINTER_NAME = "Unknown Printer"
export const BROWSER_PRINT_ID = "browser-print"
