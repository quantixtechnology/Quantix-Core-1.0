"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Barcode as BarcodeIcon, Search, Loader2, User, MapPin, ShoppingBag, Clock, CheckCircle, XCircle, AlertTriangle, Camera, Copy, Printer, ExternalLink, ScanLine } from "lucide-react"
import { Barcode } from "./barcode"
import { printLabels, loadLabelConfig, saveLabelConfig, type LabelConfig, type LabelData } from "@/lib/laundry-label"
import { useAuthStore } from "@/stores/auth-store"

interface ScanResult {
  item: {
    id: string; itemNumber: string; barcode: string; garmentScanCode: string | null; garmentName: string; serviceName: string;
    quantity: number; processingStage: string; processingStatus: string; processFlow: string;
    qcFailCount: number; department: string; stageLabel: string;
    condition: string | null; defects: string | null;
  }
  business: { businessName: string; businessCode: string } | null
  store: { storeName: string; storeCode: string } | null
  customer: { name: string; phone: string | null } | null
  order: { id: string; orderNumber: string; status: string; grandTotal: number; expectedDeliveryDate: string | null }
  currentDepartment: string
  timeline: Array<{ id: string; action: string; department: string; fromStage: string | null; toStage: string | null; actorName: string | null; note: string | null; createdAt: string }>
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = new (o?: { formats?: string[] }) => Detector
const getBarcodeDetector = (): DetectorCtor | null =>
  (typeof window !== "undefined" ? ((window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null) : null)

function stopMedia(s: MediaStream | null) {
  if (!s) return; s.getTracks().forEach((t) => t.stop())
}

function CameraScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stopped = false; let zxingCleanup: (() => void) | null = null
    const native = getBarcodeDetector()
    const detector = native ? new native({ formats: ["code_128", "code_39", "code_93", "codabar", "ean_13", "ean_8", "qr_code"] }) : null
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
        if (detector) {
          const tick = async () => {
            if (stopped || !videoRef.current) return
            try { const codes = await detector.detect(videoRef.current); if (codes.length && codes[0].rawValue) { stopped = true; stopMedia(stream); onDetected(codes[0].rawValue); return } } catch { /* transient */ }
            raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
        } else {
          try {
            const { BrowserMultiFormatReader } = await import("@zxing/library")
            const reader = new BrowserMultiFormatReader()
            const preview = videoRef.current
            if (!preview) return
            const result = await reader.decodeOnceFromVideoDevice(undefined, preview)
            if (result?.getText && !stopped) { stopped = true; stopMedia(stream); onDetected(result.getText()) }
            zxingCleanup = () => { try { reader.reset() } catch {} }
          } catch { if (!stopped) setErr("Could not read barcode from camera.") }
        }
      } catch { setErr("Camera access denied.") }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stopMedia(stream); if (zxingCleanup) zxingCleanup() }
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
            <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white bg-black/30 rounded-full p-1.5 text-sm">✕</button>
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/60">Point camera at barcode</p>
          </>
        )}
      </div>
    </div>
  )
}

export function LaundryGarmentLookup() {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const garCode = (r: ScanResult | null) => r?.item.garmentScanCode || r?.item.barcode || ""
  const [code, setCode] = useState("")
  const [result, setResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [scanMode, setScanMode] = useState(false)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const [cfg] = useState<LabelConfig>(loadLabelConfig())

  const search = useCallback(async (q: string) => {
    const query = q.trim()
    if (!query) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/laundry/scan?barcode=${encodeURIComponent(query)}`)
      const j = await res.json()
      if (j.success) {
        setResult(j.data)
      } else {
        setResult(null)
        toast({ title: "Not found", description: j.error || "No garment matches this code.", variant: "destructive" })
      }
    } catch {
      setResult(null)
      toast({ title: "Search failed", description: "Could not reach the server.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const submitSearch = useCallback(() => {
    search(code)
  }, [code, search])

  const handleScanDetect = useCallback((scanned: string) => {
    const q = scanned.trim().toUpperCase()
    setCode(q)
    search(q)
  }, [search])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submitSearch()
  }

  // Auto-focus scanner input in scan mode
  useEffect(() => {
    if (scanMode && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [scanMode, result])

  // Duplicate scan guard for scanner mode
  const lastCode = useRef("")
  const lastTime = useRef(0)
  const scanGuard = (code: string): boolean => {
    const now = Date.now()
    if (code === lastCode.current && now - lastTime.current < 2000) return true
    lastCode.current = code; lastTime.current = now
    return false
  }

  const handleScanInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const val = e.currentTarget.value.trim().toUpperCase()
      if (!val || scanGuard(val)) return
      setCode(val)
      search(val)
      e.currentTarget.value = ""
    }
  }, [search])

  const stageColor = (stage: string) => {
    const map: Record<string, string> = {
      RECEIVED: "bg-slate-100 text-slate-700", WASH: "bg-blue-100 text-blue-700",
      DRY: "bg-cyan-100 text-cyan-700", DRYCLEAN: "bg-purple-100 text-purple-700",
      IRON: "bg-orange-100 text-orange-700", FOLD: "bg-green-100 text-green-700",
      QC: "bg-amber-100 text-amber-700", PACKED: "bg-teal-100 text-teal-700",
      DISPATCHED: "bg-indigo-100 text-indigo-700", DELIVERED: "bg-emerald-100 text-emerald-700",
    }
    return map[stage] || "bg-slate-100 text-slate-600"
  }

  const toLabel = (): LabelData | null => {
    if (!result) return null
    return {
      itemNumber: result.item.itemNumber || garCode(result) || "",
      garment: result.item.garmentName,
      service: result.item.serviceName,
      garScanCode: garCode(result),
      orderNumber: result.order.orderNumber,
      storeName: result.store?.storeName,
    }
  }

  const printOne = async () => {
    const ld = toLabel(); if (!ld) return
    await printLabels([ld], cfg, true)
  }

  const previewOne = async () => {
    const ld = toLabel(); if (!ld) return
    await printLabels([ld], cfg, false)
  }

  const copyToClipboard = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: `Copied ${label}`, description: text }) } catch { toast({ title: "Failed to copy", variant: "destructive" }) }
  }

  const reprintBarcode = async () => {
    if (!result) return
    try {
      await fetch(`/api/laundry/items/${result.item.id}/barcode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REPRINT", actorName: user?.name }) })
      toast({ title: "Barcode reprinted" })
    } catch { toast({ title: "Reprint failed", variant: "destructive" }) }
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      {cameraOpen && <CameraScanner onDetected={(c) => { setCameraOpen(false); handleScanDetect(c) }} onClose={() => setCameraOpen(false)} />}

      {/* Scanner-mode overlay bar */}
      {scanMode && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 -mx-1">
          <ScanLine className="h-5 w-5 text-blue-600 shrink-0" />
          <input
            ref={scanInputRef}
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-blue-900 placeholder:text-blue-400"
            placeholder="Scan a barcode..."
            onKeyDown={handleScanInput}
          />
          <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-100 text-[10px]">Scan Mode</Badge>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600" onClick={() => setScanMode(false)}>Stop</Button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" /> Garment Lookup
          </h1>
          <p className="text-sm text-slate-500">Search by GAR, ITM, Order Number, or Customer</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="scan-mode" className="text-xs text-slate-500 cursor-pointer">Scan Mode</Label>
            <Switch id="scan-mode" checked={scanMode} onCheckedChange={setScanMode} />
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCameraOpen(true)}>
            <Camera className="h-4 w-4" /> Scan
          </Button>
        </div>
      </div>

      {/* Manual search input (hidden in scan mode) */}
      {!scanMode && (
        <div className="flex items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 h-11 font-mono"
              placeholder="GAR000000000031, ITM-ORD-..., order number, or customer phone"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button className="h-11 gap-2" onClick={submitSearch} disabled={loading || !code.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Lookup
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Looking up garment…</div>
      )}

      {!loading && searched && !result && (
        <Card className="rounded-xl border-slate-200 bg-slate-50">
          <CardContent className="p-12 text-center">
            <XCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No garment found</p>
            <p className="text-xs text-slate-400 mt-1">Try scanning the barcode or entering a different code</p>
          </CardContent>
        </Card>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={printOne}><Printer className="h-3.5 w-3.5" /> Print Label</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={previewOne}><BarcodeIcon className="h-3.5 w-3.5" /> Preview Label</Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={reprintBarcode}><Printer className="h-3.5 w-3.5" /> Reprint Barcode</Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => window.open(`/admin#laundryPage=order-detail&orderId=${result.order.id}`, "_blank")}><ExternalLink className="h-3.5 w-3.5" /> View Order</Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => copyToClipboard(garCode(result), "GAR")}><Copy className="h-3.5 w-3.5" /> Copy GAR</Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => copyToClipboard(result.item.itemNumber, "Item Number")}><Copy className="h-3.5 w-3.5" /> Copy ITM</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Garment Details */}
            <Card className="rounded-xl border-slate-200 shadow-sm lg:col-span-2">
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                  <BarcodeIcon className="h-[18px] w-[18px] text-blue-600" /> Garment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-3 bg-slate-50 rounded-lg">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-lg font-bold font-mono text-blue-700">{garCode(result)}</span>
                    <Barcode value={garCode(result)} height={44} />
                    <span className="text-[9px] font-mono text-slate-400">Barcode encodes: {garCode(result)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-slate-400 text-xs">Garment</span><p className="font-semibold text-slate-800">{result.item.garmentName}</p></div>
                  <div><span className="text-slate-400 text-xs">GAR Number</span><p className="font-mono font-bold text-blue-700 text-base">{garCode(result)}</p></div>
                  <div className="col-span-2"><span className="text-slate-400 text-xs">Item Number</span><p className="font-mono text-xs text-slate-500 break-all">{result.item.itemNumber}</p></div>
                  <div><span className="text-slate-400 text-xs">Service</span><p className="font-medium text-slate-800">{result.item.serviceName}</p></div>
                  <div><span className="text-slate-400 text-xs">Quantity</span><p className="font-medium text-slate-800">{result.item.quantity}</p></div>
                  <div>
                    <span className="text-slate-400 text-xs">Current Stage</span>
                    <p><Badge className={stageColor(result.item.processingStage)} variant="outline">{result.item.stageLabel || result.item.processingStage}</Badge></p>
                  </div>
                  <div><span className="text-slate-400 text-xs">Department</span><p className="text-slate-800">{result.currentDepartment || "—"}</p></div>
                  {result.item.condition && <div><span className="text-slate-400 text-xs">Condition</span><p className="text-slate-800">{result.item.condition}</p></div>}
                  {result.item.defects && <div className="col-span-2"><span className="text-slate-400 text-xs">Damage Notes</span><p className="text-amber-700 text-xs">{result.item.defects}</p></div>}
                  <div><span className="text-slate-400 text-xs">QC Failures</span><p className="font-medium">{result.item.qcFailCount > 0 ? <span className="text-red-600 font-bold">{result.item.qcFailCount}×</span> : "—"}</p></div>
                  <div><span className="text-slate-400 text-xs">Payment</span><p className="font-medium">{result.order.status === "PAID" ? <span className="text-emerald-600">Paid</span> : <span className="text-amber-600">{result.order.grandTotal > 0 ? `₹${result.order.grandTotal}` : "—"}</span>}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Sidebar cards */}
            <div className="space-y-4">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><User className="h-4 w-4 text-blue-500" /> Customer</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium text-slate-800">{result.customer?.name || "—"}</p>
                  {result.customer?.phone && <p className="font-mono text-xs text-slate-500">{result.customer.phone}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><MapPin className="h-4 w-4 text-blue-500" /> Store</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium text-slate-800">{result.store?.storeName || "—"}</p>
                  {result.store?.storeCode && <p className="font-mono text-xs text-slate-500">{result.store.storeCode}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><ShoppingBag className="h-4 w-4 text-blue-500" /> Order</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-mono font-bold text-slate-800">{result.order.orderNumber}</p>
                  <p><Badge variant="outline" className="text-[10px]">{result.order.status}</Badge></p>
                  {result.order.expectedDeliveryDate && <p className="text-xs text-slate-500">Expected: {new Date(result.order.expectedDeliveryDate).toLocaleDateString()}</p>}
                </CardContent>
              </Card>

              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-[13px] font-semibold text-slate-700 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-blue-500" /> Business</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <p className="font-medium text-slate-800">{result.business?.businessName || "—"}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Timeline / QC History */}
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2"><Clock className="h-4 w-4 text-blue-600" /> Timeline &amp; Processing History</CardTitle></CardHeader>
            <CardContent>
              {result.timeline.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No events recorded yet.</p>
              ) : (
                <div className="space-y-0 max-h-80 overflow-y-auto">
                  {result.timeline.map((ev) => (
                    <div key={ev.id} className="flex gap-3 py-2.5 border-b border-slate-50 last:border-0">
                      <div className="mt-0.5 shrink-0">
                        {ev.action === "QC_PASS" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                         ev.action === "QC_FAIL" ? <XCircle className="h-4 w-4 text-red-500" /> :
                         <div className="h-4 w-4 rounded-full bg-slate-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">{ev.action.replace(/_/g, " ")}</span>
                          {ev.department && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{ev.department}</Badge>}
                          {ev.actorName && <span className="text-[10px] text-slate-400">by {ev.actorName}</span>}
                        </div>
                        {ev.note && <p className="text-[11px] text-slate-500 mt-0.5">{ev.note}</p>}
                        {ev.fromStage && ev.toStage && <p className="text-[10px] text-slate-400 mt-0.5">{ev.fromStage} → {ev.toStage}</p>}
                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(ev.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
