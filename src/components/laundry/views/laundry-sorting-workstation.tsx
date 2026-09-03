"use client"

// SORTING workstation — the permanent garment→bag transition point.
//
// TWO DIFFERENT ACTS, which used to share one name and one screen:
//
//   WHICH BAG DO THESE GARMENTS GO IN  — the operator's working question, and
//     the flow this screen is built around. Scan a garment → its order becomes
//     current → if that order+service has no Sorting bag, BAG REQUIRED → scan
//     any AVAILABLE bag → it becomes the current Sorting bag → garments go into
//     it → when the physical bag is full the operator adds another. An order
//     may fill several bags; nothing is ever capped or closed automatically.
//     Written through /api/laundry/orders/[id]/bags (purpose SORTING).
//
//   COMPLETING THE STAGE — once every garment of an order has been scanned
//     here, the order can be finished: the server retires every garment
//     barcode and advances every garment past Sorting, after which only the
//     bag QR is valid (Iron / Fold / Transit). Written through
//     /api/laundry/processing/sorting, which enforces the completeness rule
//     server-side.
//
// The second act is a stage exit, NOT a limit on the first: bags are assigned
// whenever the operator needs one, not only after a full scan.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { sortingOrderSummary } from "@/lib/laundry-order-display"
import { useToast } from "@/hooks/use-toast"
import { useAutoRefresh } from "@/hooks/use-auto-refresh"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ScanLine, PackageCheck, RefreshCw, Check, Layers } from "lucide-react"
import { LaundryBarcodeScanner } from "@/components/laundry/laundry-barcode-scanner"
import { BagScanButton } from "@/components/laundry/bag-scanner"
import { playScanOk, playScanError } from "@/lib/laundry-scan-sound"
import { useGarmentSearch } from "@/hooks/use-garment-search"
import { GarmentSearchResults } from "@/components/laundry/garment-search-results"
import { Search, X, MapPin, History, Plus } from "lucide-react"
import { activeBagForService, bagsForService, sortingBagStatus, type SortingBagRow } from "@/lib/laundry-sorting-bags"
import { CopyButton } from "@/components/ui/copy-button"

interface Item {
  id: string; itemNumber: string | null; barcode: string | null
  /** The GAR code. The API already sends it; intake writes the same value to
   *  `barcode`, so `barcode` is the fallback for any row that predates it. */
  garmentScanCode?: string | null
  garmentName: string; serviceName: string | null; serviceId?: string | null; quantity: number
  orderId: string; orderNumber: string | null; customer: string | null
  /** The ORDER's recorded total weight (kg), repeated on each of its rows by
   *  the processing API. Read as stored — never summed from the garments. */
  orderTotalWeightKg?: number | null
}

interface OrderGroup { orderId: string; orderNumber: string; expected: number; customer: string | null; garments: Item[]
  /** The order's recorded weight, taken from its rows as the API sent it. */
  totalWeightKg: number | null }

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
  /**
   * WHICH refusal this was. A bag held by another order is a WRONG BAG — the
   * operator has the wrong physical thing in their hand. A service the order
   * cannot attribute is not: the bag may be perfectly good, and calling it
   * wrong sends the operator hunting for a bag that was never the problem.
   */
  kind: "BAG" | "SERVICE"
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
/** The GAR an operator reads off the label — `garmentScanCode`, else `barcode`. */
const garOf = (g: { garmentScanCode?: string | null; barcode?: string | null }): string =>
  (g.garmentScanCode || g.barcode || "").trim()

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

function OrderBags({ order, bags, onAdd }: {
  order: OrderGroup
  bags: SortingBagRow[]
  /** `hasBag` — this service already has a Sorting bag, so this is a SECOND
   *  bag, not the first. The caller decides what that means; OrderBags only
   *  reports it, from the canonical bagsForService rows. */
  onAdd: (serviceId: string | null, serviceName: string | null, hasBag: boolean) => void
}) {
  const services = servicesOnOrder(order)

  // THE ACTION ONLY. The bag STATUS is stated once, by the banner above — this
  // used to repeat it as chips carrying a bag index, a per-bag garment tally
  // and a use/full label, plus a panel listing the order's transport and
  // delivery bags. All of it was true and none of it was the operator's
  // question here, and two descriptions of one fact is worse than one. Adding
  // a bag is still a real operational act (a bag fills up), so the button
  // stays exactly as it was, wired to the same onAdd and the same second-bag
  // confirmation.
  return (
    <div className="mt-2 space-y-1.5">
      {services.map((svc) => {
        const hasBag = bagsForService(bags, svc.id, svc.name).length > 0
        return (
          <div key={(svc.id || "") + (svc.name || "")} className="flex items-center gap-2">
            {services.length > 1 && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{svc.name || "Service"}</span>
            )}
            <button
              type="button"
              onClick={() => onAdd(svc.id, svc.name, hasBag)}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-indigo-200 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
            >
              {/* Context-sensitive on the ACTUAL assignment rows: before the
                  first bag exists this binds Bag 1, so it is never allowed to
                  imply a "next" bag, a bag becoming FULL, or Bag 2. */}
              {hasBag ? <><Plus className="h-3 w-3" /> Add New Bag</> : <><Plus className="h-3 w-3" /> Assign First Bag</>}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/**
 * SORTING BAG — the left card's answer, in the same words the Complete Sorting
 * card uses on the right.
 *
 * It used to name the bag with one phrase while the panel below it named the
 * same bag with another, adding a bag index, a per-garment tally and a
 * use/full label. An operator scanning the queue does
 * not need the lifecycle — they need to know whether a bag is on the order and
 * which one. Both sides now read the SAME sortingBagStatus over the SAME
 * bagsByOrder rows, so the two halves of the screen cannot disagree.
 */
function CurrentBagBanner({ order, bags, addBagFor }: {
  order: OrderGroup
  bags: SortingBagRow[]
  addBagFor: { orderId: string; orderNumber: string; serviceId: string | null; serviceName: string | null } | null
}) {
  const status = sortingBagStatus(bags, servicesOnOrder(order))

  // Mid-flow: the operator has chosen to add another bag and is being asked for
  // it. An action prompt, not a lifecycle label — nothing here says "closed".
  if (addBagFor?.orderId === order.orderId) {
    return (
      <div className="mt-2 rounded-lg border-2 border-orange-300 bg-orange-500 px-3 py-2 text-white">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">Scan the next sorting bag</p>
        <p className="text-[11px] font-semibold text-white/90">The following garments go into the bag you scan next.</p>
      </div>
    )
  }

  if (!status.ready) {
    return (
      <div className="mt-2 rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800">🟠 Bag Required</p>
        <p className="text-[12px] text-amber-900">Attach a sorting bag before completing sorting.</p>
      </div>
    )
  }

  const many = status.attached.length > 1
  return (
    <div className="mt-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">🟢 Sorting Bag{many ? "s" : ""} Attached</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {status.attached.map((code) => (
          <span key={code} className="inline-flex items-center gap-1">
            <span className="font-mono text-[13px] font-bold text-emerald-900">{code}</span>
            <CopyButton value={code} label="Bag code" size="icon" variant="ghost" className="h-5 w-5 shrink-0" silent preventFocusSteal />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * SORTING HISTORY — orders that actually completed the stage.
 *
 * An AUDIT VIEW, not a second queue: it never scans, assigns or advances, and
 * nothing on it is actionable. An order is here because the server recorded a
 * successful completion (LaundryProcessingPackage.bagAssigned), and the bags
 * listed are the rows that order was actually given AT SORTING — never a
 * transport bag, never one inferred from an earlier journey.
 *
 * Read fresh from the server on every open, so a refresh cannot change it and
 * client state cannot invent it.
 */
interface SortingHistoryRow {
  orderId: string
  orderNumber: string | null
  customer: string | null
  garments: number
  expected: number
  sortingBags: string[]
  completedAt: string | null
  completedBy: string | null
  status: string
}

function SortingHistory({ businessId }: { businessId: string }) {
  const [rows, setRows] = useState<SortingHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    setLoading(true)
    const p = new URLSearchParams({ businessId, history: "1" })
    if (query.trim()) p.set("search", query.trim())
    fetch(`/api/laundry/processing/sorting?${p}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (!j?.success) { setRows([]); setError(j?.error || "Could not load Sorting history."); return }
        setError(null); setRows(j.history || [])
      })
      .catch(() => { if (!cancelled) { setRows([]); setError("Could not load Sorting history.") } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [businessId, query])

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—")

  return (
    <div className="px-4 lg:px-6 py-4 space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); setQuery(search) }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order number or bag…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm outline-none focus:border-indigo-300"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" className="text-[12px]">Search</Button>
        {query && (
          <button type="button" onClick={() => { setSearch(""); setQuery("") }} className="text-[11px] text-slate-500 underline">Clear</button>
        )}
      </form>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">
          {query ? "No completed Sorting order matches that search." : "No order has completed Sorting yet. An order appears here once its Sorting completion succeeds."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.orderId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-semibold text-slate-800 break-all">{r.orderNumber || r.orderId}</p>
                  <p className="text-[12px] text-slate-600">{r.customer || "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-[11px]">
                    {r.garments} / {r.expected} garments
                  </Badge>
                  <Badge className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] font-bold">{r.status}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Singular vs plural, because "Sorting Bags: VBBAG001" reads
                      like something is missing. */}
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {r.sortingBags.length === 1 ? "Sorting bag" : "Sorting bags"}
                  </span>
                  {r.sortingBags.length === 0 ? (
                    <span className="text-[11px] text-slate-400">— none recorded</span>
                  ) : r.sortingBags.map((b, i) => (
                    <span key={b} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-800">
                      {r.sortingBags.length > 1 && <span className="text-[9px] font-bold text-indigo-400">{i + 1}</span>}
                      {b}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 ml-auto">
                  Completed {when(r.completedAt)}{r.completedBy ? ` · ${r.completedBy}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** One order card's bag list — its own hook instance, its own refresh. */
/**
 * SORTING BAG — the one thing the Complete Sorting card has to answer.
 *
 * It used to render the shared OrderBagList, which is a bag-management panel:
 * "Bags 2", "Bag 1 of 2", "Closed", "On this order", "Add Another Bag". All of
 * that is true and none of it is this operator's question. They are handing the
 * order on and need to know which bag goes with it — or that none does.
 *
 * So this shows the attached Sorting bags and nothing else. No index, no
 * ACTIVE/FULL, no history, no other-purpose rows: sortingBagStatus reads the
 * same canonical assignment rows through bagsForService, so a closed bag, a
 * pickup bag and a delivery bag are all excluded by the same rule the rest of
 * Sorting already uses. OrderBagList itself is untouched — Packing still uses it.
 */
function SortingBagPanel({ bags, services }: {
  /** The order's assignment rows from the workstation's own bagsByOrder map —
   *  the same rows the queue card's banner reads, re-read after every scan and
   *  every assignment. Taking them as a prop rather than fetching per card
   *  keeps ONE source and removes a request per rendered order. */
  bags: SortingBagRow[]
  services: { id: string | null; name: string | null }[]
}) {
  const status = sortingBagStatus(bags, services)

  if (!status.ready) {
    return (
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-amber-800">⚠ Bag Required</p>
        <p className="mt-0.5 text-[12px] text-amber-900">No sorting bag is attached to this order.</p>
        <p className="text-[12px] font-medium text-amber-900">Attach a sorting bag before completing sorting.</p>
      </div>
    )
  }
  const many = status.attached.length > 1
  return (
    <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Sorting Bag{many ? "s" : ""}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[12px] text-emerald-900">Bag{many ? "s" : ""} attached:</span>
        {status.attached.map((code) => (
          <span key={code} className="inline-flex items-center gap-1">
            <span className="font-mono text-[13px] font-bold text-emerald-900">{code}</span>
            <CopyButton value={code} label="Bag code" size="icon" variant="ghost" className="h-5 w-5 shrink-0" silent preventFocusSteal />
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[12px] font-semibold text-emerald-800">✓ Ready for Sorting</p>
    </div>
  )
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
  // Active ⇄ History. History is an audit view of completed Sorting, read from
  // the server; switching to it does not stop or disturb the active workflow.
  const [tab, setTab] = useState<"active" | "history">("active")
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
  // MOVING TO A SECOND BAG IS A DECISION, so it is asked rather than assumed.
  // Purely an operator acknowledgement: nothing is counted, weighed, closed,
  // released or marked FULL by it. Holding the pending target here means Cancel
  // simply drops it — no bag panel opens and nothing about the order changes.
  const [confirmSecondBag, setConfirmSecondBag] = useState<{ orderId: string; orderNumber: string; serviceId: string | null; serviceName: string | null } | null>(null)
  // A LOCAL FILTER OVER WHAT IS ALREADY LOADED — not a search.
  //
  // Deliberately separate from the global Garment Lookup above, which asks the
  // SERVER about any garment anywhere. This one never requests anything: it
  // only decides which of the orders already in `orders` are drawn.
  const [orderFilter, setOrderFilter] = useState("")

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
    // A scanned order must always be reachable. If a filter is hiding it, the
    // filter yields — the scan is the operator's real intent, and a card that
    // is not rendered cannot be scrolled to.
    setOrderFilter("")
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
        const g: OrderGroup = byOrder.get(oid) || { orderId: oid, orderNumber: it.orderNumber || "", expected: 0, customer: it.customer || null, garments: [], totalWeightKg: it.orderTotalWeightKg ?? null }
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
          kind: j?.code === "SERVICE_REQUIRED" ? "SERVICE" : "BAG",
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
  // ONE FILTERED COLLECTION FEEDS BOTH SECTIONS, so an order can never be
  // listed at Sorting while missing from Complete Sorting, or the reverse.
  // Empty filter → `orders` itself, so nothing changes when it is not in use.
  const visibleOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      if ((o.orderNumber || "").toLowerCase().includes(q)) return true
      if ((o.customer || "").toLowerCase().includes(q)) return true
      if (o.garments.some((g) => garOf(g).toLowerCase().includes(q))) return true
      return (bagsByOrder[o.orderId] || []).some((b) => (b.bagNumber || "").toLowerCase().includes(q))
    })
  }, [orders, orderFilter, bagsByOrder])

  const readyOrders = visibleOrders.filter((o) => scannedFor(o.orderId).length >= o.expected)

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
      toast({ title: "Order complete", description: `${d.orderNumber} — all ${d.expected} garments scanned. Scan the ${bagTarget?.label?.replace(/^Scan /, "") || "bag"} to complete Sorting and move it on.`, duration: 4000 })
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

  // Is the order's add-bag panel for a service that ALREADY has a Sorting bag?
  //
  // Everything here is derived from the ASSIGNMENT ROWS, never from the button
  // being clicked: opening the panel changes nothing. With no bag yet the panel
  // is a FIRST-bag assignment and must never speak of a "next" bag, "becomes
  // FULL" or Bag 2. With a bag present it is exactly the close-and-add-next act.
  // The bag is assigned ONLY when its barcode is successfully scanned and the
  // server-side binding succeeds; until then `activeBagForService` keeps
  // answering null and the banner keeps reading BAG REQUIRED.
  const bagPanelExisting = addBagFor
    ? activeBagForService(bagsByOrder[addBagFor.orderId] || [], addBagFor.serviceId, addBagFor.serviceName)
    : null

  const tabStrip = (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      {([["active", "Active"], ["history", "History"]] as const).map(([k, lbl]) => (
        <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lbl}</button>
      ))}
    </div>
  )

  // HISTORY. Rendered after every hook above has run, so the hook order is
  // identical in both tabs. The active workflow's state is left exactly as it
  // was — switching back finds the same queue, scans and bags.
  if (tab === "history") {
    return (
      <div className="min-h-full">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 px-4 lg:px-6 pt-4 pb-3 space-y-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" /> Sorting
            <Badge className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[10px] font-semibold">COMPLETED — AUDIT VIEW</Badge>
          </h1>
          {tabStrip}
        </div>
        <SortingHistory businessId={currentBusinessId || ""} />
      </div>
    )
  }

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
            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50"><PackageCheck className="h-3 w-3 mr-1" /> {readyOrders.length} ready to complete</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tabStrip}
        </div>

        <Card className="rounded-xl border-indigo-200 bg-indigo-50/40 shadow-sm">
          <CardContent className="p-4">
            <LaundryBarcodeScanner onDetect={handleGarmentScan} departmentLabel="Sorting" />
            {offline && <div className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">Unable to reach the server. Check your connection.</div>}
            {scanErr && !offline && <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{scanErr}</div>}
            <p className="mt-2 text-[11px] text-slate-500">Scan a garment to identify the order. If no sorting bag is assigned, scan the bag this order will use. Once a bag is assigned, continue scanning garments into the current sorting bag.</p>
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

        {/* TWO DIFFERENT REFUSALS, said differently.
            WRONG BAG — the operator is holding the wrong physical bag.
            SERVICE REQUIRED — the bag is fine; the order cannot attribute the
            service, which the operator resolves by choosing one, not by
            fetching another bag. Neither changes any assignment. */}
        {wrongBag && wrongBag.kind === "SERVICE" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">⚠ Service required</span>
              <button type="button" onClick={() => setWrongBag(null)} className="ml-auto text-[11px] text-slate-500 underline">Dismiss</button>
            </div>
            <p className="text-[12px] text-slate-700">{wrongBag.message}</p>
            <p className="text-[12px] text-slate-700">
              This garment belongs to <span className="font-mono font-semibold">{wrongBag.orderNumber}</span>.
            </p>
            <p className="text-[10px] text-amber-800">
              The bag <span className="font-mono font-semibold">{wrongBag.scanned}</span> was not changed — choose the service this bag is for and scan it again.
            </p>
          </div>
        )}
        {wrongBag && wrongBag.kind === "BAG" && (
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

        {/* + ADD NEW BAG / ASSIGN FIRST BAG — context-sensitive on the order's
            actual assignments (`bagPanelExisting`), never on the button being
            clicked. With a bag present this closes it and binds the next — the
            physical act that marks the previous one full. Before ANY bag exists
            it is a FIRST-bag assignment: BAG REQUIRED language only, and never
            a "next bag", "current becomes FULL" or Bag 2. The bag becomes
            assigned ONLY when its barcode is scanned and the server-side
            binding (assignOrderBag → /orders/[id]/bags) succeeds. */}
        {/* SECOND BAG — the operator confirms the physical bag is full before
            the scan panel opens. Nothing here touches bag state: on Yes it does
            exactly what the button used to do, and on Cancel it does nothing. */}
        {confirmSecondBag && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">Is the first bag full?</span>
              <div className="font-mono text-[12px] font-semibold text-slate-800">{confirmSecondBag.orderNumber}</div>
              <div className="text-[11px] text-slate-600">{confirmSecondBag.serviceName || "—"}</div>
            </div>
            <p className="text-[11px] text-amber-900 basis-full sm:basis-auto">You are moving this order to a second bag. Continue?</p>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmSecondBag(null)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setAddBagFor(confirmSecondBag); setConfirmSecondBag(null) }}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
              >
                Yes, Add Second Bag
              </button>
            </div>
          </div>
        )}

        {/* The assign-bag panel used to render HERE, in this strip above the
            order grid. Its "Scan Laundry Bag" control was therefore up to a
            screenful away from the card whose button opened it: with the
            operator scrolled down to an order, clicking Assign put the control
            they needed off the top of the viewport (measured at −352px on a
            900px viewport), and inserting the strip shifted the document by its
            own height. It now renders inside the order card that opened it —
            see the panel rendered under the order's add-bag button below. */}
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
                <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">{visibleOrders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* FILTER, not search. The global Garment Lookup above asks the
                  server about any garment anywhere; this only narrows the
                  orders already on screen, and requests nothing. */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  placeholder="Filter these orders — number, customer, GAR or bag"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-8 py-2 text-[13px] outline-none focus:border-indigo-300"
                />
                {orderFilter && (
                  <button
                    type="button"
                    onClick={() => setOrderFilter("")}
                    aria-label="Clear filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {visibleOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">
                  {orderFilter ? "No loaded order matches that filter." : "No orders are ready for Sorting."}
                </p>
              ) : visibleOrders.map((o) => {
                // ONE COLLECTION ANSWERS "WHAT HAS BEEN SCANNED FOR THIS ORDER".
                // The badge, the garment list and Copy All all read it, so the
                // count and the list cannot be computed two different ways and
                // drift apart — which is exactly how "3 / 25 scanned" came to
                // render fewer than three rows.
                const scannedIds = new Set(scannedFor(o.orderId))
                const scannedGarments = o.garments.filter((g) => scannedIds.has(g.id))
                const done = scannedGarments.length
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
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800 font-mono break-all">{o.orderNumber}</p>
                          <CopyButton value={o.orderNumber} label="Order number" size="icon" variant="ghost" className="h-6 w-6 shrink-0" silent preventFocusSteal />
                        </div>
                        <p className="text-[11px] text-slate-400">{o.customer || "—"}</p>
                        {/* Service · garments · weight, from the ONE helper both
                            Sorting cards use, so the same order cannot read two
                            different ways on the two sides of this screen. The
                            three facts are independent: the count is the real
                            number of item rows in this order's sorting queue and
                            the weight is what was measured at Store Audit —
                            neither is computed from the other, and an order with
                            no recorded weight shows an em dash, never "0 kg". */}
                        <p className="text-[11px] font-medium text-slate-600 tabular-nums">{sortingOrderSummary({ garments: o.garments, garmentCount: o.garments.length, totalWeightKg: o.totalWeightKg })}</p>
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
                          // Same set the count and the list use — one answer to
                          // "is this garment scanned" per card.
                          const isScanned = scannedIds.has(g.id)
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

                    {/* SCANNED GARMENTS — what has actually been recorded at
                        Sorting for this order, and nothing else.
                        Membership is `scanned[orderId]`, the persisted scan
                        trail; a garment the operator has not scanned is simply
                        absent. The ids are matched against the order's own
                        garments, so a duplicate scan cannot list a garment
                        twice and another order's garment can never appear.
                        Deliberately NOT grouped under a bag: which physical bag
                        a garment went into is not durably stored, and a
                        plausible-looking grouping would be a claim the data
                        cannot support. The bag is shown separately, above. */}
                    {scannedGarments.length > 0 && (
                      <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Scanned garments</span>
                          {/* The SAME number the badge above shows, from the same
                              collection that renders the rows below it. */}
                          <span className="text-[10px] tabular-nums text-slate-400">{scannedGarments.length} / {o.expected}</span>
                          {/* ONE LINE PER SCANNED GARMENT, exactly as displayed —
                              a garment with no GAR copies as "— Name" rather than
                              being silently dropped from the list. */}
                          <CopyButton
                            value={scannedGarments.map((g) => `${garOf(g) || "—"} — ${g.garmentName}`).join("\n")}
                            label="Scanned garments"
                            size="sm" variant="outline" className="ml-auto h-6 px-1.5 text-[10px]"
                            preventFocusSteal
                          >
                            Copy all scanned garments
                          </CopyButton>
                        </div>
                        {/* The one scroll region for this list: 25 garments scroll
                            here, and the page stays where the operator left it. */}
                        <div className="max-h-40 overflow-y-auto space-y-0.5">
                          {scannedGarments.map((g) => {
                            const gar = garOf(g)
                            return (
                              <div key={g.id} className="flex items-center gap-1.5 text-[11px]">
                                <span className="font-mono text-slate-700">{gar || "—"}</span>
                                <span className="text-slate-500 truncate">— {g.garmentName}</span>
                                {gar && <CopyButton value={gar} label="GAR code" size="icon" variant="ghost" className="h-5 w-5 shrink-0 ml-auto" silent preventFocusSteal />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* THIS ORDER'S BAGS, per service. One bag fills up and the
                        operator adds another; both stay on the order for good. */}
                    <OrderBags
                      order={o}
                      bags={bagsByOrder[o.orderId] || []}
                      onAdd={(serviceId, serviceName, hasBag) => {
                        setBagCode("")
                        const target = { orderId: o.orderId, orderNumber: o.orderNumber, serviceId, serviceName }
                        // FIRST bag → straight to the existing scan panel, at any
                        // scanned count. Only a SECOND bag asks first.
                        if (hasBag) setConfirmSecondBag(target)
                        else setAddBagFor(target)
                      }}
                    />

                    {/* …AND HERE: directly under the button that opens it, so
                        the scan control appears where the operator is already
                        looking and already clicking. Same panel, same handlers,
                        same endpoint — only its position in the document
                        changed. */}
                    {addBagFor?.orderId === o.orderId && (
                <div className="rounded-xl border border-indigo-300 bg-indigo-50/70 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-800">{bagPanelExisting ? "Add new bag" : "Assign first bag"}</span>
                    <div className="font-mono text-[12px] font-semibold text-slate-800">{addBagFor.orderNumber}</div>
                    <div className="text-[11px] text-slate-600">{addBagFor.serviceName || "—"}</div>
                  </div>
                  <p className="text-[11px] text-indigo-900 basis-full sm:basis-auto">{bagPanelExisting
                    ? "Scan the next physical bag — the current one becomes FULL and every later garment of this service goes into the new bag."
                    : "Scan the bag this order will use — it becomes this service's Sorting bag."}</p>
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
                  <p className="w-full text-[10px] text-indigo-800">{bagPanelExisting
                    ? "The existing bag keeps the garments already sorted into it — scanning continues normally."
                    : "No Sorting bag is assigned to this order for this service yet — the bag you scan becomes Bag 1."}</p>
                </div>
        
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-emerald-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px] font-semibold text-slate-800 flex items-center gap-2">
                <PackageCheck className="h-[18px] w-[18px] text-emerald-600" /> Complete Sorting
                <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">{readyOrders.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {readyOrders.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">An order appears here once every one of its garments has been scanned — that is when Sorting can be completed and the order moved on. Sorting bags are assigned on the order card, whenever one is needed.</p>
              ) : readyOrders.map((o) => (
                <div key={o.orderId} className="rounded-lg border border-emerald-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800 font-mono">{o.orderNumber}</p>
                  {/* The SAME identity block the left-hand card shows. These are
                      the very same OrderGroup objects (readyOrders filters
                      visibleOrders), so the customer, service, garment count and
                      weight are already in hand — no second request, and no
                      per-card order fetch. */}
                  <p className="text-[11px] text-slate-400 mt-0.5">{o.customer || "—"}</p>
                  <p className="text-[11px] font-medium text-slate-600 tabular-nums">{sortingOrderSummary({ garments: o.garments, garmentCount: o.garments.length, totalWeightKg: o.totalWeightKg })}</p>
                  <p className="text-[11px] text-slate-500 mt-1">All {o.expected} garments scanned. Scan the {bagTarget?.label?.replace(/^Scan /, "") || "bag"} to complete Sorting{bagTarget?.hint ? <span className="font-mono"> ({bagTarget.hint})</span> : null} — this finishes the stage, it is not what decides which bag a garment goes into.</p>
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
                    {/* Which bag is attached — not the order's bag history.
                        Reads the same bagsByOrder rows the queue card uses, so
                        both halves of the screen agree and neither fetches. */}
                    <SortingBagPanel bags={bagsByOrder[o.orderId] || []} services={servicesOnOrder(o)} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">Completing Sorting retires every garment barcode and advances the order to Ironing / Folding / Transit.</p>
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
