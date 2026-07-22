"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Truck, Navigation, ShoppingBag,
  Clock, Search, RefreshCw, History as HistoryIcon, ChevronLeft, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"

interface Exec {
  id: string; name: string; mobile: string | null
  availability: string; isActive: boolean; isLocked: boolean
  vehicleType: string | null; vehicleNumber: string | null
  todaysPickups: number; todaysDeliveries: number
}

interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  address: string | null; landmark: string | null; mapsLink: string | null
  lat: number | null; lng: number | null
  services: string[]; bagCount: number
  executiveId: string | null; executiveName: string | null; vehicle: string | null
  acceptance: string | null; assignedAt: string | null; acceptedAt: string | null; completedAt: string | null
  scheduledDate: string | null
  bucket: string
}

interface HistoryJob extends Job {
  storeName: string | null; requestedAt: string | null; createdAt: string | null; reason: string | null
}

const OPS_TABS = [
  { key: "awaiting", label: "Pending" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed Today" },
] as const

const HISTORY_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7d", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "custom", label: "Custom Range" },
] as const

const isOverdue = (job: Job) => {
  if (job.completedAt || job.bucket === "completed" || job.bucket === "cancelled") return false
  if (!job.scheduledDate) return false
  const now = new Date()
  const sched = new Date(job.scheduledDate)
  const endOfSchedDay = new Date(sched); endOfSchedDay.setHours(23, 59, 59, 999)
  return now > endOfSchedDay
}

const BUCKET_STYLES: Record<string, string> = {
  awaiting: "border-amber-200 text-amber-700 bg-amber-50",
  assigned: "border-blue-200 text-blue-700 bg-blue-50",
  accepted: "border-indigo-200 text-indigo-700 bg-indigo-50",
  completed: "border-emerald-200 text-emerald-700 bg-emerald-50",
  cancelled: "border-slate-200 text-slate-400 bg-slate-50",
  rejected: "border-rose-200 text-rose-600 bg-rose-50",
  failed: "border-orange-200 text-orange-600 bg-orange-50",
}

const BUCKET_LABELS: Record<string, string> = {
  awaiting: "Pending", assigned: "Assigned", accepted: "In Progress", completed: "Done",
  cancelled: "Cancelled", rejected: "Rejected", failed: "Failed",
}

export function LaundryPickupScheduler({ mode = "pickup" }: { mode?: "pickup" | "delivery" }) {
  const isDelivery = mode === "delivery"
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage, setSelectedOrderId } = useAdminStore()

  // Operations state
  const [opsJobs, setOpsJobs] = useState<Job[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [execs, setExecs] = useState<Exec[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("awaiting")
  const [opsSearch, setOpsSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const initialLoad = useRef(true)

  // History state
  const [histView, setHistView] = useState(false)
  const [histJobs, setHistJobs] = useState<HistoryJob[]>([])
  const [histTotal, setHistTotal] = useState(0)
  const [histPage, setHistPage] = useState(0)
  const [histPreset, setHistPreset] = useState("last7d")
  const [histFrom, setHistFrom] = useState("")
  const [histTo, setHistTo] = useState("")
  const [histSearch, setHistSearch] = useState("")
  const [histLoading, setHistLoading] = useState(false)
  const HIST_LIMIT = 50

  // ── Load operations ─────────────────────────────────────────────────────
  const loadOps = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, type: mode, scope: "active" })
      if (tab !== "awaiting") params.set("tab", tab)
      if (opsSearch) params.set("search", opsSearch)

      const [s, e] = await Promise.all([
        fetch(`/api/laundry/pickup-scheduler?${params}`).then((r) => r.json()),
        fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      if (s.success) { setOpsJobs(s.data); setCounts(s.counts || {}) }
      if (e.success) setExecs(e.data)
    } catch (err) { console.error("[loadOps]", err) }
  }, [currentBusinessId, mode, tab, opsSearch])

  // ── Load history ────────────────────────────────────────────────────────
  const loadHist = useCallback(async () => {
    if (!currentBusinessId) return
    setHistLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, type: mode, scope: "history", datePreset: histPreset, page: String(histPage), limit: String(HIST_LIMIT) })
      if (histPreset === "custom" && histFrom) params.set("fromDate", histFrom)
      if (histPreset === "custom" && histTo) params.set("toDate", histTo)
      if (histSearch) params.set("search", histSearch)

      const s = await fetch(`/api/laundry/pickup-scheduler?${params}`).then((r) => r.json())
      if (s.success) { setHistJobs(s.data); setHistTotal(s.total || 0) }
    } catch (err) { console.error("[loadHist]", err) } finally { setHistLoading(false) }
  }, [currentBusinessId, mode, histPreset, histFrom, histTo, histPage, histSearch])

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([loadOps(), histView ? loadHist() : Promise.resolve()]).finally(() => {
      if (initialLoad.current) { initialLoad.current = false; setLoading(false) }
    })
  }, [currentBusinessId])

  useEffect(() => {
    if (!currentBusinessId || initialLoad.current) return
    loadOps()
  }, [tab, opsSearch])

  useEffect(() => {
    if (!currentBusinessId || initialLoad.current || !histView) return
    loadHist()
  }, [histPreset, histFrom, histTo, histPage, histSearch, histView])

  // ── Auto-refresh every 30s (ops only) ────────────────────────────────────
  useEffect(() => {
    if (!currentBusinessId || histView) return
    const interval = setInterval(() => loadOps(), 30000)
    return () => clearInterval(interval)
  }, [currentBusinessId, histView, loadOps])

  // ── Assignment ──────────────────────────────────────────────────────────
  const assign = async (job: Job, executiveId: string | null) => {
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: job.id, type: mode, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? "Assigned" : "Cleared")
      loadOps()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  const bulkAssign = async (executiveId: string | null) => {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!executiveId && !confirm("Clear assignments for all selected?")) return
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderIds: ids, type: mode, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? `Assigned ${ids.length} jobs` : `Cleared ${ids.length} assignments`)
      setSelected(new Set())
      loadOps()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  const allSelected = opsJobs.length > 0 && opsJobs.every((j) => selected.has(j.id))
  const toggleAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(opsJobs.map((j) => j.id))) }
  const toggleOne = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const histPages = Math.max(1, Math.ceil(histTotal / HIST_LIMIT))

  return (
    <div className="px-2 lg:px-4 py-2 space-y-2 max-w-full">
      {/* Mode toggle */}
      <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => { setHistView(false); setSelected(new Set()) }}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!histView ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <Truck className="h-3 w-3 inline mr-1" /> Operations
        </button>
        <button onClick={() => { setHistView(true); setHistPage(0); setSelected(new Set()) }}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${histView ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          <HistoryIcon className="h-3 w-3 inline mr-1" /> History
        </button>
      </div>

      {/* ═════════════════════════════ OPERATIONS ════════════════════════════ */}
      {!histView && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { label: "Pending", value: counts.awaiting || 0, color: "text-amber-600 bg-amber-50 border-amber-200" },
              { label: "Assigned", value: counts.assigned || 0, color: "text-blue-600 bg-blue-50 border-blue-200" },
              { label: "Accepted", value: counts.accepted || 0, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
              { label: "Completed", value: (counts.completed || 0), color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
              { label: "Total", value: counts.total || 0, color: "text-slate-700 bg-slate-50 border-slate-200" },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border ${s.color} px-2 py-1.5 text-center`}>
                <p className="text-lg font-bold tabular-nums leading-none">{s.value}</p>
                <p className="text-[9px] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search + Tabs */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input placeholder="Search order / customer / phone ..."
                value={opsSearch} onChange={(e) => setOpsSearch(e.target.value)}
                className="h-7 pl-7 text-xs" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 justify-end">
              {OPS_TABS.map((t) => (
                <button key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()) }}
                  className={`h-6 whitespace-nowrap px-2 rounded text-[10px] font-medium border transition-colors shrink-0 ${tab === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                  {t.label}
                  {counts[t.key] != null ? <span className={`ml-1 text-[9px] ${tab === t.key ? "text-blue-100" : "text-slate-400"}`}>{counts[t.key]}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk toolbar */}
          {selected.size > 0 && (
            <Card className="rounded-lg border-blue-200 bg-blue-50">
              <CardContent className="p-1.5 flex items-center gap-1.5 flex-wrap">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
                <span className="text-[10px] font-medium text-blue-800 min-w-[60px]">{selected.size} Selected</span>
                <select onChange={(e) => { if (e.target.value) bulkAssign(e.target.value) }}
                  className="h-6 text-[10px] rounded border border-blue-200 px-1 bg-white flex-1 min-w-0 max-w-[140px]" defaultValue="">
                  <option value="" disabled>Assign to...</option>
                  {execs.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => bulkAssign(null)}>
                  Unassign
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-500 px-1 ml-auto"
                  onClick={() => setSelected(new Set())}>Clear</Button>
              </CardContent>
            </Card>
          )}

          {/* Cards */}
          {loading ? (
            <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
          ) : opsJobs.length === 0 ? (
            <Card className="rounded-lg border-slate-200"><CardContent className="py-8 text-center text-slate-400 text-[10px]">
              No {isDelivery ? "deliveries" : "pickups"} for today.
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {opsJobs.map((job) => (
                <Card key={job.id} className={`rounded-lg border ${selected.has(job.id) ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"} transition-colors cursor-pointer hover:border-slate-300`} onClick={() => { setSelectedOrderId(job.id); setLaundryPage("order-detail") }}>
                  <CardContent className="p-1.5 flex items-center gap-1.5">
                    <Checkbox checked={selected.has(job.id)} onCheckedChange={() => toggleOne(job.id)} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                    <div className="flex items-center gap-1 text-[10px] min-w-0 flex-1 flex-wrap">
                      <span className="font-mono font-bold text-slate-800 shrink-0">{job.orderNumber}</span>
                      <span className="text-slate-700 truncate max-w-[100px] lg:max-w-[140px]">{job.customerName}</span>
                      {job.customerPhone && <span className="text-slate-400 shrink-0 hidden xs:inline">{job.customerPhone}</span>}
                      {job.address && <span className="text-slate-400 truncate max-w-[80px] lg:max-w-[120px] hidden md:inline">{job.address}</span>}
                      {job.timeSlot && <span className="text-slate-400 shrink-0 hidden lg:inline flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{job.timeSlot}</span>}
                      {isOverdue(job) && <Badge variant="outline" className="text-[9px] leading-none px-1 h-4 shrink-0 border-red-300 text-red-600 bg-red-50 shrink-0">OVERDUE</Badge>}
                      {job.bagCount > 0 && <span className="text-slate-400 shrink-0 hidden lg:inline flex items-center gap-0.5"><ShoppingBag className="h-2.5 w-2.5" />{job.bagCount}</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <select
                        value={job.executiveId || ""}
                        onChange={(e) => assign(job, e.target.value || null)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 text-[10px] w-20 lg:w-24 rounded border border-slate-200 px-1 bg-white">
                        <option value="">—</option>
                        {execs.map((ex) => (
                          <option key={ex.id} value={ex.id}>{ex.name}</option>
                        ))}
                      </select>
                      {job.executiveName && <span className="text-[9px] text-slate-500 hidden lg:inline">{job.executiveName}</span>}
                      <Badge variant="outline" className={`text-[9px] leading-none px-1 h-4 shrink-0 ${BUCKET_STYLES[job.bucket] || "border-slate-200 text-slate-400"}`}>
                        {BUCKET_LABELS[job.bucket] || job.bucket}
                      </Badge>
                      {(job.mapsLink || (job.lat && job.lng)) && (
                        <a href={job.mapsLink || `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
                          target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 shrink-0" title="Navigate"
                          onClick={(e) => e.stopPropagation()}>
                          <Navigation className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <span><RefreshCw className="h-2.5 w-2.5 inline mr-0.5" />Auto-refresh 30s</span>
            <span>{opsJobs.length} job{opsJobs.length !== 1 ? "s" : ""}</span>
          </div>
        </>
      )}

      {/* ═════════════════════════════ HISTORY ════════════════════════════════ */}
      {histView && (
        <>
          <div className="flex items-center gap-1 flex-wrap">
            {HISTORY_PRESETS.map((p) => (
              <button key={p.key} onClick={() => { setHistPreset(p.key); setHistPage(0) }}
                className={`h-6 px-2 rounded text-[10px] font-medium border transition-colors ${histPreset === p.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {p.label}
              </button>
            ))}
            {histPreset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={histFrom} onChange={(e) => { setHistFrom(e.target.value); setHistPage(0) }} className="h-6 w-28 text-[10px]" />
                <span className="text-[10px] text-slate-400">→</span>
                <Input type="date" value={histTo} onChange={(e) => { setHistTo(e.target.value); setHistPage(0) }} className="h-6 w-28 text-[10px]" />
              </div>
            )}
          </div>

          <div className="relative max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input placeholder="Search order / customer / phone / executive ..."
              value={histSearch} onChange={(e) => { setHistSearch(e.target.value); setHistPage(0) }}
              className="h-7 pl-7 text-xs" />
          </div>

          {histLoading ? (
            <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
          ) : histJobs.length === 0 ? (
            <Card className="rounded-lg border-slate-200"><CardContent className="py-8 text-center text-slate-400 text-[10px]">
              No history for this period.
            </CardContent></Card>
          ) : (
            <>
              <div className="space-y-1">
                  {histJobs.map((job) => (
                  <Card key={job.id} className="rounded-lg border-slate-100 bg-slate-50/60 cursor-pointer hover:border-slate-300" onClick={() => { setSelectedOrderId(job.id); setLaundryPage("order-detail") }}>
                    <CardContent className="p-1.5 flex items-center gap-1.5">
                      <div className="flex items-center gap-1 text-[10px] min-w-0 flex-1 flex-wrap">
                        <span className="font-mono font-bold text-slate-600 shrink-0">{job.orderNumber}</span>
                        <span className="text-slate-600 truncate max-w-[120px]">{job.customerName}</span>
                        {job.customerPhone && <span className="text-slate-400 shrink-0">{job.customerPhone}</span>}
                        {job.storeName && <span className="text-slate-400 hidden sm:inline truncate max-w-[80px]">{job.storeName}</span>}
                        {job.executiveName && <span className="text-slate-500 hidden md:inline">{job.executiveName}</span>}
                        {job.completedAt && <span className="text-slate-400 hidden lg:inline">{new Date(job.completedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        {job.reason && <span className="text-rose-500 truncate max-w-[100px]" title={job.reason}>{job.reason}</span>}
                      </div>
                      <Badge variant="outline" className={`text-[9px] leading-none px-1 h-4 shrink-0 ${BUCKET_STYLES[job.bucket] || "border-slate-200 text-slate-400"}`}>
                        {BUCKET_LABELS[job.bucket] || job.bucket}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{histTotal} result{histTotal !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={histPage === 0} onClick={() => setHistPage((p) => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                  <span className="px-1">Page {histPage + 1} / {histPages}</span>
                  <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={histPage + 1 >= histPages} onClick={() => setHistPage((p) => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
