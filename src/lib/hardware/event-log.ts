// Hardware event log — the history a support call actually needs.
//
// "The printer keeps dropping" is unanswerable without a timeline. This keeps
// one: every connect, disconnect, print, scan-source change and permission
// grant, newest first, on the terminal where it happened.
//
// Deliberately a bounded ring in localStorage. It is diagnostic exhaust, not
// business data — it must never grow without limit, never reach the server,
// and never be something a workflow waits on.

const KEY = "qx-hardware-events-v1"
const MAX_EVENTS = 500

export type HardwareEventType =
  | "SCANNER_CONNECTED" | "SCANNER_LOST" | "SCAN"
  | "PRINTER_ONLINE" | "PRINTER_OFFLINE" | "PRINT_OK" | "PRINT_FAILED" | "PRINT_QUEUED" | "PRINT_RETRIED" | "PRINT_CANCELLED"
  | "CAMERA_GRANTED" | "CAMERA_DENIED" | "CAMERA_TEST"
  | "DEVICE_PAIRED" | "DEVICE_DISCOVERED" | "DISCOVERY_RUN"
  | "PREFERENCE_CHANGED" | "TEST_RUN" | "TEST_FAILED" | "ERROR"

export type HardwareEventLevel = "INFO" | "WARN" | "ERROR"

export interface HardwareEvent {
  id: string
  at: string
  type: HardwareEventType
  level: HardwareEventLevel
  message: string
  detail?: string | null
}

const LEVELS: Record<HardwareEventType, HardwareEventLevel> = {
  SCANNER_CONNECTED: "INFO", SCANNER_LOST: "WARN", SCAN: "INFO",
  PRINTER_ONLINE: "INFO", PRINTER_OFFLINE: "WARN", PRINT_OK: "INFO",
  PRINT_FAILED: "ERROR", PRINT_QUEUED: "WARN", PRINT_RETRIED: "INFO", PRINT_CANCELLED: "INFO",
  CAMERA_GRANTED: "INFO", CAMERA_DENIED: "WARN", CAMERA_TEST: "INFO",
  DEVICE_PAIRED: "INFO", DEVICE_DISCOVERED: "INFO", DISCOVERY_RUN: "INFO",
  PREFERENCE_CHANGED: "INFO", TEST_RUN: "INFO", TEST_FAILED: "ERROR", ERROR: "ERROR",
}

/**
 * Diagnostics the operator ran on purpose. They belong in the timeline — a
 * support call wants to see that a test was run and what it found — but they
 * are NOT a verdict on live hardware. A "Test Scanner" that timed out at 09:00
 * says nothing about a scanner that has been reading garments since 09:05.
 */
const DIAGNOSTIC_TYPES = new Set<HardwareEventType>(["TEST_RUN", "TEST_FAILED", "CAMERA_TEST", "DISCOVERY_RUN"])

/**
 * Entries written before TEST_FAILED existed were recorded as plain ERROR, and
 * they are already sitting in operators' localStorage inflating the error tile.
 * Recognise them by message so history reclassifies itself without a migration.
 */
const LEGACY_DIAGNOSTIC_MESSAGES = [/scanner test/i, /camera test/i, /discovery/i]

export function isDiagnosticEvent(e: HardwareEvent): boolean {
  if (DIAGNOSTIC_TYPES.has(e.type)) return true
  return e.type === "ERROR" && LEGACY_DIAGNOSTIC_MESSAGES.some((re) => re.test(e.message))
}

/** Later proof that the subsystem works, which retires an earlier complaint. */
const RESOLVED_BY: Record<string, HardwareEventType[]> = {
  SCANNER_LOST: ["SCAN", "SCANNER_CONNECTED"],
  PRINTER_OFFLINE: ["PRINT_OK", "PRINTER_ONLINE"],
  PRINT_FAILED: ["PRINT_OK"],
}

const listeners = new Set<(e: HardwareEvent[]) => void>()

function read(): HardwareEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as HardwareEvent[]) : []
  } catch { return [] }
}

function write(list: HardwareEvent[]) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* quota — the log is expendable */ }
  }
  listeners.forEach((l) => l(list))
}

export const eventLog = {
  /** Newest first. */
  all(): HardwareEvent[] { return read() },

  record(type: HardwareEventType, message: string, detail?: string | null): HardwareEvent {
    const e: HardwareEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      type, level: LEVELS[type] ?? "INFO", message, detail: detail ?? null,
    }
    write([e, ...read()].slice(0, MAX_EVENTS))
    return e
  },

  subscribe(fn: (e: HardwareEvent[]) => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },

  latest(): HardwareEvent | null { return read()[0] ?? null },

  /**
   * Faults that are still true right now.
   *
   * Two things are deliberately excluded, because counting them made verified
   * hardware look broken:
   *   • diagnostics the operator ran by hand (see isDiagnosticEvent);
   *   • complaints a later success has already answered — a failed print at
   *     09:00 followed by a good print at 09:02 is history, not a fault.
   */
  activeErrors(): HardwareEvent[] {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const list = read() // newest first
    return list.filter((e, i) => {
      if (e.level !== "ERROR" || new Date(e.at) < since) return false
      if (isDiagnosticEvent(e)) return false
      const resolvers = RESOLVED_BY[e.type]
      // Anything newer sits at a LOWER index, this list being newest-first.
      return !resolvers || !list.slice(0, i).some((n) => resolvers.includes(n.type))
    })
  },

  /** What health and the dashboard tile report: active faults only. */
  errorCount(): number { return this.activeErrors().length },

  /** Everything the log has ever called an error, for the timeline view. */
  historicalErrorCount(): number {
    const since = new Date(); since.setHours(0, 0, 0, 0)
    return read().filter((e) => e.level === "ERROR" && new Date(e.at) >= since).length
  },

  lastOfType(...types: HardwareEventType[]): HardwareEvent | null {
    return read().find((e) => types.includes(e.type)) ?? null
  },

  search(q: string, level?: HardwareEventLevel | "ALL"): HardwareEvent[] {
    const needle = q.trim().toLowerCase()
    return read().filter((e) => {
      if (level && level !== "ALL" && e.level !== level) return false
      if (!needle) return true
      return e.message.toLowerCase().includes(needle)
        || e.type.toLowerCase().includes(needle)
        || (e.detail || "").toLowerCase().includes(needle)
    })
  },

  /** CSV, so a support ticket can carry the timeline as an attachment. */
  toCsv(rows: HardwareEvent[] = read()): string {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const head = "Timestamp,Level,Type,Message,Detail"
    return [head, ...rows.map((e) => [e.at, e.level, e.type, e.message, e.detail || ""].map(esc).join(","))].join("\n")
  },

  clear() { write([]) },
}
