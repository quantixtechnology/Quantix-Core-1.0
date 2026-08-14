// Public surface of the Hardware Integration Layer.
//
// Workflows import from here and nowhere deeper. They call ScanEngine to
// receive codes and PrintEngine to print, and never learn whether the input
// arrived from a USB wedge, a Bluetooth wedge, the camera or the keyboard, nor
// whether output went to a paired device or the browser dialog. Swapping the
// implementation behind either engine touches no workflow.

export { ScanEngine } from "./scan-engine"
export { useScanSink } from "./use-scan-sink"
export type { ScanSinkProps, UseScanSinkOptions } from "./use-scan-sink"
export { PrintEngine, renderAndPrint } from "./print-engine"
export type { PrintJob, TrackedJob, PrintJobStatus, PrinterConnectivity } from "./print-engine"
export { scannerStatus, physicalConnection, scannerInputMode, PHYSICAL_CONNECTION_UNKNOWN, PHYSICAL_CONNECTION_PERMISSION, PHYSICAL_CONNECTION_NOTE, NOT_VERIFIED_DETAIL, NOT_EXPOSED } from "./scanner-status"
export type { ScannerStatus, ScannerVerification, ScannerInputMode } from "./scanner-status"
export { readTerminalFacts, browserName, deviceApiResult, scannerResult, RESULT_LABEL, RESULT_TONE } from "./terminal"
export type { TerminalFacts, HardwareResult } from "./terminal"
export { diagnostics } from "./diagnostics"
export type { DiagnosticsSnapshot, ScannerDiagnostics, PrinterDiagnostics } from "./diagnostics"
export { probeCapabilities, capabilityLabel, isSecureContext, CAPABILITY_NOTES } from "./capabilities"
export { eventLog } from "./event-log"
export type { HardwareEvent, HardwareEventType, HardwareEventLevel } from "./event-log"
export { probeCamera, testCamera, EMPTY_CAMERA } from "./camera"
export type { CameraInfo } from "./camera"
export { hardwareHealth } from "./health"
export type { HardwareHealth, HealthLevel } from "./health"
export {
  discoverDevices, browserPrintDevice, deviceSummary, watchDeviceChanges,
  requestUsbDevice, requestHidDevice, requestSerialPort,
} from "./registry"
export {
  loadProfile, saveProfile, setRole, deviceForRole, listProfiles, subscribeProfile,
  setScannerPreferences, DEFAULT_SCANNER_PREFERENCES,
} from "./profiles"
export type { DeviceProfile, ScannerPreferences } from "./profiles"
export * from "./types"

// Sample documents for the Hardware Manager's test buttons. Kept here so a
// technician can prove a printer works without touching a real order.
export { testLabelHtml, alignmentTestHtml, qrTestHtml, barcodeTestHtml, sampleInvoiceHtml, sampleReceiptHtml } from "./test-documents"
