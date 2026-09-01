"use client"

// Orders — live, database-backed list of every laundry order. Search, status
// filter, pagination, and stage actions that jump to the relevant workflow
// queue. Reads /api/laundry/orders (customer + store + item count + snapshot).

import { useEffect, useState, useCallback, useMemo } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw, Loader2, ShoppingBag, ClipboardCheck, CreditCard, Truck, ArrowRight, ChevronLeft, ChevronRight, X, Star, Bookmark } from "lucide-react"
import { statusLabel } from "@/lib/laundry-workflow"
import { RECONCILIATION_LABEL, type ReconciliationType } from "@/lib/laundry-reconciliation"
import { operationalQueues } from "@/lib/laundry-operational-stage"
import { DeliveryPromiseBadge } from "@/components/laundry/delivery-promise"
import type { DeliveryPromiseInput } from "@/lib/laundry-delivery-promise"

interface OrderRow {
  id: string; orderNumber: string; status: string; grandTotal: number; paymentStatus: string
  createdAt: string; expectedDeliveryDate: string | null; itemCount: number
  // The order's OWN pickup schedule — LaundryOrder.pickupDate / pickupTimeSlot,
  // as booked. Never derived from the delivery date or the creation time: those
  // answer different questions and an order can be scheduled for either without
  // the other.
  pickupDate: string | null; pickupTimeSlot: string | null
  store?: { storeName: string } | null
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
  feedback?: { rating: number } | null
  // An attested repair, not a system-recorded completion. The list must show
  // the difference too — an operator scanning the queue should never read a
  // reconciled order as a normal delivery.
  administrativelyReconciled?: boolean | null
  reconciliationType?: string | null
  // Derived server-side by the shared rule — the row NEVER recomputes it, so
  // the label, the dropdown and the filter cannot disagree.
  operationalStage?: string | null
  operationalStageKey?: string | null
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_STORE_AUDIT: "border-amber-300 text-amber-700 bg-amber-50",
  UNDER_AUDIT: "border-orange-300 text-orange-700 bg-orange-50",
  PAYMENT_PENDING: "border-rose-300 text-rose-700 bg-rose-50",
  READY_FOR_PROCESSING: "border-violet-300 text-violet-700 bg-violet-50",
  PACKED: "border-indigo-300 text-indigo-700 bg-indigo-50",
  IN_TRANSIT_TO_PROCESSING: "border-sky-300 text-sky-700 bg-sky-50",
  PROCESSING: "border-blue-300 text-blue-700 bg-blue-50",
  QC_PENDING: "border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50",
  RETURN_IN_TRANSIT: "border-teal-300 text-teal-700 bg-teal-50",
  READY_FOR_DELIVERY: "border-emerald-300 text-emerald-700 bg-emerald-50",
  DELIVERED: "border-green-300 text-green-700 bg-green-50",
  CANCELLED: "border-slate-300 text-slate-500 bg-slate-50",
  DRAFT: "border-slate-300 text-slate-500 bg-slate-50",
}
const PAY_STYLE: Record<string, string> = {
  PAID: "border-green-300 text-green-700 bg-green-50",
  PARTIAL: "border-amber-300 text-amber-700 bg-amber-50",
  UNPAID: "border-rose-300 text-rose-700 bg-rose-50",
}
// Derived from the central workflow definition, never hand-listed. The previous
// literal omitted six real statuses — Awaiting Pickup Assignment among them — so
// orders the table displayed could not be filtered for. STATUS_META is declared
// in workflow order, so the dropdown reads in that order too.
// Operational QUEUES, not raw statuses. "PROCESSING" is not a queue — it cannot
// tell an operator whether to go to Washing or Barcode Generation — so the
// dropdown is built from the one shared rule that also labels each row and
// drives the server-side filter. They cannot drift apart.
const OP_FILTERS = operationalQueues()
/** Saved per staff member, server-side, under this key. */
const FILTER_PREF_KEY = "orders.filter"
const PAGE = 10
const inr = (n: number) => `₹${(n || 0).toFixed(2)}`
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")
const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—")

// Which stage screen an order's action jumps to.
type LP = "audit-queue" | "payment-queue" | "packing-queue" | "dispatch-queue" | "store-receive-queue" | "ready-delivery-queue" | "processing-centers"
const STAGE_ACTION: Record<string, { label: string; page: LP; icon: typeof ClipboardCheck }> = {
  PENDING_STORE_AUDIT: { label: "Store Audit", page: "audit-queue", icon: ClipboardCheck },
  UNDER_AUDIT: { label: "Store Audit", page: "audit-queue", icon: ClipboardCheck },
  PAYMENT_PENDING: { label: "Payment", page: "payment-queue", icon: CreditCard },
  READY_FOR_PROCESSING: { label: "Pack & QR", page: "packing-queue", icon: ClipboardCheck },
  PACKED: { label: "Dispatch", page: "dispatch-queue", icon: Truck },
  IN_TRANSIT_TO_PROCESSING: { label: "Processing", page: "processing-centers", icon: Truck },
  PROCESSING: { label: "Processing", page: "processing-centers", icon: Truck },
  RETURN_IN_TRANSIT: { label: "Store Receive", page: "store-receive-queue", icon: Truck },
  READY_FOR_DELIVERY: { label: "Deliver", page: "ready-delivery-queue", icon: Truck },
}

export function LaundryOrdersView() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage, setSelectedOrderId, laundryFocusCustomerId, setLaundryFocusCustomerId, laundryFocusCustomerPhone, setLaundryFocusCustomerPhone } = useAdminStore()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [opStage, setOpStage] = useState("ALL")
  const [page, setPage] = useState(0)
  // Saved filter — restored from the server on mount, so the operator does not
  // reselect their queue every visit. `prefLoaded` gates the first fetch so the
  // list is not loaded once with the default and again with the saved value.
  const [prefLoaded, setPrefLoaded] = useState(false)
  const [savedFilter, setSavedFilter] = useState<{ opStage?: string; search?: string } | null>(null)
  const [savingPref, setSavingPref] = useState(false)
  // Customer filter — seeded from the New Order "View Orders" quick action.
  // Prefer the person's MOBILE: the existing `search` param resolves every
  // Customer id sharing that phone, so legacy/duplicate records are included
  // (matching the phone-aggregated Customer Snapshot). Fall back to the single
  // customerId only when there is no usable phone.
  const [custFilter, setCustFilter] = useState<string | null>(null)
  useEffect(() => {
    if (!laundryFocusCustomerId && !laundryFocusCustomerPhone) return
    if (laundryFocusCustomerPhone) { setSearch(laundryFocusCustomerPhone); setCustFilter(null) }
    else if (laundryFocusCustomerId) setCustFilter(laundryFocusCustomerId)
    setLaundryFocusCustomerId(null); setLaundryFocusCustomerPhone(null); setPage(0)
  }, [laundryFocusCustomerId, laundryFocusCustomerPhone, setLaundryFocusCustomerId, setLaundryFocusCustomerPhone])

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, limit: String(PAGE), offset: String(page * PAGE) })
      if (opStage !== "ALL") params.set("opStage", opStage)
      if (search.trim()) params.set("search", search.trim())
      if (custFilter) params.set("customerId", custFilter)
      const json = await fetch(`/api/laundry/orders?${params}`).then((r) => r.json())
      setRows(json.success ? json.data : []); setTotal(json.total || 0)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [currentBusinessId, page, opStage, search, custFilter])
  useEffect(() => { if (prefLoaded) load() }, [load, prefLoaded])
  useEffect(() => { setPage(0) }, [opStage])

  // ── Saved filter, per staff member ──────────────────────────────────────
  // Read once on mount. The endpoint resolves the user from the session, so a
  // staff member can only ever receive their own.
  useEffect(() => {
    if (!currentBusinessId) return
    let cancelled = false
    fetch(`/api/laundry/user-preferences?businessId=${encodeURIComponent(currentBusinessId)}&key=${FILTER_PREF_KEY}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        const saved = j?.success && j.data && typeof j.data === "object" ? j.data as { opStage?: string; search?: string } : null
        if (saved) {
          setSavedFilter(saved)
          if (saved.opStage) setOpStage(saved.opStage)
          if (saved.search) setSearch(saved.search)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPrefLoaded(true) })
    return () => { cancelled = true }
  }, [currentBusinessId])

  const saveFilter = async () => {
    if (!currentBusinessId) return
    setSavingPref(true)
    const body = { opStage, search: search.trim() }
    try {
      const j = await fetch(`/api/laundry/user-preferences?businessId=${encodeURIComponent(currentBusinessId)}&key=${FILTER_PREF_KEY}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json())
      if (j?.success) setSavedFilter(body)
    } catch { /* the screen still works — the filter just is not remembered */ } finally { setSavingPref(false) }
  }

  const clearSavedFilter = async () => {
    if (!currentBusinessId) return
    setSavingPref(true)
    try {
      await fetch(`/api/laundry/user-preferences?businessId=${encodeURIComponent(currentBusinessId)}&key=${FILTER_PREF_KEY}`, { method: "DELETE" })
      setSavedFilter(null)
      // Clearing returns the screen to the default, as the operator expects.
      setOpStage("ALL"); setSearch(""); setPage(0)
    } catch { /* noop */ } finally { setSavingPref(false) }
  }

  const filterIsSaved = !!savedFilter && savedFilter.opStage === opStage && (savedFilter.search || "") === search.trim()

  const custFilterName = custFilter ? (rows.find((r) => r.customer)?.customer?.name || "selected customer") : null

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const summary = useMemo(() => ({ shown: rows.length }), [rows])

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-600" /> Orders</h1>
          <p className="text-sm text-slate-500">{total} order{total === 1 ? "" : "s"} · {custFilter ? "filtered to customer" : "all workflow stages"}</p>
          {custFilter && (
            <button onClick={() => { setCustFilter(null); setPage(0) }} className="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
              {custFilterName} <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}>New Order</Button>
        </div>
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search order number…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></div>
          <Select value={opStage} onValueChange={setOpStage}>
            <SelectTrigger className="h-9 w-56 bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Operational Stages</SelectItem>
              {OP_FILTERS.map((q) => <SelectItem key={q.key} value={q.key}>{q.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Saved per staff member, server-side — the same person gets their
              filter back on any workstation they sign in to. */}
          <Button
            variant="outline" size="sm" className="h-9 gap-1.5"
            disabled={savingPref || filterIsSaved}
            onClick={saveFilter}
            title={filterIsSaved ? "This filter is already saved" : "Remember this filter for me"}
          >
            <Bookmark className="h-3.5 w-3.5" /> {filterIsSaved ? "Filter Saved" : "Save Filter"}
          </Button>
          {savedFilter && (
            <Button variant="ghost" size="sm" className="h-9 text-slate-500" disabled={savingPref} onClick={clearSavedFilter}>
              Clear Saved
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16"><ShoppingBag className="h-8 w-8 text-slate-300 mx-auto mb-2" /><p className="text-sm font-medium text-slate-600">{search || status !== "ALL" ? "No orders match" : "No orders yet"}</p><p className="text-xs text-slate-400 mt-0.5">Create one from New Order.</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="text-[11px] uppercase tracking-wide">
                <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Store</TableHead>
                <TableHead className="text-center">Items</TableHead><TableHead className="text-right">Amount</TableHead>
                <TableHead>Payment</TableHead><TableHead>Operational Stage</TableHead><TableHead>Created</TableHead>
                <TableHead className="text-center">Rating</TableHead><TableHead>Pickup</TableHead><TableHead>Delivery</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const act = STAGE_ACTION[o.status]
                  return (
                    <TableRow key={o.id}>
                      <TableCell><div className="flex items-center gap-1.5 flex-wrap"><button type="button" className="font-mono font-medium text-sm text-blue-700 hover:underline text-left" onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }}>{o.orderNumber}</button><DeliveryPromiseBadge order={o as DeliveryPromiseInput} /></div></TableCell>
                      <TableCell><div className="text-sm font-medium text-slate-700">{o.customer?.name || "—"}</div><div className="text-[11px] text-slate-400">{o.customer?.phone || ""}</div></TableCell>
                      <TableCell className="text-sm text-slate-600">{o.store?.storeName || "—"}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{o.itemCount}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{inr(o.grandTotal)}</TableCell>
                      <TableCell><Badge variant="outline" className={PAY_STYLE[o.paymentStatus] || "border-slate-200 text-slate-500"}>{o.paymentStatus || "—"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <div>
                            <Badge variant="outline" className={STATUS_STYLE[o.status] || "border-slate-200"}>{o.operationalStage || statusLabel(o.status)}</Badge>
                            {/* The workflow status is kept, small and secondary:
                                useful context, but never the thing an operator
                                has to decode to know where the work is. */}
                            {o.operationalStage && o.operationalStage !== statusLabel(o.status) && (
                              <p className="mt-0.5 text-[10px] text-slate-400">{statusLabel(o.status)}</p>
                            )}
                          </div>
                          {o.administrativelyReconciled && (
                            <Badge
                              variant="outline"
                              className="border-amber-400 bg-amber-50 text-amber-800 text-[10px]"
                              title={RECONCILIATION_LABEL[o.reconciliationType as ReconciliationType] || "Administrative Reconciliation"}
                            >
                              Admin
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{fmt(o.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        {o.feedback?.rating ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600" title={`Rated ${o.feedback.rating}/5`}><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{o.feedback.rating}.0</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      {/* PICKUP — the booked collection slot, read straight off
                          the order. The slot string is shown exactly as stored,
                          which is how Order Detail and every scheduling screen
                          already print it; a second time format on one screen
                          would make the same order look like two. */}
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {o.pickupDate ? (
                          <>
                            <div>{fmtDay(o.pickupDate)}</div>
                            {o.pickupTimeSlot && <div className="text-[11px] text-slate-400">{o.pickupTimeSlot}</div>}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{fmtDay(o.expectedDeliveryDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="gap-1 h-8 text-slate-500" onClick={() => { setSelectedOrderId(o.id); setLaundryPage("order-detail") }}>View</Button>
                          {act && (
                            <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setLaundryPage(act.page)}><act.icon className="h-3.5 w-3.5" /> {act.label} <ArrowRight className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {page * PAGE + 1}–{page * PAGE + summary.shown} of {total}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-2 text-xs">Page {page + 1} / {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
