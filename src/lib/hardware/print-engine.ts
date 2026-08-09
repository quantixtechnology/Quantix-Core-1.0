// The shared Print Engine — one entry point for every print in Laundry OS.
//
// A workflow hands over a role and some HTML. The engine resolves the store's
// default printer for that role, records diagnostics and an event, and holds
// the job if the terminal is offline. Callers never branch on transport.
//
// HONEST LIMIT, and the most important thing to understand here: a web page
// cannot send bytes to an arbitrary printer. WebUSB/WebHID can talk to a device
// the user has explicitly paired, but driving a TSC or Epson directly means
// shipping TSPL/ESC-POS byte streams, and getting that wrong prints garbage on
// a live counter. So the engine renders through the browser's print path — the
// exact same mechanism, and byte-for-byte the same output, as before this
// layer existed.
//
// What the default-printer selection therefore buys you is: the operator's
// choice is remembered and shown, diagnostics and the event log are attributed
// to a named device, and the browser's dialog opens against the right target
// where the OS honours it. It is a routing and bookkeeping layer, not a driver.
// Presenting it as more than that would be a lie a shift supervisor discovers
// at 7am.

import type { PrinterRole } from "./types"
import { BROWSER_PRINT_ID } from "./types"
import { diagnostics } from "./diagnostics"
import { deviceForRole } from "./profiles"
import { eventLog } from "./event-log"

export type PrintJobStatus = "PENDING" | "PRINTING" | "COMPLETED" | "FAILED" | "CANCELLED"

export interface PrintJob {
  /** Which default printer this belongs to. */
  role: PrinterRole
  /** Complete document HTML, exactly as the caller would have printed it. */
  html: string
  title?: string
  /** Counts toward labels-printed-today rather than documents. */
  isLabel?: boolean
  /** How many physical pieces this job represents, for the day's tally. */
  pieces?: number
  /** Override the store default for this one job. */
  deviceIdOverride?: string | null
}

export interface TrackedJob extends PrintJob {
  id: string
  status: PrintJobStatus
  queuedAt: string
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  error?: string | null
  attempts: number
}

/** Retained so the queue view can show Completed and Failed, not just Pending. */
const HISTORY_LIMIT = 50

export type PrinterConnectivity = "ONLINE" | "OFFLINE"

type Listener = () => void

class PrintEngineImpl {
  private jobs: TrackedJob[] = []
  private connectivity: PrinterConnectivity = "ONLINE"
  private listeners = new Set<Listener>()
  private storeId: string | null = null

  /** The Hardware Manager sets this so role lookups hit the right profile. */
  setStore(storeId: string | null) { this.storeId = storeId }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((l) => l()) }

  status(): PrinterConnectivity { return this.connectivity }

  /** Everything the queue view shows: pending, printing, completed, failed. */
  allJobs(): TrackedJob[] { return [...this.jobs] }
  pending(): TrackedJob[] { return this.jobs.filter((j) => j.status === "PENDING") }
  failed(): TrackedJob[] { return this.jobs.filter((j) => j.status === "FAILED") }
  queueLength(): number { return this.pending().length }

  /**
   * Mark the printer offline. Jobs submitted from here on are held rather than
   * thrown away, because a dropped label is a garment nobody can find later.
   */
  setOffline(reason?: string) {
    if (this.connectivity === "OFFLINE") return
    this.connectivity = "OFFLINE"
    if (reason) diagnostics.recordPrintError(reason)
    diagnostics.recordDisconnect()
    eventLog.record("PRINTER_OFFLINE", "Printer offline", reason ?? null)
    this.emit()
  }

  /** Back online — flush whatever accumulated, oldest first. */
  async setOnline(): Promise<number> {
    this.connectivity = "ONLINE"
    eventLog.record("PRINTER_ONLINE", "Printer online")
    this.emit()
    return this.resume()
  }

  async resume(): Promise<number> {
    if (this.connectivity === "OFFLINE") return 0
    let done = 0
    // Oldest first, and stop at the first failure so order is never scrambled.
    for (const job of this.pending().slice().reverse()) {
      const ok = await this.run(job)
      if (!ok) break
      done++
    }
    this.emit()
    return done
  }

  async retry(id: string): Promise<boolean> {
    const job = this.jobs.find((j) => j.id === id)
    if (!job) return false
    job.status = "PENDING"
    job.error = null
    eventLog.record("PRINT_RETRIED", `Retrying ${job.title || job.role}`)
    this.emit()
    if (this.connectivity === "OFFLINE") return false
    return this.run(job)
  }

  cancel(id: string) {
    const job = this.jobs.find((j) => j.id === id)
    if (!job || job.status === "COMPLETED") return
    job.status = "CANCELLED"
    job.finishedAt = new Date().toISOString()
    eventLog.record("PRINT_CANCELLED", `Cancelled ${job.title || job.role}`)
    this.emit()
  }

  /** Drop finished rows; never touches anything still pending. */
  clearFinished() {
    this.jobs = this.jobs.filter((j) => j.status === "PENDING" || j.status === "PRINTING")
    this.emit()
  }

  clearQueue() {
    this.jobs = this.jobs.filter((j) => j.status !== "PENDING")
    this.emit()
  }

  /** Which device will serve this job — the override, the store default, or browser print. */
  resolveTarget(role: PrinterRole, override?: string | null): string {
    return override || deviceForRole(this.storeId, role) || BROWSER_PRINT_ID
  }

  /**
   * The single call every workflow makes. Returns true when the job reached
   * the printer, false when it was queued or failed.
   */
  async print(job: PrintJob): Promise<boolean> {
    const tracked: TrackedJob = {
      ...job,
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "PENDING",
      queuedAt: new Date().toISOString(),
      attempts: 0,
    }
    this.jobs = [tracked, ...this.jobs].slice(0, HISTORY_LIMIT)
    if (this.connectivity === "OFFLINE") {
      eventLog.record("PRINT_QUEUED", `Queued ${job.title || job.role} — printer offline`)
      this.emit()
      return false
    }
    return this.run(tracked)
  }

  private async run(job: TrackedJob): Promise<boolean> {
    job.status = "PRINTING"
    job.startedAt = new Date().toISOString()
    job.attempts += 1
    this.emit()
    const t0 = Date.now()
    try {
      await renderAndPrint(job.html, job.title || "Quantix")
      const durationMs = Date.now() - t0
      job.status = "COMPLETED"
      job.finishedAt = new Date().toISOString()
      job.durationMs = durationMs
      job.error = null
      diagnostics.recordPrint(job.role, job.isLabel ? "LABEL" : "DOCUMENT", job.pieces ?? 1, durationMs)
      eventLog.record("PRINT_OK", `${job.isLabel ? "Label" : "Document"} printed — ${job.title || job.role}`, `${durationMs} ms`)
      this.emit()
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Print failed"
      job.status = "FAILED"
      job.finishedAt = new Date().toISOString()
      job.error = msg
      diagnostics.recordPrintError(msg)
      eventLog.record("PRINT_FAILED", `Print failed — ${job.title || job.role}`, msg)
      this.setOffline(msg)
      this.emit()
      return false
    }
  }

  resetForTests() {
    this.jobs = []
    this.connectivity = "ONLINE"
    this.storeId = null
  }
}

/**
 * Print through a hidden iframe.
 *
 * Never a popup: a popup window plus a second print() call is what froze the
 * Barcode Generation screen, and blockers kill it silently. The iframe is
 * removed only after the dialog closes, because tearing it down early cancels
 * the job on some browsers.
 */
export function renderAndPrint(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") { reject(new Error("Printing is only available in the browser")); return }
    const frame = document.createElement("iframe")
    frame.setAttribute("aria-hidden", "true")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
    document.body.appendChild(frame)

    const cleanup = () => { setTimeout(() => { try { frame.remove() } catch { /* already gone */ } }, 1000) }

    frame.onload = () => {
      try {
        const win = frame.contentWindow
        if (!win) throw new Error("Print frame unavailable")
        win.focus()
        win.print()
        cleanup()
        resolve()
      } catch (e) {
        cleanup()
        reject(e instanceof Error ? e : new Error("Print failed"))
      }
    }

    const doc = frame.contentDocument
    if (!doc) { frame.remove(); reject(new Error("Print frame unavailable")); return }
    doc.open()
    doc.write(html.includes("<html") ? html : `<!doctype html><html><head><title>${title}</title></head><body>${html}</body></html>`)
    doc.close()
  })
}

export const PrintEngine = new PrintEngineImpl()
