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
import { OrderBagList, useOrderBags } from "@/components/laundry/order-bag-list"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"
import { useGarmentSearch } from "@/hooks/use-garment-search"
import { GarmentSearchResults } from "@/components/laundry/garment-search-results"
import { Search, X, MapPin, History } from "lucide-react"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  garmentName: string; serviceName: string | null; quantity: number
  orderId: string; orderNumber: string | null; customer: string | null
}

interface OrderGroup { orderId: string; orderNumber: string; expected: number; customer: string | null; garments: Item[] }

/**
 * A scan the operator just made — a NAVIGATION AID, not business data.
 *
 * It is derived entirely from the scan response the server already returns plus
 * the order already on screen, so it costs no extra request and never becomes a
 * second source of truth about what has been scanned: `scannedRef` remains the
 * only thing that counts. Nothing here is persisted; the workstation's own
 * event trail is untouched.
 */
interface ScanRecord {
  itemId: string
  garmentName: string
  gar: string
  serviceId: string | null
  serviceName: string | null
  /** The order's Sorting bag at the moment of the scan, if one was assigned. */
  bagNumber: string | null
  orderId: string
  orderNumber: string
  customer: string | null
  scannedCount: number
  expected: number
  at: number
}

const RECENT_LIMIT = 8

/** One order card's bag list — its own hook instance, its own refresh. */
function SortingOrderBags({ orderId, businessId, busy }: { orderId: string; businessId: string; busy: boolean }) {
  const { bags, loadBags } = useOrderBags(orderId, businessId)
  return <OrderBagList orderId={orderId} businessId={businessId} bags={bags} onChanged={loadBags} disabled={busy} />
}

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
  // ── Navigation aids. None of these are written by load(), so the 12s poll can
  // never erase the last scan, the history or the highlight.
  const [lastScanned, setLastScanned] = useState<ScanRecord | null>(null)
  const [recent, setRecent] = useState<ScanRecord[]>([])
  const [highlight, setHighlight] = useState<{ orderId: string; itemId: string | null } | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Order card nodes, so a located order can be scrolled to WITHOUT reordering
  // the list — the operator's queue stays exactly where it was.
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  // orderId → its Sorting bag numbers, READ FROM THE SERVER's persisted
  // assignment (LaundryBagAssignment via /orders/[id]/bags). This is a cache of
  // that relationship, never a second source of truth: it is re-read after every
  // scan and after every assignment, so a refresh, a poll, or another operator's
  // assignment all converge on the same answer.
  const [bagsByOrder, setBagsByOrder] = useState<Record<string, string[]>>({})
  // The order whose first garment was just scanned and which still has no bag.
  // Per-order and advisory: the scanner is NEVER gated on it, so another order
  // can be scanned freely while this one waits for its bag.
  const [bagNeededFor, setBagNeededFor] = useState<ScanRecord | null>(null)

  /** Re-read one order's bags from the authoritative list. */
  const refreshBags = useCallback(async (orderId: string): Promise<string[]> => {
    if (!currentBusinessId) return []
    try {
      const j = await fetch(`/api/laundry/orders/${orderId}/bags?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      const nums: string[] = j?.success ? (j.data.bags || []).map((b: { bagNumber: string }) => b.bagNumber) : []
      setBagsByOrder((prev) => ({ ...prev, [orderId]: nums }))
      return nums
    } catch { return [] }
  }, [currentBusinessId])
  // The same race-safe search the processing workstations use: generation-
  // guarded, aborts superseded requests, and independent of the queue poll.
  const { query: search, setQuery: setSearch, clear: clearSearch, active: searching, results: searchResults, loading: searchLoading, error: searchError, truncated: searchTruncated } = useGarmentSearch(currentBusinessId)

  /** Bring an order into view and flag it — presentation only, no state change. */
  const locate = useCallback((orderId: string, itemId: string | null) => {
    setHighlight({ orderId, itemId })
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    // The flag fades; the order list itself is never touched.
    highlightTimer.current = setTimeout(() => setHighlight(null), 6000)
    const node = cardRefs.current.get(orderId)
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [])

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

  /**
   * Bind the order's Sorting bag from its first garment.
   *
   * Goes through the SAME persisted endpoint Packing and the order Bags panel
   * use (/orders/[id]/bags → addBagToOrder → assignBagToOrder), so the
   * relationship survives a refresh, a poll and another operator, and is filed
   * against the GARMENT's own service on a multi-service order.
   *
   * This is NOT the terminal Sorting binding. That still happens only when every
   * garment is scanned, still via action "assign_bag", and still retires the
   * barcodes — and it accepts a bag already sitting on the same order, so
   * pre-assigning here cannot block completion.
   */
  const assignOrderBag = useCallback(async (code: string, rec: ScanRecord): Promise<boolean> => {
    if (!currentBusinessId) return false
    try {
      const res = await fetch(`/api/laundry/orders/${rec.orderId}/bags`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, code, serviceId: rec.serviceId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        // Wrong bag: the engine names the order actually holding it, and the
        // standing assignment is left exactly as it was.
        playScanError(soundEnabled)
        setScanErr(j.error || "Could not assign that bag.")
        if (scanErrTimer.current) clearTimeout(scanErrTimer.current)
        scanErrTimer.current = setTimeout(() => setScanErr(null), 6000)
        return false
      }
      playScanOk(soundEnabled)
      const nums = await refreshBags(rec.orderId)
      const bagNumber = nums[0] ?? code
      setBagNeededFor(null)
      // Reflect the bag on what is already on screen, without re-querying.
      setLastScanned((p) => (p && p.orderId === rec.orderId ? { ...p, bagNumber } : p))
      setRecent((p) => p.map((r) => (r.orderId === rec.orderId && !r.bagNumber ? { ...r, bagNumber } : r)))
      toast({ title: `Bag ${bagNumber}`, description: `Assigned to ${rec.orderNumber}`, duration: 2500 })
      return true
    } catch {
      setOffline(true); setScanErr("Unable to reach the server. Try again.")
      return false
    }
  }, [currentBusinessId, soundEnabled, refreshBags, toast])

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

    let j: { success?: boolean; data?: { itemId: string; garmentName: string; serviceId?: string | null; serviceName?: string | null; barcode?: string | null; orderId: string; orderNumber: string; expected: number }; error?: string }
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

    // ── Say WHAT was scanned and WHERE it belongs, immediately ──────────────
    // Built from the scan response the server already returns plus the order
    // already on screen — no extra request, and the garment's OWN service, never
    // the order's first service.
    const group = orders.find((o) => o.orderId === d.orderId)
    // WHICH BAG does this order already have? Read from the persisted
    // assignment, not remembered locally — so it is right after a refresh and
    // right when another operator assigned it.
    const known = bagsByOrder[d.orderId]
    const bags = known ?? (await refreshBags(d.orderId))

    const record: ScanRecord = {
      itemId: d.itemId,
      garmentName: d.garmentName,
      gar: d.barcode || group?.garments.find((g) => g.id === d.itemId)?.barcode || "",
      serviceId: d.serviceId ?? null,
      serviceName: d.serviceName ?? group?.garments.find((g) => g.id === d.itemId)?.serviceName ?? null,
      orderId: d.orderId,
      orderNumber: d.orderNumber,
      customer: group?.customer ?? null,
      bagNumber: bags[0] ?? null,
      scannedCount,
      expected: d.expected,
      at: Date.now(),
    }
    setLastScanned(record)
    setRecent((prev) => [record, ...prev.filter((r) => r.itemId !== record.itemId)].slice(0, RECENT_LIMIT))
    locate(d.orderId, d.itemId)
    // Ask for the bag ONLY when this order has none. Every later garment of the
    // same order finds one and scans straight through. This never gates the
    // scanner — a garment from any other order scans normally while this sits.
    setBagNeededFor(bags.length === 0 ? record : null)

    if (scannedCount >= d.expected) {
      playScanOk(soundEnabled)
      toast({ title: "Order complete", description: `${d.orderNumber} — all ${d.expected} garments scanned. Scan the ${bagTarget?.label?.replace(/^Scan /, "") || "bag"} to bind this order.`, duration: 4000 })
    } else {
      playScanOk(soundEnabled)
      toast({ title: `Scanned ${scannedCount} / ${d.expected}`, description: `${d.garmentName} → ${d.orderNumber}`, duration: 1500 })
    }
  }, [currentBusinessId, soundEnabled, bagTarget, toast, orders, locate, bagsByOrder, refreshBags])

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
      // Reported to the scanner dialog: false keeps it open for a retry.
      if (!res.ok || !j.success) { playScanError(soundEnabled); setScanErr(j.error || "Could not assign the bag."); return false }
      playScanOk(soundEnabled)
      const label = bagTarget?.label?.replace(/^Scan /, "") || "container"
      toast({ title: "Sorting complete — bag bound", description: `Order ${order.orderNumber} → ${label} ${code}; ${j.data?.retired || 0} garment barcodes retired.`, duration: 3500 })
      const next = { ...scannedRef.current }; delete next[order.orderId]
      scannedRef.current = next; setScanned(next)
      load(true)
      return true
    } catch {
      setOffline(true); setScanErr("Unable to reach the server. Try again.")
      return false
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

        {/* WHAT DID I JUST SCAN, AND WHERE DOES IT BELONG.
            Written only by a successful scan; load() never touches it, so the
            12s poll cannot wipe it mid-shift. */}
        {lastScanned && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Last scanned</span>
            <span className="text-sm font-semibold text-slate-800">{lastScanned.garmentName}</span>
            <span className="font-mono text-[11px] text-slate-500">{lastScanned.gar || "—"}</span>
            <span className="text-[11px] text-slate-600">{lastScanned.customer || "—"}</span>
            <span className="text-[11px] text-slate-600">{lastScanned.serviceName || "—"}</span>
            <span className="font-mono text-[11px] text-slate-700">{lastScanned.orderNumber}</span>
            {lastScanned.bagNumber && <span className="font-mono text-[11px] font-semibold text-indigo-700">BAG {lastScanned.bagNumber}</span>}
            <span className="text-[12px] font-bold tabular-nums text-emerald-700">{lastScanned.scannedCount} / {lastScanned.expected} scanned</span>
            <button type="button" onClick={() => locate(lastScanned.orderId, lastScanned.itemId)} className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <MapPin className="h-3.5 w-3.5" /> Show order
            </button>
            {lastScanned.scannedCount >= lastScanned.expected && (
              <p className="w-full text-[11px] font-semibold text-emerald-800">
                ✓ Order complete — {lastScanned.expected} / {lastScanned.expected} garments{lastScanned.bagNumber ? ` · BAG ${lastScanned.bagNumber}` : ""} · ready for the bag step below.
              </p>
            )}
          </div>
        )}

        {/* BAG REQUIRED — only for an order that has none yet. Advisory: the
            scanner is never gated on this, so a garment from any other order
            scans straight through while this one waits. */}
        {bagNeededFor && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Bag required</span>
            <span className="font-mono text-[12px] font-semibold text-slate-800">{bagNeededFor.orderNumber}</span>
            <span className="text-[11px] text-slate-600">{bagNeededFor.customer || "—"} · {bagNeededFor.serviceName || "—"}</span>
            <span className="text-[11px] tabular-nums text-slate-600">{bagNeededFor.scannedCount} / {bagNeededFor.expected} scanned</span>
            <div className="ml-auto flex items-center gap-2">
              <BagScanButton
                label={bagTarget?.label || "Scan Bag QR"}
                size="sm"
                closeOnScan
                disabled={busy}
                onScan={(code) => assignOrderBag(code, bagNeededFor)}
              />
              <button type="button" onClick={() => setBagNeededFor(null)} className="text-[11px] text-slate-500 underline">Later</button>
            </div>
            <p className="w-full text-[10px] text-amber-800">Scanning continues normally — other orders are not blocked.</p>
          </div>
        )}

        {/* Find any garment — global, so a code that is NOT at Sorting reports
            where it actually is instead of "not found". */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find any garment by GAR / ITM / barcode, name or order no…"
            className="w-full h-10 rounded-lg border border-slate-200 bg-white pl-9 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {searchLoading && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-500" />}
          {search && <button onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>}
        </div>
        {searching && (
          <GarmentSearchResults
            query={search} results={searchResults} loading={searchLoading}
            error={searchError} truncated={searchTruncated} stages={["SORTING"]}
            canReturn={false} busy={busy}
            onReturn={() => { /* Sorting has no return-to-queue action */ }}
            onLocate={(hit) => locate(hit.orderId, hit.id)}
          />
        )}

        {/* The last few scans, so the operator can step back to any of them. */}
        {recent.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1"><History className="h-3 w-3" /> Recent scans</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r.itemId}
                  type="button"
                  onClick={() => locate(r.orderId, r.itemId)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] hover:border-indigo-300"
                  title={`${r.garmentName} · ${r.serviceName || "—"} · ${r.orderNumber}`}
                >
                  <span className="font-medium text-slate-700">{r.garmentName}</span>
                  <span className="font-mono text-slate-400">{r.gar || "—"}</span>
                  <span className="font-mono text-slate-500">{r.orderNumber}</span>
                  {r.bagNumber && <span className="font-mono text-indigo-700">BAG {r.bagNumber}</span>}
                  <span className="tabular-nums text-indigo-600">{r.scannedCount}/{r.expected}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
                  <div
                    key={o.orderId}
                    // Registered so a located order can be scrolled to. The list
                    // itself is never reordered — the operator's position holds.
                    ref={(el) => { if (el) cardRefs.current.set(o.orderId, el); else cardRefs.current.delete(o.orderId) }}
                    className={`rounded-lg border p-3 transition-shadow ${highlight?.orderId === o.orderId ? "border-indigo-400 ring-2 ring-indigo-300 bg-indigo-50/40" : complete ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"}`}
                  >
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
                      {/* The chip list is capped at 12 for density. When a
                          garment on this order is the one being located, show
                          the whole set so it cannot be hidden behind "+N more". */}
                      {(highlight?.orderId === o.orderId ? o.garments : o.garments.slice(0, 12)).map((g) => {
                        const isScanned = scannedFor(o.orderId).includes(g.id)
                        const isJust = highlight?.itemId === g.id
                        return (
                          <span
                            key={g.id}
                            title={g.serviceName || undefined}
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${isJust ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : isScanned ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                          >
                            {isScanned && !isJust && <Check className="h-3 w-3" />}
                            {g.garmentName}
                            {/* Presentation only — the garment's status is untouched. */}
                            {isJust && <span className="ml-0.5 font-semibold">✓ JUST SCANNED</span>}
                          </span>
                        )
                      })}
                      {highlight?.orderId !== o.orderId && o.expected > 12 && <span className="text-[10px] text-slate-400">+{o.expected - 12} more</span>}
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
                  <div className="mt-2 space-y-2">
                    {/* Enabled by the same `readyOrders` membership that renders
                        this card — one source of truth, so a card can never
                        appear with a dead button. */}
                    <BagScanButton
                      onScan={(code) => handleAssignBag(code, o)}
                      label={bagTarget?.label || "Scan bag"}
                      // Closes only when the assignment SUCCEEDS; a rejected bag
                      // keeps the dialog open so the operator can rescan.
                      closeOnScan
                      disabled={busy}
                    />
                    {/* ONE ORDER → ONE OR MORE BAGS. The same shared list Packing
                        reads, so both stages see one bag set (§13). */}
                    <SortingOrderBags orderId={o.orderId} businessId={currentBusinessId || ""} busy={busy} />
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
