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

export type HealthLevel = "NOT_VERIFIED" | "VERIFIED" | "ATTENTION" | "CRITICAL"

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
  // Proof, not capability: a scanner counts as real only once it has typed.
  const scannerVerified = ScanEngine.everScanned()

  if (PrintEngine.status() === "OFFLINE") issues.push("Printer Offline")
  if (failed > 0) issues.push(`${failed} failed print${failed === 1 ? "" : "s"}`)
  if (queueLength > 0) issues.push(`${queueLength} job${queueLength === 1 ? "" : "s"} queued`)
  if (!scannerVerified) issues.push("Scanner not verified")

  // A printer that has failed, or held work, is a counter that has stopped —
  // that outranks anything unproven.
  const level: HealthLevel =
    PrintEngine.status() === "OFFLINE" || failed > 0 ? "CRITICAL"
      : queueLength > 0 ? "ATTENTION"
        // Never "healthy" by default. Nothing has been observed yet, and
        // saying so is the whole point of this screen.
        : !scannerVerified ? "NOT_VERIFIED"
          : "VERIFIED"

  const label =
    level === "VERIFIED" ? "Scanner Verified"
      : level === "NOT_VERIFIED" ? "Hardware Not Verified"
        : issues[0] ?? "Attention Required"

  return { level, label, issues, queueLength, errorsToday }
}
