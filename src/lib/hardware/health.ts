// One health verdict, computed in one place.
//
// The header chip and the Hardware dashboard must never disagree — a green
// header above a red dashboard destroys trust in both — so both read this.
//
// Severity order is deliberate: a printer that is offline is louder than a
// scanner that has gone quiet, because a queued label blocks the counter
// whereas a missing scanner still lets the operator type.

import { ScanEngine } from "./scan-engine"
import { PrintEngine } from "./print-engine"
import { eventLog } from "./event-log"

export type HealthLevel = "HEALTHY" | "DEGRADED" | "CRITICAL"

export interface HardwareHealth {
  level: HealthLevel
  label: string
  /** Every current complaint, most severe first. */
  issues: string[]
  queueLength: number
  errorsToday: number
}

export function hardwareHealth(): HardwareHealth {
  const issues: string[] = []
  const queueLength = PrintEngine.queueLength()
  const failed = PrintEngine.failed().length
  const errorsToday = eventLog.errorCount()
  const scan = ScanEngine.status()

  if (PrintEngine.status() === "OFFLINE") issues.push("Printer Offline")
  if (failed > 0) issues.push(`${failed} failed print${failed === 1 ? "" : "s"}`)
  if (queueLength > 0) issues.push(`${queueLength} job${queueLength === 1 ? "" : "s"} queued`)
  // Manual entry means neither a scanner nor a camera is available — the
  // operator can still work, but nothing is being read automatically.
  if (scan === "MANUAL_ENTRY") issues.push("Scanner Missing")

  const level: HealthLevel = PrintEngine.status() === "OFFLINE" || failed > 0
    ? "CRITICAL"
    : scan === "MANUAL_ENTRY" || queueLength > 0
      ? "DEGRADED"
      : "HEALTHY"

  return {
    level,
    label: level === "HEALTHY" ? "Hardware Healthy" : issues[0] ?? "Hardware Degraded",
    issues,
    queueLength,
    errorsToday,
  }
}
