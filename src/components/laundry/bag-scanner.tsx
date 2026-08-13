"use client"

// Universal Bag Scanner (UI only). One "Scan Bag" button that adapts to the
// device — reused everywhere a reusable bag QR is scanned (Assign, Receive,
// Audit, Processing, Delivery). No workflow/engine changes.
//
//   • Mobile → device camera via the browser-native BarcodeDetector.
//   • Desktop / USB / Bluetooth → a focused capture field; keyboard-wedge
//     scanners type the value + Enter (no drivers, no SDK).
//   • Mode is Auto-Detect by default (camera on mobile, scanner on desktop) and
//     stored per-device in localStorage — most businesses never change it.
import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScanLine, Camera, Keyboard, Settings2, Loader2 } from "lucide-react"
import { ScanEngine, useScanSink } from "@/lib/hardware"

type ScannerMode = "auto" | "camera" | "usb" | "bluetooth"
const MODE_KEY = "quantix_bag_scanner_mode"

export function getScannerMode(): ScannerMode {
  if (typeof window === "undefined") return "auto"
  const v = window.localStorage.getItem(MODE_KEY)
  return v === "camera" || v === "usb" || v === "bluetooth" ? v : "auto"
}
function setScannerMode(m: ScannerMode) { try { window.localStorage.setItem(MODE_KEY, m) } catch { /* noop */ } }

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches)
}

// Minimal typing for the browser-native BarcodeDetector (not in TS DOM lib).
type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o?: { formats?: string[] }) => Detector
const getBarcodeDetector = (): DetectorCtor | null =>
  (typeof window !== "undefined" ? (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector : undefined) || null

// ── The Scan Bag button ──────────────────────────────────────────────────────
export function BagScanButton({ onScan, label = "Scan Bag", disabled, size = "default", className, closeOnScan = false }: {
  onScan: (code: string) => void | Promise<void>
  label?: string; disabled?: boolean; size?: "default" | "sm"; className?: string
  // Auto-close the scanner after a single successful scan (single-item flows).
  // Default keeps the scanner open for rapid repeat scanning (bulk flows).
  closeOnScan?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} disabled={disabled} onClick={() => setOpen(true)} className={`gap-1.5 bg-blue-600 hover:bg-blue-700 text-white ${className || ""}`}>
        <ScanLine className="h-4 w-4" /> {label}
      </Button>
      {open && <ScannerModal onClose={() => setOpen(false)} onScan={onScan} closeOnScan={closeOnScan} />}
    </>
  )
}

function ScannerModal({ onClose, onScan, closeOnScan = false }: { onClose: () => void; onScan: (code: string) => void | Promise<void>; closeOnScan?: boolean }) {
  const [mode, setMode] = useState<ScannerMode>(getScannerMode())
  const [showSettings, setShowSettings] = useState(false)
  const useCamera = mode === "auto" ? isMobileDevice() && !!getBarcodeDetector() : mode === "camera"
  const [handling, setHandling] = useState(false)
  const handlingRef = useRef(false)

  // The bag/QR surface shared by Store Audit, Pickup Bags, Bag Management,
  // Sorting, Console & Receive and Transit. It runs on the same ScanEngine as
  // every other station: the field is a scan sink, so Enter, Tab and a scanner
  // with no suffix all arrive, deduplicated and recorded once.
  //
  // Opening this dialog takes the scanner from the screen underneath — the
  // engine gives it to the most recent attachment — and closing hands it back.
  const run = useCallback(async (code: string) => {
    const c = code.trim()
    if (!c || handlingRef.current) return
    handlingRef.current = true
    setHandling(true)
    try { await onScan(c) } finally {
      handlingRef.current = false
      if (closeOnScan) { onClose(); return }
      // Allow immediate rescanning — clear + refocus rather than closing.
      setHandling(false)
      setTimeout(() => scanProps.ref.current?.focus(), 30)
    }
  }, [onScan, closeOnScan, onClose])
  const scanProps = useScanSink(run)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-blue-600" /> Scan Bag</span>
            <button onClick={() => setShowSettings((s) => !s)} className="text-slate-400 hover:text-slate-600"><Settings2 className="h-4 w-4" /></button>
          </DialogTitle>
        </DialogHeader>

        {showSettings && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Bag Scanner</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([["auto", "Auto Detect"], ["camera", "Mobile Camera"], ["usb", "USB Scanner"], ["bluetooth", "Bluetooth Scanner"]] as const).map(([v, lbl]) => (
                <button key={v} onClick={() => { setMode(v); setScannerMode(v) }} className={`rounded-md border px-2 py-1.5 text-xs font-medium ${mode === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}>{lbl}</button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">Auto Detect uses the camera on phones/tablets and a keyboard scanner on desktop.</p>
          </div>
        )}

        {useCamera ? (
          <CameraScan onDetected={(c) => ScanEngine.submit(c.trim().toUpperCase(), "CAMERA")} />
        ) : (
          <div className="space-y-2 text-center py-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center"><Keyboard className="h-6 w-6 text-blue-600" /></div>
            <p className="text-sm text-slate-600">Scan the bag QR now — the USB/Bluetooth scanner enters it automatically.</p>
            {/* Focused capture field: keyboard-wedge scanners type here + Enter. */}
            <Input autoFocus placeholder="Waiting for scan…" className="h-11 text-center font-mono text-[15px] uppercase" {...scanProps} />
            {handling && <p className="text-xs text-slate-400 flex items-center justify-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing…</p>}
          </div>
        )}
        <button onClick={onClose} className="mt-1 text-xs text-slate-400 hover:text-slate-600 mx-auto block">Close</button>
      </DialogContent>
    </Dialog>
  )
}

// Live camera QR scanning via the native BarcodeDetector (Android/Chromium).
function CameraScan({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const Ctor = getBarcodeDetector()
    if (!Ctor) { setErr("Camera scanning isn't supported on this device. Use a USB/Bluetooth scanner (Settings) or a supported browser."); return }
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const detector = new Ctor({ formats: ["qr_code"] })
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        setReady(true)
        const tick = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length && codes[0].rawValue) { onDetected(codes[0].rawValue); }
          } catch { /* transient */ }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      } catch { setErr("Could not access the camera. Grant camera permission, or use a scanner (Settings).") }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()) }
  }, [onDetected])

  if (err) return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">{err}</p>
  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
      <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
      <div className="absolute inset-8 border-2 border-white/70 rounded-xl pointer-events-none" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/80"><Camera className="h-6 w-6 animate-pulse" /></div>}
    </div>
  )
}
