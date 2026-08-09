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
  | "PREFERENCE_CHANGED" | "TEST_RUN" | "ERROR"

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
  PREFERENCE_CHANGED: "INFO", TEST_RUN: "INFO", ERROR: "ERROR",
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

  errorCount(): number {
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
