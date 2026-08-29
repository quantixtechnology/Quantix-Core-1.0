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
import { Search, X, MapPin, History, Plus } from "lucide-react"
import { activeBagForService, sortingBagViews, otherBagsOnOrder, type SortingBagRow, type SortingBagView } from "@/lib/laundry-sorting-bags"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  garmentName: string; serviceName: string | null; serviceId?: string | null; quantity: number
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
  /** ISO timestamp of the persisted scan — the server's own, so client and
   *  server order the history identically. */
  at: string
}

/**
 * Where a scanned bag is going: one order, one service.
 *
 * Both the first-garment prompt and "+ Add New Bag" produce one of these, so a
 * second bag is filed against exactly the same order+service as the first and
 * goes through the same single writer.
 */
interface BagTarget {
  orderId: string
  orderNumber: string
  serviceId: string | null
  serviceName: string | null
  customer: string | null
}

/** A bag just bound to an order — the confirmation line, not a stored record. */
interface BagAssigned {
  bagNumber: string
  orderNumber: string
  customer: string | null
  serviceName: string | null
}

/**
 * A refused bag, in fields rather than in a sentence.
 *
 * The operator needs three separate facts to recover: the bag they scanned, the
 * order that is holding it, and the bag THIS order needs. `expected` is null
 * when the order genuinely has no bag yet — there is nothing to name, and
 * inventing one would be worse than saying nothing.
 */
interface WrongBag {
  scanned: string
  heldBy: string | null
  orderNumber: string
  expected: string | null
  message: string
}

/** LAST 5 SCANS — five is what an operator can actually read at a glance. */
const RECENT_LIMIT = 5

/**
 * The bags of ONE order, grouped by service.
 *
 * Everything here is derived from the assignment rows the order already has:
 * the newest bag of a service is ACTIVE and takes the next garment, the earlier
 * ones are FULL, and each bag's garment count comes from which bag was active
 * when each garment was scanned. Nothing is stored twice and nothing is marked
 * full automatically — adding a bag is the operator's explicit act, and it is
 * what makes the previous one full.
 */
/** The services actually present on an order's garments — so a two-service
 *  order gets two bag tracks, and neither can borrow the other's bag. */
function servicesOnOrder(order: OrderGroup): { id: string | null; name: string | null; itemIds: string[] }[] {
  const services: { id: string | null; name: string | null; itemIds: string[] }[] = []
  for (const g of order.garments) {
    const id = g.serviceId ?? null
    const name = g.serviceName ?? null
    const key = (id || "") + "|" + (name || "")
    let row = services.find((s2) => (s2.id || "") + "|" + (s2.name || "") === key)
    if (!row) { row = { id, name, itemIds: [] }; services.push(row) }
    row.itemIds.push(g.id)
  }
  return services
}

function OrderBags({ order, bags, scanTimes, onAdd }: {
  order: OrderGroup
  bags: SortingBagRow[]
  scanTimes: Record<string, string>
  onAdd: (serviceId: string | null, serviceName: string | null) => void
}) {
  const services = servicesOnOrder(order)

  const others = otherBagsOnOrder(bags)

  return (
    <div className="mt-2 space-y-1.5">
      {services.map((svc) => {
        const views = sortingBagViews(bags, svc.id, svc.name, svc.itemIds.map((id) => scanTimes[id] ?? null).filter(Boolean))
        return (
          <div key={(svc.id || "") + (svc.name || "")} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{svc.name || "Service"}</span>
              {views.length === 0 && <span className="text-[10px] font-semibold text-amber-700">⚠ NO SORTING BAG YET</span>}
              {views.map((v) => (
                <span
                  key={v.bagNumber}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${v.state === "ACTIVE" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                  title={`Sorting bag ${v.index} — ${v.garments} garment${v.garments === 1 ? "" : "s"} sorted into it`}
                >
                  {/* "SORTING BAG n" and "IN USE", not "ACTIVE". ACTIVE reads as
                      a claim about where the bag physically is; this panel only
                      ever means "the bag these garments are being sorted into".
                      Physical custody is a separate fact, shown in Bag
                      Management, and the two must not look like one. */}
                  <span className="font-semibold">SORTING BAG {v.index}</span>
                  <span className="font-mono font-semibold">{v.bagNumber}</span>
                  <span className="tabular-nums">{v.garments}</span>
                  <span className="font-semibold">{v.state === "ACTIVE" ? "IN USE" : "FULL"}</span>
                </span>
              ))}
              <button
                type="button"
                onClick={() => onAdd(svc.id, svc.name)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-indigo-200 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
              >
                <Plus className="h-3 w-3" /> Add New Bag
              </button>
            </div>
          </div>
        )
      })}

      {/* THE ORDER'S OTHER BAGS — transport, delivery, or a role never recorded.
          Shown rather than hidden: the old screen did not omit these rows, it
          presented them as the Sorting bag. Naming them for what they are is
          the fix; removing them would just move the confusion. */}
      {others.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50/60 px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Other bags on this order</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {others.map((b) => (
              <span key={b.bagNumber} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                <span className="font-mono font-semibold">{b.bagNumber}</span>
                <span>{b.purpose === "PICKUP" ? "pickup bag" : b.purpose === "DELIVERY" ? "delivery bag" : "role not recorded"}</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Not the Sorting bag. Where each one physically is now is shown in Bag Management.</p>
        </div>
      )}
    </div>
  )
}

/** CURRENT SORTING BAG — the one bag the NEXT garment goes into, made
 *  unmistakable at the top of the order card.
 *
 *  No garment-count capacity and no automatic closing: full/closed is the
 *  operator's own act (+ Add New Bag). While the operator is closing the
 *  current bag, the banner demands the next available bag; after the new bag
 *  is assigned, every later garment points at it. A service with no bag yet
 *  reads BAG REQUIRED. */
function CurrentBagBanner({ order, bags, addBagFor }: {
  order: OrderGroup
  bags: SortingBagRow[]
  addBagFor: { orderId: string; orderNumber: string; serviceId: string | null; serviceName: string | null } | null
}) {
  const services = servicesOnOrder(order)
  const many = services.length > 1
  return (
    <div className="mt-2 space-y-1.5">
      {services.map((svc) => {
        const key = (svc.id || "") + "|" + (svc.name || "")
        const label = many ? svc.name || "Service" : null
        const closingThis = addBagFor?.orderId === order.orderId &&
          (addBagFor.serviceId || "") + "|" + (addBagFor.serviceName || "") === key
        const active = activeBagForService(bags, svc.id, svc.name)
        if (closingThis && active) {
          return (
            <div key={key} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg border-2 border-orange-300 bg-orange-500 px-3 py-2 text-white">
              {label && <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</span>}
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Current bag full/closed</span>
              <span className="font-mono text-sm font-bold text-white">{active.bagNumber}</span>
              <span className="text-[11px] font-semibold text-white">SCAN NEXT AVAILABLE BAG</span>
            </div>
          )
        }
        if (active) {
          return (
            <div key={key} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg border-2 border-indigo-300 bg-indigo-600 px-3 py-2 text-white">
              {label && <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">{label}</span>}
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-100">Current sorting bag</span>
              <span className="font-mono text-base font-bold text-white">{active.bagNumber}</span>
              <span className="text-[11px] font-semibold text-indigo-100">ADD GARMENTS TO THIS BAG</span>
            </div>
          )
        }
        return (
          <div key={key} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg border-2 border-amber-300 bg-amber-500 px-3 py-2 text-white">
            {label && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">{label}</span>}
            <span className="text-[13px] font-bold uppercase tracking-wider text-white">⚠ BAG REQUIRED</span>
            <span className="text-[11px] font-semibold text-amber-100">SCAN THE BAG THIS ORDER WILL USE</span>
          </div>
        )
      })}
    </div>
  )
}

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
  const [bagsByOrder, setBagsByOrder] = useState<Record<string, SortingBagRow[]>>({})
  // The order whose first garment was just scanned and which still has no bag.
  // Per-order and advisory: the scanner is NEVER gated on it, so another order
  // can be scanned freely while this one waits for its bag.
  const [bagNeededFor, setBagNeededFor] = useState<ScanRecord | null>(null)
  // The bag just bound to an order — the operator's confirmation that the scan
  // landed. Presentation only; the assignment itself lives in the database.
  const [bagAssigned, setBagAssigned] = useState<BagAssigned | null>(null)
  const bagAssignedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A refused bag, laid out as fields: what was scanned, who holds it, what this
  // order needs. Both sides come from the server's refusal, never from a cache.
  const [wrongBag, setWrongBag] = useState<WrongBag | null>(null)
  const wrongBagTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The bag code typed (or wedge-scanned) into the inline field on the prompt.
  const [bagCode, setBagCode] = useState("")
  // Mirror of `bagsByOrder`, written synchronously. A USB wedge fires scans
  // back-to-back, so the render closure can still hold the previous map when the
  // next scan resolves — the same reason `scannedRef` exists.
  const bagsRef = useRef<Record<string, SortingBagRow[]>>({})
  // The generation of the most recently STARTED garment scan. Only the newest
  // may write the panel, so a slow response can never overwrite a newer scan.
  const scanGen = useRef(0)
  // itemId → when it was scanned, from the persisted trail. Each garment is
  // attributed to the bag that was active AT THAT MOMENT, which is what keeps
  // garments 1-15 in bag 1 after bag 2 is added.
  const [scanTimes, setScanTimes] = useState<Record<string, string>>({})
  // The order whose bag panel is open for adding another bag.
  const [addBagFor, setAddBagFor] = useState<{ orderId: string; orderNumber: string; serviceId: string | null; serviceName: string | null } | null>(null)

  /** Re-read one order's bags from the authoritative list. */
  const refreshBags = useCallback(async (orderId: string): Promise<SortingBagRow[]> => {
    if (!currentBusinessId) return []
    try {
      const j = await fetch(`/api/laundry/orders/${orderId}/bags?businessId=${encodeURIComponent(currentBusinessId)}`).then((r) => r.json())
      const rows: SortingBagRow[] = j?.success ? (j.data.bags || []) : []
      bagsRef.current = { ...bagsRef.current, [orderId]: rows }
      setBagsByOrder(bagsRef.current)
      return rows
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

      // ── REHYDRATE. Progress, history and bags all come back from persisted
      // records, so a refresh, a new tab, another device or another operator
      // show the same state. This is why a reload no longer reads 0 / 27.
      //
      // The server's answer is MERGED with anything scanned locally since the
      // request went out, never allowed to replace it: a poll that started
      // before the last scan must not un-scan a garment on screen.
      const h = await fetch(`/api/laundry/processing/sorting?businessId=${encodeURIComponent(currentBusinessId)}&recent=${RECENT_LIMIT}`).then((r) => r.json())
      if (h?.success) {
        const server: Record<string, string[]> = h.data.scanned || {}
        const merged: Record<string, string[]> = {}
        for (const oid of new Set([...Object.keys(server), ...Object.keys(scannedRef.current)])) {
          merged[oid] = [...new Set([...(server[oid] || []), ...(scannedRef.current[oid] || [])])]
        }
        scannedRef.current = merged
        setScanned(merged)
        bagsRef.current = { ...bagsRef.current, ...(h.data.bags || {}) }
        setBagsByOrder(bagsRef.current)
        setScanTimes((prev) => ({ ...prev, ...(h.data.scanTimes || {}) }))
        // History: the server's list, with anything newer than it kept on top.
        const rows: ScanRecord[] = h.data.recent || []
        setRecent((prev) => {
          const newest = rows.length ? Math.max(...rows.map((r) => new Date(r.at).getTime())) : 0
          const localOnly = prev.filter((r) => new Date(r.at).getTime() > newest)
          return [...localOnly, ...rows]
            .filter((r, i, all) => all.findIndex((x) => x.itemId === r.itemId) === i)
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, RECENT_LIMIT)
        })
      }
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
  const assignOrderBag = useCallback(async (code: string, rec: BagTarget): Promise<boolean> => {
    if (!currentBusinessId) return false
    const scanned = code.trim().toUpperCase()
    if (!scanned) return false
    try {
      const res = await fetch(`/api/laundry/orders/${rec.orderId}/bags`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // Sorting runs at the Processing Center, so the bag it binds is in the
        // plant's hands. Without this the bag would be recorded as being at the
        // store — a wrong location asserted, which is worse than none.
        body: JSON.stringify({ businessId: currentBusinessId, code: scanned, serviceId: rec.serviceId, custodian: "PROCESSING_CENTER", purpose: "SORTING" }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) {
        // WRONG BAG. Neither assignment is touched: the scanned bag stays with
        // whoever holds it, this order keeps whatever it had, and the garment
        // tally is not affected — a failed bag scan is not a garment scan.
        playScanError(soundEnabled)
        // Both halves come from the server's refusal — `conflict` names the
        // order holding the scanned bag, `bags` is this order's list read back
        // fresh, so a stale cache cannot make the message wrong.
        const fresh: SortingBagRow[] = Array.isArray(j?.bags) ? j.bags : (bagsRef.current[rec.orderId] ?? [])
        if (Array.isArray(j?.bags)) {
          bagsRef.current = { ...bagsRef.current, [rec.orderId]: fresh }
          setBagsByOrder(bagsRef.current)
        }
        setWrongBag({
          scanned: j?.conflict?.bagNumber || scanned,
          heldBy: j?.conflict?.heldByOrderNumber ?? null,
          orderNumber: rec.orderNumber,
          expected: activeBagForService(fresh, rec.serviceId, rec.serviceName)?.bagNumber ?? null,
          message: j?.error || "Could not assign that bag.",
        })
        if (wrongBagTimer.current) clearTimeout(wrongBagTimer.current)
        wrongBagTimer.current = setTimeout(() => setWrongBag(null), 10000)
        return false
      }
      playScanOk(soundEnabled)
      setWrongBag(null)
      const rows = await refreshBags(rec.orderId)
      const bagNumber = activeBagForService(rows, rec.serviceId, rec.serviceName)?.bagNumber ?? scanned
      setBagNeededFor(null)
      setAddBagFor(null)
      setBagCode("")
      // ✓ BAG ASSIGNED — confirmation of the physical fact, spelled out.
      setBagAssigned({ bagNumber, orderNumber: rec.orderNumber, customer: rec.customer, serviceName: rec.serviceName })
      if (bagAssignedTimer.current) clearTimeout(bagAssignedTimer.current)
      bagAssignedTimer.current = setTimeout(() => setBagAssigned(null), 12000)
      // Reflect the bag on what is already on screen, without re-querying. Only
      // rows for the SAME order and service — another service's history entry
      // keeps its own answer.
      const sameLeg = (r: ScanRecord) => r.orderId === rec.orderId && activeBagForService([{ bagNumber, serviceId: rec.serviceId, serviceName: rec.serviceName }], r.serviceId, r.serviceName) !== null
      setLastScanned((p) => (p && sameLeg(p) ? { ...p, bagNumber } : p))
      setRecent((p) => p.map((r) => (sameLeg(r) && !r.bagNumber ? { ...r, bagNumber } : r)))
      return true
    } catch {
      setOffline(true); setScanErr("Unable to reach the server. Try again.")
      return false
    }
  }, [currentBusinessId, soundEnabled, refreshBags])

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
    // This scan's generation.
    //
    // Only the newest generation may write LAST SCANNED, so a slow reply can
    // never repaint over a later garment (§12). The tally is deliberately NOT
    // guarded — the garment was scanned either way, and dropping it from the
    // count would be a far worse bug than the flicker this prevents. History is
    // ordered by `at`, the scan time, so a late arrival lands in its true place
    // instead of jumping to the front.
    const mine = ++scanGen.current

    const showErr = (msg: string, ms = 4000) => {
      playScanError(soundEnabled); setScanErr(msg); scanErrTimer.current = setTimeout(() => setScanErr(null), ms)
    }

    // The scan response now also carries the PERSISTED result: when the scan was
    // recorded, how many of the order are scanned according to the database, the
    // active bag for this garment's service, and the order's full bag list.
    let j: {
      success?: boolean
      data?: {
        itemId: string; garmentName: string; serviceId?: string | null; serviceName?: string | null
        barcode?: string | null; orderId: string; orderNumber: string; expected: number
        scannedCount?: number; scannedAt?: string; bagNumber?: string | null; bags?: SortingBagRow[]
      }
      error?: string
      code?: string
    }
    try {
      j = await fetch("/api/laundry/processing/sorting", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, action: "scan", code }),
      }).then((r) => r.json())
    } catch {
      setOffline(true); showErr("Unable to reach the server. Check your connection and scan again.", 5000); return
    }
    if (!j.success || !j.data) {
      // The server owns "already scanned" now, so a garment counted on another
      // device — or before this browser was refreshed — is refused here too.
      if (j.code === "ALREADY_SCANNED") showErr(j.error || "Already scanned.")
      else showErr(j.error || "Garment not found")
      return
    }

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
    //
    // The mirror answers instantly for the second and every later garment of an
    // order, which is the common case. It is trusted ONLY when it names a bag:
    // "no bag" is re-checked against the server, because another operator may
    // have assigned one since — and that is the one reading that would put a
    // false BAG REQUIRED in front of the operator.
    const serviceId = d.serviceId ?? null
    // Resolved ONCE, before the lookup, so the bag is matched against exactly
    // the service the operator is shown. Two different values here would let the
    // panel name one service while the bag was resolved for another.
    const serviceName = d.serviceName ?? group?.garments.find((g) => g.id === d.itemId)?.serviceName ?? null
    // WHICH BAG — resolved BY THE SERVER from the order's own assignment rows,
    // using the same resolver this file uses, and returned with the scan. One
    // round trip instead of a second request per scan, and no cache to go stale:
    // another operator's bag is already reflected in the answer.
    if (d.bags) {
      bagsRef.current = { ...bagsRef.current, [d.orderId]: d.bags }
      setBagsByOrder(bagsRef.current)
    }
    const bags = d.bags ?? bagsRef.current[d.orderId] ?? []
    const bag = d.bagNumber ? { bagNumber: d.bagNumber } : activeBagForService(bags, serviceId, serviceName)
    if (d.scannedAt) setScanTimes((prev) => ({ ...prev, [d.itemId]: d.scannedAt as string }))

    const record: ScanRecord = {
      itemId: d.itemId,
      garmentName: d.garmentName,
      gar: d.barcode || group?.garments.find((g) => g.id === d.itemId)?.barcode || "",
      serviceId,
      serviceName,
      orderId: d.orderId,
      orderNumber: d.orderNumber,
      customer: group?.customer ?? null,
      bagNumber: bag?.bagNumber ?? null,
      scannedCount: d.scannedCount ?? scannedCount,
      expected: d.expected,
      // The SERVER's stamp for the persisted scan, so the history it hands back
      // after a refresh interleaves with these identically.
      at: d.scannedAt || new Date(now).toISOString(),
    }
    // Every successful scan is in the history, ordered by when it was MADE.
    setRecent((prev) => [record, ...prev.filter((r) => r.itemId !== record.itemId)]
      .sort((a2, b2) => new Date(b2.at).getTime() - new Date(a2.at).getTime())
      .slice(0, RECENT_LIMIT))
    // …but only the newest scan owns the LAST SCANNED panel, the bag prompt and
    // the highlight. A superseded order's missing bag is not lost: it still
    // reads BAG REQUIRED in the history, and asks again on its next garment.
    const newest = mine === scanGen.current
    if (newest) {
      setLastScanned(record)
      locate(d.orderId, d.itemId)
    }
    // Ask for the bag ONLY when this order has none. Every later garment of the
    // same order finds one and scans straight through. This never gates the
    // scanner — a garment from any other order scans normally while this sits.
    if (newest) {
      setBagNeededFor(bag ? null : record)
      // A new garment supersedes the previous bag confirmation and any standing
      // refusal — both described the scan before this one.
      if (bag) { setBagAssigned(null); setWrongBag(null) }
      else setBagCode("")
    }

    if (scannedCount >= d.expected) {
      playScanOk(soundEnabled)
      toast({ title: "Order complete", description: `${d.orderNumber} — all ${d.expected} garments scanned. Scan the ${bagTarget?.label?.replace(/^Scan /, "") || "bag"} to bind this order.`, duration: 4000 })
    } else {
      playScanOk(soundEnabled)
      toast({ title: `Scanned ${scannedCount} / ${d.expected}`, description: `${d.garmentName} → ${d.orderNumber}`, duration: 1500 })
    }
  }, [currentBusinessId, soundEnabled, bagTarget, toast, orders, locate, refreshBags])

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

        {/* WHAT DID I JUST SCAN, WHERE DOES IT BELONG, AND WHICH BAG DOES IT
            GO IN. Written only by a successful scan; load() never touches it,
            so the 12s poll cannot wipe it mid-shift. */}
        {lastScanned && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Last scanned</span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-slate-800">{lastScanned.garmentName}</span>
                <span className="font-mono text-[11px] text-slate-500">{lastScanned.gar || "—"}</span>
              </div>
              <div className="text-[11px] text-slate-600">
                {lastScanned.customer || "—"} · <span className="font-mono">{lastScanned.orderNumber}</span> · {lastScanned.serviceName || "—"}
              </div>
            </div>
            <span className="text-[13px] font-bold tabular-nums text-emerald-700">{lastScanned.scannedCount} / {lastScanned.expected} scanned</span>
            {/* WHICH BAG THIS GARMENT GOES IN — the whole point of the panel.
                Resolved from the garment's own order AND service, never from the
                previous scan or the first bag on the order. */}
            {lastScanned.bagNumber ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5">
                <Check className="h-4 w-4 text-indigo-700" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700">Add to bag</span>
                <span className="font-mono text-sm font-bold text-indigo-800">{lastScanned.bagNumber}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5">
                <span className="text-[13px] font-bold text-amber-800">⚠ BAG REQUIRED</span>
              </span>
            )}
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

        {/* ✓ BAG ASSIGNED — the bag scan landed and is now in the database. */}
        {bagAssigned && (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-800">
              <Check className="h-4 w-4" /> Bag assigned
            </span>
            <span className="font-mono text-base font-bold text-indigo-800">{bagAssigned.bagNumber}</span>
            <span className="font-mono text-[12px] text-slate-700">{bagAssigned.orderNumber}</span>
            <span className="text-[11px] text-slate-600">{bagAssigned.customer || "—"} · {bagAssigned.serviceName || "—"}</span>
            <button type="button" onClick={() => setBagAssigned(null)} className="ml-auto text-[11px] text-slate-500 underline">Dismiss</button>
          </div>
        )}

        {/* ❌ WRONG BAG — three facts, laid out, so the operator can recover.
            Neither assignment was changed and no garment count moved. */}
        {wrongBag && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">✗ Wrong bag</span>
              <button type="button" onClick={() => setWrongBag(null)} className="ml-auto text-[11px] text-slate-500 underline">Dismiss</button>
            </div>
            <p className="text-[12px] text-slate-700">
              <span className="font-mono font-semibold">{wrongBag.scanned}</span>{" "}
              {wrongBag.heldBy
                ? <>is assigned to <span className="font-mono font-semibold">{wrongBag.heldBy}</span>.</>
                : <>cannot be used. {wrongBag.message}</>}
            </p>
            <p className="text-[12px] text-slate-700">
              This garment belongs to <span className="font-mono font-semibold">{wrongBag.orderNumber}</span>.
            </p>
            {wrongBag.expected && (
              <p className="text-[12px] text-slate-700">
                Expected bag: <span className="font-mono font-semibold text-indigo-800">{wrongBag.expected}</span>
              </p>
            )}
            <p className="text-[10px] text-rose-800">Nothing was changed — both bags keep their orders, and the garment count is unaffected.</p>
          </div>
        )}

        {/* + ADD NEW BAG — the operator says the current bag is full.
            Never automatic (§8): the system cannot see a physical bag fill up,
            and silently assigning one would put garments somewhere nobody
            chose. Adding a bag is exactly what marks the previous one full. */}
        {addBagFor && (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50/70 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800">Add new bag</span>
              <div className="font-mono text-[12px] font-semibold text-slate-800">{addBagFor.orderNumber}</div>
              <div className="text-[11px] text-slate-600">{addBagFor.serviceName || "—"}</div>
            </div>
            <p className="text-[11px] text-indigo-900 basis-full sm:basis-auto">Scan the next physical bag — the current one becomes FULL and every later garment of this service goes into the new bag.</p>
            <div className="ml-auto flex items-center gap-2">
              <input
                value={bagCode}
                onChange={(e) => setBagCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  const c = bagCode.trim()
                  if (c) assignOrderBag(c, { ...addBagFor, customer: null })
                }}
                placeholder="Scan or type bag no…"
                aria-label="New bag number"
                className="h-9 w-40 rounded-lg border border-indigo-300 bg-white px-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <Button
                size="sm"
                disabled={!bagCode.trim() || busy}
                onClick={() => { const c = bagCode.trim(); if (c) assignOrderBag(c, { ...addBagFor, customer: null }) }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Add bag
              </Button>
              <BagScanButton
                label={bagTarget?.label || "Scan Bag QR"}
                size="sm"
                closeOnScan
                disabled={busy}
                onScan={(code) => assignOrderBag(code, { ...addBagFor, customer: null })}
              />
              <button type="button" onClick={() => setAddBagFor(null)} className="text-[11px] text-slate-500 underline">Cancel</button>
            </div>
            <p className="w-full text-[10px] text-indigo-800">The existing bag keeps the garments already sorted into it — scanning continues normally.</p>
          </div>
        )}

        {/* BAG REQUIRED — only for an order that has no bag for THIS service.
            Advisory: the scanner is never gated on this, so a garment from any
            other order scans straight through while this one waits. */}
        {bagNeededFor && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Bag required</span>
              <div className="font-mono text-[12px] font-semibold text-slate-800">{bagNeededFor.orderNumber}</div>
              <div className="text-[11px] text-slate-600">{bagNeededFor.customer || "—"} · {bagNeededFor.serviceName || "—"} · <span className="tabular-nums">{bagNeededFor.scannedCount} / {bagNeededFor.expected} scanned</span></div>
            </div>
            <p className="text-[11px] text-amber-900 basis-full sm:basis-auto">Scan the bag that this order will use.</p>
            <div className="ml-auto flex items-center gap-2">
              {/* A plain field, NOT auto-focused: a keyboard-wedge scanner types
                  into it once the operator clicks it, and until then every scan
                  still reaches the garment scanner above. Auto-focusing here
                  would silently hijack the next garment scan. */}
              <input
                value={bagCode}
                onChange={(e) => setBagCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  e.preventDefault()
                  const c = bagCode.trim()
                  if (c) assignOrderBag(c, bagNeededFor)
                }}
                placeholder="Scan or type bag no…"
                aria-label="Bag number"
                className="h-9 w-40 rounded-lg border border-amber-300 bg-white px-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <Button
                size="sm"
                disabled={!bagCode.trim() || busy}
                onClick={() => { const c = bagCode.trim(); if (c) assignOrderBag(c, bagNeededFor) }}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Assign
              </Button>
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

        {/* LAST 5 SCANS — enough context on each to place the garment without
            going back to the order list: what it is, whose it is, which order
            and service, which bag it goes in, and how far that order has got. */}
        {recent.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5"><History className="h-3 w-3" /> Last {RECENT_LIMIT} scans</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-1.5">
              {recent.map((r) => (
                <button
                  key={r.itemId}
                  type="button"
                  onClick={() => locate(r.orderId, r.itemId)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left hover:border-indigo-300"
                  title={`${r.garmentName} · ${r.serviceName || "—"} · ${r.orderNumber}`}
                >
                  <p className="text-[12px] font-semibold text-slate-800 truncate">{r.garmentName}</p>
                  <p className="font-mono text-[10px] text-slate-400 truncate">{r.gar || "—"}</p>
                  <p className="text-[10px] text-slate-600 truncate">{r.customer || "—"}</p>
                  <p className="font-mono text-[10px] text-slate-500 truncate">{r.orderNumber}</p>
                  <p className="text-[10px] text-slate-600 truncate">{r.serviceName || "—"}</p>
                  {r.bagNumber
                    ? <p className="font-mono text-[11px] font-semibold text-indigo-700 truncate">✓ BAG {r.bagNumber}</p>
                    : <p className="text-[11px] font-semibold text-amber-700">⚠ BAG REQUIRED</p>}
                  <p className="text-[10px] font-semibold tabular-nums text-emerald-700">{r.scannedCount} / {r.expected} scanned</p>
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
                    {/* THE CURRENT SORTING BAG — the one bag the next garment
                        goes into, unmistakable at the top of the card. */}
                    <CurrentBagBanner order={o} bags={bagsByOrder[o.orderId] || []} addBagFor={addBagFor} />
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, (done / o.expected) * 100)}%` }} />
                    </div>
                    {/* EVERY GARMENT OF THE ORDER — no "+N more".
                        The operator has to know what is still outstanding, so
                        nothing is hidden. A long order scrolls inside its own
                        card instead of stretching the page. */}
                    <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/40 p-1.5">
                      <div className="flex flex-wrap gap-1">
                        {o.garments.map((g) => {
                          const isScanned = scannedFor(o.orderId).includes(g.id)
                          const isJust = highlight?.itemId === g.id
                          return (
                            <span
                              key={g.id}
                              title={g.serviceName || undefined}
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${isJust ? "bg-indigo-600 text-white ring-2 ring-indigo-300" : isScanned ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-500 border border-slate-200"}`}
                            >
                              {isScanned && !isJust && <Check className="h-3 w-3" />}
                              {!isScanned && !isJust && <span className="text-slate-300">○</span>}
                              {g.garmentName}
                              {/* Presentation only — the garment's status is untouched. */}
                              {isJust && <span className="ml-0.5 font-semibold">✓ JUST SCANNED</span>}
                            </span>
                          )
                        })}
                      </div>
                    </div>

                    {/* THIS ORDER'S BAGS, per service. One bag fills up and the
                        operator adds another; both stay on the order for good. */}
                    <OrderBags
                      order={o}
                      bags={bagsByOrder[o.orderId] || []}
                      scanTimes={scanTimes}
                      onAdd={(serviceId, serviceName) => { setBagCode(""); setAddBagFor({ orderId: o.orderId, orderNumber: o.orderNumber, serviceId, serviceName }) }}
                    />
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
