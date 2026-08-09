// Rolling hardware diagnostics — what the Hardware Manager reports back.
//
// Counters are per browser profile and reset at midnight (the "today" figures
// operators expect), kept in localStorage so a reload during a shift doesn't
// lose the day's tally. Nothing here is authoritative business data: it is
// operational telemetry for a technician standing at the terminal, which is
// why it never goes to the server and never blocks a scan or a print.

const KEY = "qx-hardware-diagnostics-v1"

export interface ScannerDiagnostics {
  totalScansToday: number
  lastBarcode: string | null
  lastScanAt: string | null
  lastSource: string | null
  /** Mean time from first to last keystroke of a wedge scan, in ms. */
  averageScanMs: number | null
  scanSamples: number
}

export interface PrinterDiagnostics {
  labelsPrintedToday: number
  documentsPrintedToday: number
  lastPrintAt: string | null
  lastPrintRole: string | null
  lastError: string | null
  lastErrorAt: string | null
}

export interface DiagnosticsSnapshot {
  day: string
  scanner: ScannerDiagnostics
  printer: PrinterDiagnostics
}

const today = () => new Date().toISOString().slice(0, 10)

const empty = (): DiagnosticsSnapshot => ({
  day: today(),
  scanner: { totalScansToday: 0, lastBarcode: null, lastScanAt: null, lastSource: null, averageScanMs: null, scanSamples: 0 },
  printer: { labelsPrintedToday: 0, documentsPrintedToday: 0, lastPrintAt: null, lastPrintRole: null, lastError: null, lastErrorAt: null },
})

function read(): DiagnosticsSnapshot {
  if (typeof window === "undefined") return empty()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as DiagnosticsSnapshot
    // A new day resets the "today" counters but keeps the last-seen values, so
    // the first shift of the morning still shows what the last one finished on.
    if (parsed.day !== today()) {
      const fresh = empty()
      fresh.scanner.lastBarcode = parsed.scanner?.lastBarcode ?? null
      fresh.scanner.lastScanAt = parsed.scanner?.lastScanAt ?? null
      fresh.scanner.lastSource = parsed.scanner?.lastSource ?? null
      fresh.printer.lastPrintAt = parsed.printer?.lastPrintAt ?? null
      fresh.printer.lastPrintRole = parsed.printer?.lastPrintRole ?? null
      fresh.printer.lastError = parsed.printer?.lastError ?? null
      fresh.printer.lastErrorAt = parsed.printer?.lastErrorAt ?? null
      return fresh
    }
    return { ...empty(), ...parsed, scanner: { ...empty().scanner, ...parsed.scanner }, printer: { ...empty().printer, ...parsed.printer } }
  } catch {
    return empty()
  }
}

const listeners = new Set<(s: DiagnosticsSnapshot) => void>()

function write(next: DiagnosticsSnapshot) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* quota / private mode — telemetry is expendable */ }
  }
  listeners.forEach((l) => l(next))
}

export const diagnostics = {
  snapshot: read,

  subscribe(fn: (s: DiagnosticsSnapshot) => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  recordScan(code: string, source: string, durationMs?: number) {
    const s = read()
    s.scanner.totalScansToday += 1
    s.scanner.lastBarcode = code
    s.scanner.lastScanAt = new Date().toISOString()
    s.scanner.lastSource = source
    if (typeof durationMs === "number" && durationMs >= 0) {
      const n = s.scanner.scanSamples
      const mean = s.scanner.averageScanMs ?? 0
      s.scanner.averageScanMs = Math.round((mean * n + durationMs) / (n + 1))
      s.scanner.scanSamples = n + 1
    }
    write(s)
  },

  recordPrint(role: string, kind: "LABEL" | "DOCUMENT", count = 1) {
    const s = read()
    if (kind === "LABEL") s.printer.labelsPrintedToday += count
    else s.printer.documentsPrintedToday += count
    s.printer.lastPrintAt = new Date().toISOString()
    s.printer.lastPrintRole = role
    write(s)
  },

  recordPrintError(message: string) {
    const s = read()
    s.printer.lastError = message
    s.printer.lastErrorAt = new Date().toISOString()
    write(s)
  },

  reset() { write(empty()) },
}
