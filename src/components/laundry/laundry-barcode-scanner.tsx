"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ScanLine, Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScanEngine, useScanSink } from "@/lib/hardware"
import type { ScanStatus } from "@/lib/hardware"

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o?: { formats?: string[] }) => Detector
const getBarcodeDetector = (): DetectorCtor | null =>
  (typeof window !== "undefined" ? ((window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null) : null)

const formats = ["code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "qr_code"]

// ── Entry point ────────────────────────────────────────────────────────────────
export function LaundryBarcodeScanner({ onDetect, departmentLabel }: { onDetect: (code: string) => void; departmentLabel: string }) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [handling, setHandling] = useState(false)

  // This component is the one barcode surface every workstation renders, so
  // binding it to the shared ScanEngine puts Washing, Dry Cleaning, Dry & QC
  // and Sorting on the engine without touching a single workflow. The engine
  // classifies the input (USB / Bluetooth wedge, camera, manual), applies the
  // one deduplication window and records diagnostics; the workstation's own
  // handler runs from its dispatch, exactly as before.
  //
  // The field is a scan sink: without that marker the engine stands aside for
  // it — it is an <input> and permanently focused — and Enter would be the only
  // terminator that ever worked. There is no private duplicate guard here any
  // more; that is the engine's job and it belongs in one place.
  const handlingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>("MANUAL_ENTRY")

  const scanProps = useScanSink((code) => {
    if (handlingRef.current) return
    handlingRef.current = true
    setHandling(true)
    Promise.resolve(onDetect(code)).finally(() => {
      handlingRef.current = false
      setHandling(false)
      if (inputRef.current) { inputRef.current.value = ""; inputRef.current.focus() }
    })
  }, { inputRef })

  useEffect(() => {
    setScanStatus(ScanEngine.status())
    return ScanEngine.subscribe(setScanStatus)
  }, [])

  const inputId = "laundry-barcode-scanner-input"

  // Permanent auto-focus: re-focus after any focus loss, unless user is in
  // another input/textarea/select or camera is open.
  // While another surface holds the scanner (a Scan Bag dialog), this input must
  // keep its hands off the focus. The permanent auto-focus below re-focused this
  // field 10ms after ANY focus loss — including the loss caused by a dialog's
  // own autoFocus — which both stole the caret from the dialog and, because a
  // sink re-attaches on focus, put this handler back at the front of the queue.
  // That is how a bag QR ended up at the garment handler.
  const scannerBusyElsewhere = () =>
    ScanEngine.hasOwner() || (typeof document !== "undefined" && !!document.querySelector("[role='dialog']"))

  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout>
    const onFocusOut = () => {
      if (scannerBusyElsewhere()) return
      focusTimer = setTimeout(() => {
        // Re-checked on the timer: the dialog may have opened in between.
        if (!scannerBusyElsewhere()) inputRef.current?.focus()
      }, 10)
    }
    const onKeyDoc = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCameraOpen(false); return }
      if (cameraOpen || scannerBusyElsewhere()) return
      if (e.target === inputRef.current) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      inputRef.current?.focus()
    }
    const onClickDoc = (e: MouseEvent) => {
      if (cameraOpen || scannerBusyElsewhere()) return
      const target = e.target as HTMLElement
      if (target.closest("button, a, input, textarea, select, [role='dialog'], [role='button']")) return
      setTimeout(() => { if (!scannerBusyElsewhere()) inputRef.current?.focus() }, 20)
    }
    document.addEventListener("focusout", onFocusOut)
    document.addEventListener("keydown", onKeyDoc)
    document.addEventListener("mousedown", onClickDoc)
    const initFocus = setTimeout(() => { if (!scannerBusyElsewhere()) inputRef.current?.focus() }, 100)
    return () => {
      clearTimeout(focusTimer); clearTimeout(initFocus)
      document.removeEventListener("focusout", onFocusOut)
      document.removeEventListener("keydown", onKeyDoc)
      document.removeEventListener("mousedown", onClickDoc)
    }
  }, [cameraOpen])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 max-w-2xl">
        <div className="relative flex-1 flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-blue-500 shrink-0" />
          <input
            id={inputId}
            autoFocus
            className="block w-full h-11 rounded-lg border border-blue-200 bg-white px-4 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400"
            placeholder={`Scan barcode for ${departmentLabel}…`}
            {...scanProps}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-11 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 shrink-0"
            onClick={() => setCameraOpen((o) => !o)}
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">Camera</span>
          </Button>
        </div>
        {handling && <Loader2 className="h-5 w-5 animate-spin text-blue-600 shrink-0" />}
      </div>

      {cameraOpen && (
        <CameraScanner
          onDetected={(code: string) => { setCameraOpen(false); ScanEngine.submit(code.trim().toUpperCase(), "CAMERA") }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${scanStatus === "SCANNER_READY" ? "bg-emerald-500" : scanStatus === "CAMERA_READY" ? "bg-amber-400" : "bg-rose-400"}`} />
        {ScanEngine.statusLabel()} — scan a garment barcode to auto-start, scan again to complete. USB/Bluetooth scanners supported.
      </p>
    </div>
  )
}

// ── Camera scanner with BarcodeDetector + ZXing fallback ──────────────────────
function CameraScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const streamsRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let zxingCleanup: (() => void) | null = null

    const native = getBarcodeDetector()
    const detector = native ? new native({ formats }) : null

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        streamsRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        setReady(true)

        if (detector) {
          // ── Native BarcodeDetector ────────────────────────────────────────
          const tick = async () => {
            if (stopped || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length && codes[0].rawValue) {
                stopped = true; stopMedia(stream)
                onDetected(codes[0].rawValue); return
              }
            } catch { /* transient */ }
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        } else {
          // ── ZXing fallback ────────────────────────────────────────────────
          try {
            const { BrowserMultiFormatReader } = await import("@zxing/library")
            const reader = new BrowserMultiFormatReader()
            const preview = videoRef.current
            if (!preview) return
            const result = await reader.decodeOnceFromVideoDevice(undefined, preview)
            if (result?.getText && !stopped) {
              stopped = true; stopMedia(stream)
              onDetected(result.getText())
            }
            zxingCleanup = () => { try { reader.reset() } catch { /* noop */ } }
          } catch {
            if (!stopped) setErr("Could not read barcode from camera. Try USB scanner.")
          }
        }
      } catch { setErr("Camera access denied. Grant permission or use a scanner.") }
    })()

    return () => {
      stopped = true; cancelAnimationFrame(raf); stopMedia(stream)
      if (zxingCleanup) zxingCleanup()
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-md w-full rounded-xl overflow-hidden bg-black" onClick={(e) => e.stopPropagation()}>
        {err ? (
          <div className="p-6 text-center">
            <p className="text-sm text-amber-300 bg-amber-900/40 rounded-lg p-3">{err}</p>
            <button onClick={onClose} className="mt-3 text-sm text-white/60 hover:text-white">Close</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="w-full aspect-video object-cover" />
            <div className="absolute inset-12 border-2 border-white/50 rounded-xl pointer-events-none" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center"><Camera className="h-8 w-8 text-white/60 animate-pulse" /></div>}
            <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/30 rounded-full p-1.5 text-sm">✕</button>
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/60">Point camera at barcode</p>
          </>
        )}
      </div>
    </div>
  )
}

function stopMedia(s: MediaStream | null) {
  if (!s) return
  s.getTracks().forEach((t) => t.stop())
}
