// Public surface of the Hardware Integration Layer.
//
// Workflows import from here and nowhere deeper. They call ScanEngine to
// receive codes and PrintEngine to print, and never learn whether the input
// arrived from a USB wedge, a Bluetooth wedge, the camera or the keyboard, nor
// whether output went to a paired device or the browser dialog. Swapping the
// implementation behind either engine touches no workflow.

export { ScanEngine } from "./scan-engine"
export { PrintEngine, renderAndPrint } from "./print-engine"
export type { PrintJob, QueuedJob, PrinterConnectivity } from "./print-engine"
export { diagnostics } from "./diagnostics"
export type { DiagnosticsSnapshot, ScannerDiagnostics, PrinterDiagnostics } from "./diagnostics"
export { probeCapabilities, capabilityLabel, isSecureContext } from "./capabilities"
export {
  discoverDevices, browserPrintDevice, deviceSummary, watchDeviceChanges,
  requestUsbDevice, requestHidDevice, requestSerialPort,
} from "./registry"
export {
  loadProfile, saveProfile, setRole, deviceForRole, listProfiles, subscribeProfile,
} from "./profiles"
export type { DeviceProfile } from "./profiles"
export * from "./types"

// Sample documents for the Hardware Manager's test buttons. Kept here so a
// technician can prove a printer works without touching a real order.
export { testLabelHtml, alignmentTestHtml, qrTestHtml, barcodeTestHtml, sampleInvoiceHtml, sampleReceiptHtml } from "./test-documents"
