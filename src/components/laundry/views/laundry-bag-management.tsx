"use client"

// Laundry → Bags. The reusable-bag master and, since the customer-retention
// change, the answer to one operational question: WHERE IS EVERY PHYSICAL BAG?
//
// The screen never classifies anything itself. Buckets, labels and totals all
// come from the lifecycle domain (laundry-bag-lifecycle) via /api/laundry/bags,
// so the dashboard cannot drift from the engine that moves the bags. In
// particular a bag with a customer is NOT stock and never appears as Available.
//
// Status ("can it be used?") and custodian ("who is holding it?") are shown as
// separate columns, because that separation is the whole point of the model.
import { useCallback, useEffect, useState } from "react"
import QRCode from "qrcode"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Loader2, Search, Package, Plus, Printer, ChevronLeft, ChevronRight, ScanLine,
  User, Store as StoreIcon, AlertTriangle, ShieldQuestion, Wrench, RotateCcw,
  ChevronDown, History, XCircle, Archive,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { BagScanButton } from "@/components/laundry/bag-scanner"
// Bag QR labels go through the SAME thermal-label engine as garment barcodes:
// same TE244, same 50 x 38.1mm stock, same saved workstation configuration.
// There is no separate bag printer setup, and there must never be one.
import { printBagLabels } from "@/lib/laundry-label"
import {
  humanStatus, humanCustodian, humanCondition, humanEvent, isKnownStatus,
  BAG_STATUS, CUSTODIAN, BAG_CONDITION, type BagInventory,
} from "@/lib/laundry-bag-lifecycle"

interface Bag {
  id: string; bagNumber: string; qrValue: string; status: string; condition: string
  currentCustodianType: string; currentCustodianName: string | null
  currentCustomerId: string | null; currentCustomerName: string | null
  currentStoreId: string | null; currentOrderId: string | null; currentOrderNumber: string | null
  handedToCustomerAt: string | null; qrDamaged: boolean; active: boolean
  lastUsedAt: string | null; lastReturnedAt: string | null; totalUsageCount: number
  updatedAt: string; createdAt: string; notes: string | null
}
interface Usage {
  id: string; orderId: string; orderNumber: string | null; customerName: string | null
  assignedAt: string; pickupDate: string | null; deliveredDate: string | null
  returnDate: string | null; returnedAt: string | null; returnStatus: string | null
  conditionAtReturn: string | null; status: string
}
interface BagEvent {
  id: string; action: string; previousStatus: string | null; newStatus: string | null
  previousCustodianType: string | null; newCustodianType: string | null
  orderNumber: string | null; customerName: string | null; condition: string | null
  reason: string | null; actorName: string | null; actorRole: string | null; createdAt: string
}

const fmt = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

// Tone carries meaning: green = usable stock, blue = in the cycle, violet = out
// with a customer (accounted for, NOT a problem), amber = needs attention,
// rose = unusable.
const STATUS_TONE: Record<string, string> = {
  [BAG_STATUS.AVAILABLE]: "border-emerald-300 text-emerald-700 bg-emerald-50",
  [BAG_STATUS.HANDED_TO_CUSTOMER]: "border-violet-300 text-violet-700 bg-violet-50",
  [BAG_STATUS.RETURNED_BY_CUSTOMER]: "border-sky-300 text-sky-700 bg-sky-50",
  [BAG_STATUS.INSPECTION_REQUIRED]: "border-amber-300 text-amber-700 bg-amber-50",
  [BAG_STATUS.DAMAGED]: "border-rose-300 text-rose-700 bg-rose-50",
  [BAG_STATUS.LOST]: "border-rose-300 text-rose-700 bg-rose-50",
  [BAG_STATUS.RETIRED]: "border-slate-300 text-slate-600 bg-slate-100",
}
const tone = (s: string) => STATUS_TONE[s] || "border-blue-300 text-blue-700 bg-blue-50"

// The ten operational buckets, in the order a manager reads them. `retired` is
// shown but sits outside active inventory, and `unclassified` only appears when
// the data actually contains one — a zero there is not worth a tile.
const BUCKETS: { key: keyof BagInventory; label: string; hint: string; accent: string }[] = [
  { key: "available", label: "Available", hint: "Ready to issue", accent: "text-emerald-700" },
  { key: "withExecutives", label: "With Executives", hint: "In the field", accent: "text-blue-700" },
  { key: "atStore", label: "At Store", hint: "On premises", accent: "text-blue-700" },
  { key: "atProcessingCenter", label: "Processing Center", hint: "In processing", accent: "text-blue-700" },
  { key: "outForDelivery", label: "Out for Delivery", hint: "On a delivery run", accent: "text-blue-700" },
  { key: "withCustomers", label: "With Customers", hint: "Held by customers", accent: "text-violet-700" },
  { key: "inspectionRequired", label: "Inspection Required", hint: "Returned, needs a check", accent: "text-amber-700" },
  { key: "damaged", label: "Damaged", hint: "Not usable", accent: "text-rose-700" },
  { key: "lost", label: "Lost", hint: "Location unknown", accent: "text-rose-700" },
  { key: "retired", label: "Retired", hint: "Out of circulation", accent: "text-slate-600" },
]

const STATUS_FILTERS = [
  BAG_STATUS.AVAILABLE, BAG_STATUS.COLLECTED, BAG_STATUS.RECEIVED_AT_STORE, BAG_STATUS.PROCESSING,
  BAG_STATUS.READY_FOR_DELIVERY, BAG_STATUS.OUT_FOR_DELIVERY, BAG_STATUS.HANDED_TO_CUSTOMER,
  BAG_STATUS.RETURNED_BY_CUSTOMER, BAG_STATUS.INSPECTION_REQUIRED, BAG_STATUS.DAMAGED,
  BAG_STATUS.LOST, BAG_STATUS.RETIRED,
]
const CUSTODIAN_FILTERS = [CUSTODIAN.STORE, CUSTODIAN.PROCESSING_CENTER, CUSTODIAN.DELIVERY_EXECUTIVE, CUSTODIAN.CUSTOMER]
const CONDITION_FILTERS = [BAG_CONDITION.GOOD, BAG_CONDITION.MINOR_DAMAGE, BAG_CONDITION.DAMAGED, BAG_CONDITION.HEAVILY_DAMAGED, BAG_CONDITION.UNUSABLE]

export function LaundryBagManagement() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage, setSelectedOrderId, setLaundryFocusCustomerId } = useAdminStore()

  const [bags, setBags] = useState<Bag[]>([])
  const [inventory, setInventory] = useState<BagInventory | null>(null)
  const [activeTotal, setActiveTotal] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [bucket, setBucket] = useState<string>("ALL")
  const [status, setStatus] = useState("ALL")
  const [custodian, setCustodian] = useState("ALL")
  const [condition, setCondition] = useState("ALL")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")

  const [detailId, setDetailId] = useState<string | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genCount, setGenCount] = useState("50")
  const [canManage, setCanManage] = useState(false)
  const [manualReleaseTarget, setManualReleaseTarget] = useState<Bag | null>(null)
  const [manualReleaseReason, setManualReleaseReason] = useState("")

  useEffect(() => {
    if (!currentBusinessId) return
    fetch(`/api/laundry/rbac/me?businessId=${currentBusinessId}`).then((r) => r.json()).then((j) => {
      if (j.success) setCanManage(j.data.isOwner || j.data.permissions?.includes("laundry.bags.manual_release"))
    }).catch(() => undefined)
  }, [currentBusinessId])

  // Typing must not fire a query per keystroke against a six-figure table.
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ businessId: currentBusinessId, page: String(page), pageSize: "50" })
      if (bucket !== "ALL") p.set("bucket", bucket)
      if (status !== "ALL") p.set("status", status)
      if (custodian !== "ALL") p.set("custodian", custodian)
      if (condition !== "ALL") p.set("condition", condition)
      if (debounced) p.set("search", debounced)
      const j = await fetch(`/api/laundry/bags?${p}`).then((r) => r.json())
      setBags(j.data || []); setInventory(j.inventory || null); setActiveTotal(j.activeTotal || 0)
      setTotal(j.total || 0); setTotalPages(j.totalPages || 1)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, page, bucket, status, custodian, condition, debounced])
  useEffect(() => { load() }, [load])

  const pickBucket = (key: string) => {
    setBucket((b) => (b === key ? "ALL" : key))
    setStatus("ALL"); setCustodian("ALL"); setCondition("ALL"); setPage(1)
  }

  const generate = async () => {
    setBusy(true)
    try {
      const j = await fetch("/api/laundry/bags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, count: Number(genCount) || 0 }) }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success(`${j.data.length} bags created`)
      setGenOpen(false); load()
      if (confirm(`Print labels for the ${j.data.length} new bags now?`)) printBagLabels(j.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  // ── Row actions ───────────────────────────────────────────────────────────
  // Every one of these still exists; what changed is HOW they take effect. None
  // writes a status directly any more:
  //   Mark Damaged / Reactivate  →  an inspection CONDITION decision
  //   Mark Lost / Retire         →  a terminal decision (lifecycle service)
  //   Release Bag                →  the existing audited manual release
  // So each lands in the bag's append-only history, and none can flip a bag that
  // is with a customer back into stock — that bag must be RECEIVED (§18).
  const STATUS_CONFIRM: Record<string, { title: string; body: string }> = {
    DAMAGED: { title: "Mark Bag as Damaged?", body: "will no longer be available for assignment." },
    LOST: { title: "Mark Bag as Lost?", body: "will be removed from active availability." },
    AVAILABLE: { title: "Reactivate Bag?", body: "will go back into service and can be assigned to an order." },
    RETIRED: { title: "Retire Bag?", body: "will be permanently removed from circulation." },
  }

  const runAction = async (bag: Bag, action: "DAMAGED" | "LOST" | "AVAILABLE" | "RETIRED") => {
    // These sit next to each other in a menu; a mis-click must never take a bag
    // out of service silently.
    const c = STATUS_CONFIRM[action]
    if (c && !window.confirm(`${c.title}\n\n${bag.bagNumber} ${c.body}`)) return
    setBusy(true)
    try {
      // Condition decisions go to the inspection endpoint, which shares the ONE
      // condition→status rule with customer returns.
      const isCondition = action === "DAMAGED" || action === "AVAILABLE"
      const res = isCondition
        ? await fetch(`/api/laundry/bags/${bag.id}/inspect`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ condition: action === "DAMAGED" ? BAG_CONDITION.DAMAGED : BAG_CONDITION.GOOD }),
          })
        : await fetch(`/api/laundry/bags/${bag.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action }),
          })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(`${bag.bagNumber} → ${humanStatus(j.data?.status || action)}`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  const submitManualRelease = async () => {
    if (!manualReleaseTarget || !manualReleaseReason.trim()) return
    setBusy(true)
    try {
      const res = await fetch("/api/laundry/bags/manual-release", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, bagId: manualReleaseTarget.id, reason: manualReleaseReason.trim() }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(`${manualReleaseTarget.bagNumber} released`)
      setManualReleaseTarget(null); setManualReleaseReason(""); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  const handleReturnScan = async (code: string) => {
    setBusy(true)
    try {
      // Delivery chain of custody FIRST: if this bag is out for a completed
      // delivery, close it and release it. Unchanged from before.
      const drRes = await fetch("/api/laundry/bags/delivery-return", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, code }),
      })
      const dr = await drRes.json().catch(() => ({}))
      if (dr.success) { toast.success(`Delivery bag ${dr.data.bagNumber} received — ${dr.data.orderNumber}`); load(); return }
      if (drRes.status === 409) { toast.error(dr.error || "Already returned"); load(); return }
      const res = await fetch("/api/laundry/bags/return", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, code }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(`Bag ${code} returned → Available`); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to release bag") }
    finally { setBusy(false) }
  }

  if (detailId) {
    return <BagDetail bagId={detailId} canManage={canManage} onBack={() => { setDetailId(null); load() }}
      onOpenOrder={(id) => { setSelectedOrderId(id); setLaundryPage("order-detail") }}
      onOpenCustomer={(id) => { setLaundryFocusCustomerId(id); setLaundryPage("customers") }} />
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" /> Bags
          </h1>
          <p className="text-sm text-slate-500">Where every physical bag is right now — including the ones with customers.</p>
        </div>
        <div className="flex gap-2">
          <BagScanButton onScan={handleReturnScan} label="Scan Returned Bag" />
          <Button variant="outline" className="gap-1" onClick={() => setGenOpen(true)}><Plus className="h-4 w-4" /> Generate Bags</Button>
        </div>
      </div>

      {/* ── Inventory census ─────────────────────────────────────────────────
          Counted by the domain, not here. Clicking a tile filters the table to
          exactly the rows that tile counted. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {BUCKETS.map((b) => {
          const n = inventory?.[b.key] ?? 0
          const on = bucket === b.key
          return (
            <button key={b.key} onClick={() => pickBucket(b.key as string)}
              className={`rounded-xl border p-3 text-left transition ${on ? "border-blue-500 ring-1 ring-blue-200 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{b.label}</p>
              <p className={`text-2xl font-bold ${b.accent}`}>{n}</p>
              <p className="text-[10px] text-slate-400">{b.hint}</p>
            </button>
          )
        })}
      </div>

      {/* Reconciliation, stated rather than implied. Retired sits outside active
          inventory; an unclassified bag is surfaced instead of being absorbed. */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
        <span><span className="font-semibold text-slate-700">{activeTotal}</span> active bags</span>
        <span className="text-slate-300">·</span>
        <span><span className="font-semibold text-slate-700">{inventory?.total ?? 0}</span> registered</span>
        <span className="text-slate-300">·</span>
        <span>{inventory?.retired ?? 0} retired (excluded from active)</span>
        {!!inventory?.unclassified && (
          <button onClick={() => pickBucket("unclassified")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800">
            <ShieldQuestion className="h-3.5 w-3.5" />
            {inventory.unclassified} unclassified — data review required
          </button>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm"
              placeholder="Bag code, QR, customer name, mobile or order number…" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setBucket("ALL"); setPage(1) }}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{humanStatus(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={custodian} onValueChange={(v) => { setCustodian(v); setBucket("ALL"); setPage(1) }}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Custodian" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All custodians</SelectItem>
              {CUSTODIAN_FILTERS.map((c) => <SelectItem key={c} value={c}>{humanCustodian(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={condition} onValueChange={(v) => { setCondition(v); setBucket("ALL"); setPage(1) }}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Condition" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All conditions</SelectItem>
              {CONDITION_FILTERS.map((c) => <SelectItem key={c} value={c}>{humanCondition(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          {(bucket !== "ALL" || status !== "ALL" || custodian !== "ALL" || condition !== "ALL" || debounced) && (
            <Button variant="ghost" size="sm" className="text-slate-500"
              onClick={() => { setBucket("ALL"); setStatus("ALL"); setCustodian("ALL"); setCondition("ALL"); setSearch(""); setPage(1) }}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bag</TableHead><TableHead>Status</TableHead><TableHead>Custodian</TableHead>
                  <TableHead>Customer</TableHead><TableHead>Condition</TableHead>
                  <TableHead>Current / Last Order</TableHead><TableHead>Last Movement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-14 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>
                ) : bags.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-14 text-center text-sm text-slate-400">No bags match this view.</TableCell></TableRow>
                ) : bags.map((b) => (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailId(b.id)}>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold text-slate-800">{b.bagNumber}</span>
                      {b.qrDamaged && <Badge variant="outline" className="ml-1.5 text-[9px] border-amber-300 text-amber-700 bg-amber-50">QR damaged</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${tone(b.status)}`}>{humanStatus(b.status)}</Badge>
                      {!isKnownStatus(b.status) && <Badge variant="outline" className="ml-1 text-[9px] border-amber-300 text-amber-700 bg-amber-50">review</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{humanCustodian(b.currentCustodianType)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{b.currentCustomerName || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-600">{humanCondition(b.condition)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-500">{b.currentOrderNumber || "—"}</TableCell>
                    <TableCell className="text-[11px] text-slate-400">{fmt(b.updatedAt)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 gap-1">Actions <ChevronDown className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => setDetailId(b.id)}><History className="h-4 w-4 mr-2" /> View History</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => printBagLabels([b])}><Printer className="h-4 w-4 mr-2" /> Print QR</DropdownMenuItem>
                          {canManage && <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={busy} onClick={() => setManualReleaseTarget(b)}><RotateCcw className="h-4 w-4 mr-2" /> Release Bag</DropdownMenuItem>
                            {b.status !== BAG_STATUS.DAMAGED && (
                              <DropdownMenuItem disabled={busy} onClick={() => runAction(b, "DAMAGED")}><Wrench className="h-4 w-4 mr-2" /> Mark Damaged</DropdownMenuItem>
                            )}
                            {b.status !== BAG_STATUS.LOST && (
                              <DropdownMenuItem disabled={busy} className="text-rose-600" onClick={() => runAction(b, "LOST")}><XCircle className="h-4 w-4 mr-2" /> Mark Lost</DropdownMenuItem>
                            )}
                            {b.status !== BAG_STATUS.AVAILABLE && b.status !== BAG_STATUS.HANDED_TO_CUSTOMER && (
                              <DropdownMenuItem disabled={busy} onClick={() => runAction(b, "AVAILABLE")}><Package className="h-4 w-4 mr-2" /> Reactivate Bag</DropdownMenuItem>
                            )}
                            {b.status !== BAG_STATUS.RETIRED && (
                              <DropdownMenuItem disabled={busy} className="text-slate-600" onClick={() => runAction(b, "RETIRED")}><Archive className="h-4 w-4 mr-2" /> Retire Bag</DropdownMenuItem>
                            )}
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Server-side paging — the browser never holds the full inventory. */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total} bag{total === 1 ? "" : "s"} · page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={!!manualReleaseTarget} onOpenChange={(o) => { if (!o) { setManualReleaseTarget(null); setManualReleaseReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-blue-600" /> Release Bag</DialogTitle>
            <DialogDescription>
              Returns <span className="font-mono font-semibold">{manualReleaseTarget?.bagNumber}</span> to available stock. A reason is
              required because this is an administrative override of the normal flow, and it is written to the bag&apos;s history.
            </DialogDescription>
          </DialogHeader>
          <Input value={manualReleaseReason} onChange={(e) => setManualReleaseReason(e.target.value)} placeholder="Why is this bag being released?" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setManualReleaseTarget(null); setManualReleaseReason("") }}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1" disabled={busy || !manualReleaseReason.trim()} onClick={submitManualRelease}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /> Generate Bags</DialogTitle>
            <DialogDescription>Creates permanent BAG-NNNNNN codes. The QR belongs to the physical bag and is printed once.</DialogDescription>
          </DialogHeader>
          <Input type="number" min={1} max={1000} value={genCount} onChange={(e) => setGenCount(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-1" disabled={busy} onClick={generate}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Bag Detail ───────────────────────────────────────────────────────────────

function BagDetail({ bagId, canManage, onBack, onOpenOrder, onOpenCustomer }: {
  bagId: string; canManage: boolean; onBack: () => void
  onOpenOrder: (id: string) => void; onOpenCustomer: (id: string) => void
}) {
  const [data, setData] = useState<(Bag & {
    assignments: Usage[]; events: BagEvent[]
    customer: { id: string; name: string; phone: string | null } | null
    store: { id: string; storeName: string } | null
  }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<string>("")
  const [inspectOpen, setInspectOpen] = useState(false)
  const [inspectCondition, setInspectCondition] = useState<string>(BAG_CONDITION.GOOD)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch(`/api/laundry/bags/${bagId}`).then((r) => r.json())
      if (j.success) {
        setData(j.data)
        QRCode.toDataURL(j.data.qrValue, { width: 180, margin: 1 }).then(setQr).catch(() => undefined)
      }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [bagId])
  useEffect(() => { load() }, [load])

  const inspect = async () => {
    setBusy(true)
    try {
      const j = await fetch(`/api/laundry/bags/${bagId}/inspect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: inspectCondition }),
      }).then((r) => r.json())
      if (!j.success) throw new Error(j.error || "Failed")
      toast.success(`${j.data.bagNumber} → ${humanStatus(j.data.status)}`)
      setInspectOpen(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") } finally { setBusy(false) }
  }

  if (loading || !data) {
    return <div className="flex items-center justify-center py-24 text-slate-400 gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading bag…</div>
  }

  const withCustomer = data.status === BAG_STATUS.HANDED_TO_CUSTOMER

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 font-mono">{data.bagNumber}</h1>
          <p className="text-sm text-slate-500">{data.totalUsageCount} completed usage{data.totalUsageCount === 1 ? "" : "s"} · created {fmtDate(data.createdAt)}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${tone(data.status)}`}>{humanStatus(data.status)}</Badge>
      </div>

      {/* The current state, said plainly. A bag with a customer is a normal,
          accounted-for outcome — it is never framed as missing. */}
      {withCustomer && (
        <Card className="rounded-xl border-violet-200 bg-violet-50/40">
          <CardContent className="p-4 flex items-start gap-3 flex-wrap">
            <User className="h-5 w-5 text-violet-600 mt-0.5" />
            <div className="flex-1 min-w-[220px]">
              <p className="text-[11px] uppercase tracking-wide text-violet-500">With Customer</p>
              <button disabled={!data.customer} onClick={() => data.customer && onOpenCustomer(data.customer.id)}
                className="text-lg font-semibold text-slate-800 hover:text-violet-700 disabled:hover:text-slate-800 text-left">
                {data.customer?.name || data.currentCustomerName || "Unknown customer"}
              </button>
              {data.customer?.phone && <p className="text-xs text-slate-500">{data.customer.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Handed over</p>
              <p className="text-sm font-medium text-slate-700">{fmtDate(data.handedToCustomerAt)}</p>
              {data.currentOrderNumber && (
                <button onClick={() => data.currentOrderId && onOpenOrder(data.currentOrderId)}
                  className="font-mono text-xs text-blue-600 hover:underline">{data.currentOrderNumber}</button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="rounded-xl border-slate-200">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { l: "Status", v: humanStatus(data.status) },
              { l: "Custodian", v: humanCustodian(data.currentCustodianType) },
              { l: "Held by", v: data.currentCustodianName || "—" },
              { l: "Customer", v: data.customer?.name || data.currentCustomerName || "—" },
              { l: "Store", v: data.store?.storeName || "—" },
              { l: "Condition", v: humanCondition(data.condition) },
              { l: "Created", v: fmtDate(data.createdAt) },
              { l: "Last movement", v: fmt(data.updatedAt) },
              { l: "Last returned", v: fmtDate(data.lastReturnedAt) },
            ].map((f) => (
              <div key={f.l}>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{f.l}</p>
                <p className="font-medium text-slate-800">{f.v}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200">
          <CardContent className="p-4 flex flex-col items-center gap-2">
            {qr ? <img src={qr} alt="" width={150} height={150} className="rounded" /> : <div className="h-[150px] w-[150px] bg-slate-100 rounded" />}
            <p className="font-mono text-sm font-bold text-slate-800">{data.bagNumber}</p>
            {data.qrDamaged ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 gap-1"><AlertTriangle className="h-3 w-3" /> QR Damaged</Badge>
            ) : (
              <p className="text-[11px] text-slate-400">Permanent QR · printed once</p>
            )}
            <Button variant="outline" size="sm" className="gap-1 mt-1" onClick={() => printBagLabels([data])}>
              <Printer className="h-3.5 w-3.5" /> Reprint Label
            </Button>
            {canManage && data.status === BAG_STATUS.INSPECTION_REQUIRED && (
              <Button size="sm" className="gap-1 bg-amber-600 hover:bg-amber-700 text-white w-full" onClick={() => setInspectOpen(true)}>
                <Wrench className="h-3.5 w-3.5" /> Record Inspection
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Usage history: one row per order, never rewritten ─────────────── */}
      <Card className="rounded-xl border-slate-200">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><RotateCcw className="h-4 w-4 text-blue-600" /> Usage History</h2>
            <p className="text-[11px] text-slate-400">Every order this physical bag has carried. Reuse adds a row; nothing is overwritten.</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Issued</TableHead>
                <TableHead>Delivered</TableHead><TableHead>Returned</TableHead><TableHead>Condition</TableHead><TableHead>Outcome</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.assignments.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-slate-400">This bag has not carried an order yet.</TableCell></TableRow>
                ) : data.assignments.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <button onClick={() => onOpenOrder(u.orderId)} className="font-mono text-xs text-blue-600 hover:underline">{u.orderNumber || "—"}</button>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{u.customerName || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDate(u.assignedAt)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDate(u.deliveredDate)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{fmtDate(u.returnDate || u.returnedAt)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{u.conditionAtReturn ? humanCondition(u.conditionAtReturn) : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{humanStatus(u.returnStatus || u.status)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Event history: the physical journey, newest first ─────────────── */}
      <Card className="rounded-xl border-slate-200">
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-3"><StoreIcon className="h-4 w-4 text-blue-600" /> Movement History</h2>
          {data.events.length === 0 ? (
            <p className="text-sm text-slate-400">No movements recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {data.events.map((e, i, arr) => (
                <div key={e.id} className="relative flex gap-3 pb-4">
                  {i < arr.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-slate-200" />}
                  <div className={`h-[15px] w-[15px] rounded-full border-2 shrink-0 mt-0.5 ${
                    e.newStatus === BAG_STATUS.HANDED_TO_CUSTOMER ? "border-violet-500 bg-violet-100"
                    : e.newStatus === BAG_STATUS.AVAILABLE ? "border-emerald-500 bg-emerald-100"
                    : "border-blue-500 bg-blue-100"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{humanEvent(e.action)}</p>
                    <p className="text-[11px] text-slate-400">
                      {fmt(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ""}
                      {e.actorRole ? ` (${humanCustodian(e.actorRole)})` : ""}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {humanStatus(e.previousStatus)} → {humanStatus(e.newStatus)}
                      {e.previousCustodianType !== e.newCustodianType && e.newCustodianType
                        ? ` · ${humanCustodian(e.previousCustodianType)} → ${humanCustodian(e.newCustodianType)}` : ""}
                    </p>
                    {(e.orderNumber || e.customerName || e.condition) && (
                      <p className="text-[11px] text-slate-500">
                        {[e.orderNumber, e.customerName, e.condition ? humanCondition(e.condition) : null].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {e.reason && <p className="text-[11px] text-slate-500 italic">{e.reason}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-amber-600" /> Record Inspection</DialogTitle>
            <DialogDescription>
              The condition decides where the bag goes — Good returns it to stock, anything worse keeps it out of circulation.
            </DialogDescription>
          </DialogHeader>
          <Select value={inspectCondition} onValueChange={setInspectCondition}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONDITION_FILTERS.map((c) => <SelectItem key={c} value={c}>{humanCondition(c)}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-1" disabled={busy} onClick={inspect}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
