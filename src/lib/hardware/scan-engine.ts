// The shared Scan Engine — one entry point for every barcode in Laundry OS.
//
// A workflow never asks where a code came from. It attaches a handler and
// receives codes; the engine walks the ladder
//
//     USB scanner → Bluetooth scanner → camera → manual entry
//
// and reports which rung is live so a screen can show the right status chip.
// Nothing needs configuring: a keyboard-wedge scanner is recognised by how it
// types, and if none is present the camera (or the keyboard) simply serves.
//
// HONEST LIMIT: a USB wedge and a Bluetooth wedge are the same thing to a
// browser — both deliver keystrokes, with nothing to tell them apart. The
// engine therefore reports a wedge as USB unless a paired Bluetooth scanner is
// known from the device registry, which `setKnownScannerConnection` supplies.
// It never claims a transport it cannot observe.

import type { ScanEvent, ScanSource, ScanStatus } from "./types"
import { diagnostics } from "./diagnostics"

/** A hardware wedge types far faster than a person; 35ms/char is a wide margin. */
const MAX_WEDGE_GAP_MS = 35
/** Shorter bursts are indistinguishable from ordinary typing. */
const MIN_WEDGE_LENGTH = 4
/** A scanner that has said nothing for this long is treated as gone. */
const SCANNER_IDLE_MS = 5 * 60 * 1000
/** Identical code inside this window is one physical scan, not two. */
const DUPLICATE_WINDOW_MS = 900

type Handler = (e: ScanEvent) => void

interface Attachment { id: number; handler: Handler }

class ScanEngineImpl {
  private attachments: Attachment[] = []
  private nextId = 1
  private statusListeners = new Set<(s: ScanStatus) => void>()

  private wedgeLastSeenAt: number | null = null
  private knownScannerConnection: "USB" | "BLUETOOTH" | null = null
  private cameraAvailable = false
  private started = false
  private detachKeys: (() => void) | null = null

  // Keystroke buffer used only to classify input speed.
  private buf = ""
  private bufStartedAt = 0
  private lastKeyAt = 0
  private gaps: number[] = []

  private lastDispatch: { code: string; at: number } = { code: "", at: 0 }

  // ── lifecycle ─────────────────────────────────────────────────────────────

  /** Idempotent; safe to call from every screen that mounts a scanner. */
  start() {
    if (this.started || typeof window === "undefined") return
    this.started = true
    const onKeyDown = (e: KeyboardEvent) => this.observeKey(e)
    window.addEventListener("keydown", onKeyDown, true)
    this.detachKeys = () => window.removeEventListener("keydown", onKeyDown, true)
    this.cameraAvailable = !!navigator?.mediaDevices?.getUserMedia
    this.emitStatus()
  }

  stop() {
    this.detachKeys?.()
    this.detachKeys = null
    this.started = false
  }

  // ── input classification ──────────────────────────────────────────────────

  /**
   * Watches typing rhythm to decide whether a scanner is attached. It does not
   * consume the keystrokes: the focused input still receives them exactly as
   * before, so existing screens behave identically.
   */
  private observeKey(e: KeyboardEvent) {
    const now = Date.now()
    if (e.key === "Enter") {
      if (this.buf.length >= MIN_WEDGE_LENGTH && this.isFastBurst()) this.noteWedgeSeen(now)
      this.resetBuffer()
      return
    }
    if (e.key.length !== 1) return // modifiers, arrows — not part of a barcode
    if (now - this.lastKeyAt > 500) this.resetBuffer() // new burst
    if (!this.buf) this.bufStartedAt = now
    else this.gaps.push(now - this.lastKeyAt)
    this.buf += e.key
    this.lastKeyAt = now
  }

  private isFastBurst(): boolean {
    if (!this.gaps.length) return false
    const mean = this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length
    return mean <= MAX_WEDGE_GAP_MS
  }

  private resetBuffer() {
    this.buf = ""
    this.gaps = []
    this.bufStartedAt = 0
  }

  private noteWedgeSeen(at: number) {
    const was = this.status()
    this.wedgeLastSeenAt = at
    if (was !== this.status()) this.emitStatus()
  }

  /** Duration of the burst that produced the current buffer, for diagnostics. */
  private burstDurationMs(): number | undefined {
    if (!this.bufStartedAt) return undefined
    return Math.max(0, this.lastKeyAt - this.bufStartedAt)
  }

  // ── status ────────────────────────────────────────────────────────────────

  /** Where input is expected to come from right now. */
  status(): ScanStatus {
    if (this.wedgeLastSeenAt && Date.now() - this.wedgeLastSeenAt < SCANNER_IDLE_MS) return "SCANNER_READY"
    if (this.cameraAvailable) return "CAMERA_READY"
    return "MANUAL_ENTRY"
  }

  statusLabel(): string {
    switch (this.status()) {
      case "SCANNER_READY": return this.knownScannerConnection === "BLUETOOTH" ? "Bluetooth scanner ready" : "Scanner ready"
      case "CAMERA_READY": return "Camera ready"
      default: return "Manual entry"
    }
  }

  subscribe(fn: (s: ScanStatus) => void) {
    this.statusListeners.add(fn)
    return () => { this.statusListeners.delete(fn) }
  }

  private emitStatus() {
    const s = this.status()
    this.statusListeners.forEach((l) => l(s))
  }

  /** The registry tells the engine when the paired scanner is Bluetooth. */
  setKnownScannerConnection(c: "USB" | "BLUETOOTH" | null) {
    this.knownScannerConnection = c
  }

  setCameraAvailable(v: boolean) {
    if (this.cameraAvailable === v) return
    this.cameraAvailable = v
    this.emitStatus()
  }

  // ── dispatch ──────────────────────────────────────────────────────────────

  /**
   * Register interest in scans. The most recently attached handler wins, so a
   * dialog opened over a workstation takes the scanner and hands it back on
   * close. Returns the detach function.
   */
  attach(handler: Handler): () => void {
    const a = { id: this.nextId++, handler }
    this.attachments.push(a)
    this.start()
    return () => { this.attachments = this.attachments.filter((x) => x.id !== a.id) }
  }

  /**
   * Deliver a code. Every barcode surface routes through here — the wedge
   * input, the camera, and the manual box — so dedupe, classification and
   * diagnostics happen once instead of in each screen.
   *
   * Returns false when the code was swallowed as a duplicate.
   */
  submit(rawCode: string, source?: ScanSource): boolean {
    const code = String(rawCode || "").trim()
    if (!code) return false
    const now = Date.now()
    if (code === this.lastDispatch.code && now - this.lastDispatch.at < DUPLICATE_WINDOW_MS) return false
    this.lastDispatch = { code, at: now }

    const resolved: ScanSource = source ?? this.inferSource()
    const durationMs = resolved === "USB_SCANNER" || resolved === "BLUETOOTH_SCANNER" ? this.burstDurationMs() : undefined
    if (resolved === "USB_SCANNER" || resolved === "BLUETOOTH_SCANNER") this.noteWedgeSeen(now)

    const event: ScanEvent = { code, source: resolved, at: now, durationMs }
    diagnostics.recordScan(code, resolved, durationMs)
    this.attachments[this.attachments.length - 1]?.handler(event)
    return true
  }

  /** Wedge if one is live and the burst looked mechanical, else manual. */
  private inferSource(): ScanSource {
    if (this.buf.length >= MIN_WEDGE_LENGTH && this.isFastBurst()) {
      return this.knownScannerConnection === "BLUETOOTH" ? "BLUETOOTH_SCANNER" : "USB_SCANNER"
    }
    if (this.wedgeLastSeenAt && Date.now() - this.wedgeLastSeenAt < SCANNER_IDLE_MS) {
      return this.knownScannerConnection === "BLUETOOTH" ? "BLUETOOTH_SCANNER" : "USB_SCANNER"
    }
    return "MANUAL"
  }

  /**
   * One-shot capture, for the Hardware Manager's "Test Scanner" button — no
   * workflow, no order, just proof that input arrives.
   */
  scanOnce(timeoutMs = 30000): Promise<ScanEvent | null> {
    return new Promise((resolve) => {
      let done = false
      const detach = this.attach((e) => {
        if (done) return
        done = true; detach(); clearTimeout(timer); resolve(e)
      })
      const timer = setTimeout(() => {
        if (done) return
        done = true; detach(); resolve(null)
      }, timeoutMs)
    })
  }

  /** Test seam — forget everything learned about the attached hardware. */
  resetForTests() {
    this.attachments = []
    this.wedgeLastSeenAt = null
    this.knownScannerConnection = null
    this.cameraAvailable = false
    this.lastDispatch = { code: "", at: 0 }
    this.resetBuffer()
  }
}

export const ScanEngine = new ScanEngineImpl()
export type { ScanEvent, ScanSource, ScanStatus }
