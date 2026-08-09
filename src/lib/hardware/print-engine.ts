// The shared Print Engine — one entry point for every print in Laundry OS.
//
// A workflow hands over a role and some HTML. The engine resolves the store's
// default printer for that role, records diagnostics, and queues the job if the
// terminal is offline. Callers never branch on transport.
//
// HONEST LIMIT, and the most important thing to understand here: a web page
// cannot send bytes to an arbitrary printer. WebUSB/WebHID can talk to a device
// the user has explicitly paired, but driving a TSC or Epson directly means
// shipping TSPL/ESC-POS byte streams, and getting that wrong prints garbage on
// a live counter. So the engine renders through the browser's print path — the
// exact same mechanism, and byte-for-byte the same output, as today.
//
// What the default-printer selection therefore buys you is: the operator's
// choice is remembered and shown, diagnostics are attributed to a named
// device, and the browser's dialog opens against the right target where the OS
// honours it. It is a routing and bookkeeping layer, not a driver. Presenting
// it as more than that would be a lie a shift supervisor discovers at 7am.

import type { PrinterRole } from "./types"
import { BROWSER_PRINT_ID } from "./types"
import { diagnostics } from "./diagnostics"
import { deviceForRole } from "./profiles"

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

export interface QueuedJob extends PrintJob { id: string; queuedAt: string }

export type PrinterConnectivity = "ONLINE" | "OFFLINE"

type Listener = () => void

class PrintEngineImpl {
  private queue: QueuedJob[] = []
  private connectivity: PrinterConnectivity = "ONLINE"
  private listeners = new Set<Listener>()
  private storeId: string | null = null

  /** The Hardware Manager sets this so role lookups hit the right profile. */
  setStore(storeId: string | null) { this.storeId = storeId }

  subscribe(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((l) => l()) }

  status(): PrinterConnectivity { return this.connectivity }
  pending(): QueuedJob[] { return [...this.queue] }

  /**
   * Mark the printer offline. Jobs submitted from here on are held rather than
   * thrown away, because a dropped label is a garment nobody can find later.
   */
  setOffline(reason?: string) {
    if (this.connectivity === "OFFLINE") return
    this.connectivity = "OFFLINE"
    if (reason) diagnostics.recordPrintError(reason)
    this.emit()
  }

  /** Back online — flush whatever accumulated, oldest first. */
  async setOnline(): Promise<number> {
    this.connectivity = "ONLINE"
    this.emit()
    return this.resume()
  }

  async resume(): Promise<number> {
    if (this.connectivity === "OFFLINE") return 0
    const jobs = this.queue
    this.queue = []
    this.emit()
    let done = 0
    for (const j of jobs) {
      const ok = await this.dispatch(j)
      if (ok) done++
      else { this.queue.push(j); break } // stop at the first failure; keep order
    }
    this.emit()
    return done
  }

  discard(id: string) {
    this.queue = this.queue.filter((j) => j.id !== id)
    this.emit()
  }

  clearQueue() { this.queue = []; this.emit() }

  /** Which device will serve this job — the override, the store default, or browser print. */
  resolveTarget(role: PrinterRole, override?: string | null): string {
    return override || deviceForRole(this.storeId, role) || BROWSER_PRINT_ID
  }

  /**
   * The single call every workflow makes. Returns true when the job reached
   * the printer, false when it was queued for later.
   */
  async print(job: PrintJob): Promise<boolean> {
    if (this.connectivity === "OFFLINE") {
      this.queue.push({ ...job, id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, queuedAt: new Date().toISOString() })
      this.emit()
      return false
    }
    return this.dispatch(job)
  }

  private async dispatch(job: PrintJob): Promise<boolean> {
    try {
      await renderAndPrint(job.html, job.title || "Quantix")
      diagnostics.recordPrint(job.role, job.isLabel ? "LABEL" : "DOCUMENT", job.pieces ?? 1)
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Print failed"
      diagnostics.recordPrintError(msg)
      this.setOffline(msg)
      return false
    }
  }

  resetForTests() {
    this.queue = []
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
