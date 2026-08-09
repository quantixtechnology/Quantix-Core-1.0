"use client"

// SORTING workstation — the permanent garment→bag transition point.
//
// The operator scans every garment of an order (garment barcodes are still the
// tracking identity here). When the scanned set equals the order's expected
// count, ONE laundry bag is scanned and bound to the order (1 order = 1 bag).
// The server retires every garment barcode and advances every garment past
// Sorting — from that moment only the bag QR is valid (Iron / Fold / Transit).
//
// This workstation NEVER accepts garment barcodes after the bag is assigned,
// and it NEVER assigns a bag before every garment has been scanned (both are
// enforced server-side in /api/laundry/processing/sorting).
import { useCallback, useEffect, useRef, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useToast } from "@/hooks/use-toast"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ScanLine, PackageCheck, RefreshCw, Check, Layers } from "lucide-react"
import { LaundryBarcodeScanner } from "@/components/laundry/laundry-barcode-scanner"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  garmentName: string; serviceName: string | null; quantity: number
  orderId: string; orderNumber: string | null; customer: string | null
}

interface OrderGroup { orderId: string; orderNumber: string; expected: number; customer: string | null; garments: Item[] }

export function LaundrySortingWorkstation() {
  const { currentBusinessId, user } = useAuthStore()
  const { toast } = useToast()
  const [orders, setOrders] = useState<OrderGroup[]>([])
  const [scanned, setScanned] = useState<Record<string, string[]>>({}) // orderId → scanned item ids
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [scanErr, setScanErr] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [offline, setOffline] = useState(false)
  const [bagTarget, setBagTarget] = useState<{ label: string; hint: string } | null>(null)

  const scanErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 })
  // Mirror of `scanned`, updated synchronously as each scan resolves.
  //
  // `scanned` is React state, so a render closure can still hold the previous
  // value when the next scan lands. A camera scan can't hit that (the scanner
  // closes after every detection, forcing a commit in between) but a USB /
  // keyboard-wedge scanner fires back-to-back, which is why the completion
  // count went wrong on desktop only. The ref is the counting source of truth;
  // the state is purely what we render.
  const scannedRef = useRef<Record<string, string[]>>({})

  const load = useCallback(async (silent = false) => {
    if (!currentBusinessId) return
    if (!silent) setLoading(true)
    try {
      const j = await fetch(`/api/laundry/processing?businessId=${encodeURIComponent(currentBusinessId)}&stage=SORTING`).then((r) => r.json())
      if (j.soundEnabled !== undefined) setSoundEnabled(j.soundEnabled)
      const byOrder = new Map<string, OrderGroup>()
      for (const it of j.items || []) {
        const oid = it.orderId
        if (!oid) continue
        const g: OrderGroup = byOrder.get(oid) || { orderId: oid, orderNumber: it.orderNumber || "", expected: 0, customer: it.customer || null, garments: [] }
        g.expected++
        g.garments.push(it)
        byOrder.set(oid, g)
      }
      setOrders([...byOrder.values()])
    } catch {
      setOffline(true)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [currentBusinessId])

  useEffect(() => { load(false) }, [load])
  useAutoRefresh(() => load(true), { intervalMs: 12000 })

  // Workspace Scan Mode → the bag target label for the assignment prompt.
  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/processing/finishing-bag?businessId=${encodeURIComponent(currentBusinessId)}`)
      .then((r) => r.json()).then((j) => {
        if (j.success && j.data?.target) setBagTarget({ label: j.data.target.label, hint: j.data.target.hint || "" })
      }).catch(() => setBagTarget({ label: "Scan container", hint: "" }))
  }, [currentBusinessId])

  const scannedFor = (orderId: string) => scanned[orderId] || []
  const readyOrders = orders.filter((o) => scannedFor(o.orderId).length >= o.expected)

  const handleGarmentScan = useCallback(async (code: string) => {
    setScanErr(null)
    if (scanErrTimer.current) clearTimeout(scanErrTimer.current)
    setOffline(false)

    const norm = code.trim().toUpperCase()
    const now = Date.now()
    if (norm && norm === lastScan.current.code && now - lastScan.current.at < 3500) {
      playScanError(soundEnabled)
      setScanErr("Same garment scanned again — ignored. Wait a moment.")
      scanErrTimer.current = setTimeout(() => setScanErr(null), 3000)
      return
    }
    lastScan.current = { code: norm, at: now }

    const showErr = (msg: string, ms = 4000) => {
      playScanError(soundEnabled); setScanErr(msg); scanErrTimer.current = setTimeout(() => setScanErr(null), ms)
    }

    let j: { success?: boolean; data?: { itemId: string; garmentName: string; orderId: string; orderNumber: string; expected: number }; error?: string }
    try {
      j = await fetch("/api/laundry/processing/sorting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, action: "scan", code }),
      }).then((r) => r.json())
    } catch {
      setOffline(true); showErr("Unable to reach the server. Check your connection and scan again.", 5000); return
    }
    if (!j.success || !j.data) { showErr(j.error || "Garment not found"); return }

    const d = j.data
    const already = (scannedRef.current[d.orderId] || []).includes(d.itemId)
    if (already) { showErr(`"${d.garmentName}" is already scanned for ${d.orderNumber}.`); return }

    const list = [...(scannedRef.current[d.orderId] || []), d.itemId]
    scannedRef.current = { ...scannedRef.current, [d.orderId]: list }
    setScanned(scannedRef.current)
    const scannedCount = list.length
    if (scannedCount >= d.expected) {
      playScanOk(soundEnabled)
      toast({ title: "Order complete", description: `${d.orderNumber} — all ${d.expected} garments scanned. Scan the ${bagTarget?.label?.replace(/^Scan /, "") || "bag"} to bind this order.`, duration: 4000 })
    } else {
      playScanOk(soundEnabled)
      toast({ title: `Scanned ${scannedCount} / ${d.expected}`, description: `${d.garmentName} → ${d.orderNumber}`, duration: 1500 })
    }
  }, [currentBusinessId, soundEnabled, bagTarget, toast])

  // Bound to the order whose card was used, so every ready order can be bagged
  // (and in any order) rather than only the most recently completed one.
  const handleAssignBag = useCallback(async (code: string, order: { orderId: string; orderNumber: string }) => {
    setBusy(true); setScanErr(null); setOffline(false)
    try {
      const res = await fetch("/api/laundry/processing/sorting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: currentBusinessId, action: "assign_bag", code,
          orderId: order.orderId, scanned: scannedRef.current[order.orderId] || [],
          actorName: user?.name || "operator",
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) { playScanError(soundEnabled); setScanErr(j.error || "Could not assign the bag."); return }
      playScanOk(soundEnabled)
      const label = bagTarget?.label?.replace(/^Scan /, "") || "container"
      toast({ title: "Sorting complete — bag bound", description: `Order ${order.orderNumber} → ${label} ${code}; ${j.data?.retired || 0} garment barcodes retired.`, duration: 3500 })
      const next = { ...scannedRef.current }; delete next[order.orderId]
      scannedRef.current = next; setScanned(next)
      load(true)
    } catch {
      setOffline(true); setScanErr("Unable to reach the server. Try again.")
    } finally { setBusy(false) }
  }, [currentBusinessId, user, bagTarget, soundEnabled, toast, load])

  const totalScanned = Object.values(scanned).reduce((n, l) => n + l.length, 0)
  const totalGarments = orders.reduce((n, o) => n + o.expected, 0)

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" /> Sorting
            <Badge className="border-indigo-300 text-indigo-700 bg-indigo-50 text-[10px] font-semibold">GARMENT → BAG TRANSITION</Badge>
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50"><ScanLine className="h-3 w-3 mr-1" /> {totalScanned} / {totalGarments} scanned</Badge>
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50"><PackageCheck className="h-3 w-3 mr-1" /> {readyOrders.length} ready for bag</Badge>
          </div>
        </div>

        <Card className="rounded-xl border-indigo-200 bg-indigo-50/40 shadow-sm">
          <CardContent className="p-4">
            <LaundryBarcodeScanner onDetect={handleGarmentScan} departmentLabel="Sorting" />
            {offline && <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Unable to reach the server. Check your connection.</div>}
            {scanErr && !offline && <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanErr}</div>}
            <p className="mt-2 text-[11px] text-slate-500">Scan every garment of the order. When the scanned count equals the order, scan ONE {bagTarget?.label?.replace(/^Scan /, "") || "bag"} to bind it — every garment barcode is then retired and only the bag QR is used from here on.</p>
          </CardContent>
        </Card>
      </div>

      {loading && !orders.length ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <div className="px-4 lg:px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <Card className="rounded-xl border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                <ScanLine className="h-[18px] w-[18px] text-blue-600" /> Orders at Sorting
                <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{orders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No orders are ready for Sorting.</p>
              ) : orders.map((o) => {
                const done = scannedFor(o.orderId).length
                const complete = done >= o.expected
                return (
                  <div key={o.orderId} className={`rounded-lg border p-3 ${complete ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 font-mono">{o.orderNumber}</p>
                        <p className="text-[11px] text-slate-400">{o.customer || "—"} · {o.garments.length} garment{o.garments.length === 1 ? "" : "s"}</p>
                      </div>
                      <Badge variant={complete ? "default" : "outline"} className={complete ? "bg-emerald-600 border-emerald-600 text-white text-[10px]" : "border-indigo-300 text-indigo-700 bg-indigo-50 text-[10px]"}>
                        {done} / {o.expected} scanned
                      </Badge>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, (done / o.expected) * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {o.garments.slice(0, 12).map((g) => (
                        <span key={g.id} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${scannedFor(o.orderId).includes(g.id) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {scannedFor(o.orderId).includes(g.id) && <Check className="h-3 w-3" />}
                          {g.garmentName}
                        </span>
                      ))}
                      {o.expected > 12 && <span className="text-[10px] text-slate-400">+{o.expected - 12} more</span>}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-emerald-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                <PackageCheck className="h-[18px] w-[18px] text-emerald-600" /> Bind the Bag (1 order = 1 bag)
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{readyOrders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {readyOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Scan every garment of an order first — the bag unlock appears here when the scanned count matches.</p>
              ) : readyOrders.map((o) => (
                <div key={o.orderId} className="rounded-lg border border-emerald-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800 font-mono">{o.orderNumber}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">All {o.expected} garments scanned. Scan ONE {bagTarget?.label?.replace(/^Scan /, "") || "bag"} to bind the whole order{bagTarget?.hint ? <span className="font-mono"> ({bagTarget.hint})</span> : null}.</p>
                  <div className="mt-2">
                    {/* Enabled by the same `readyOrders` membership that renders
                        this card — one source of truth, so a card can never
                        appear with a dead button. */}
                    <BagScanButton
                      onScan={(code) => handleAssignBag(code, o)}
                      label={bagTarget?.label || "Scan bag"}
                      closeOnScan={false}
                      disabled={busy}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Assigning retires every garment barcode and advances the order to Ironing / Folding / Transit.</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!loading && readyOrders.length === 0 && (
        <div className="px-4 lg:px-6 pb-4 -mt-2">
          <Button size="sm" variant="outline" className="gap-1 text-slate-500" onClick={() => load(true)}><RefreshCw className="h-3.5 w-3.5" /> Refresh queue</Button>
        </div>
      )}
    </div>
  )
}
