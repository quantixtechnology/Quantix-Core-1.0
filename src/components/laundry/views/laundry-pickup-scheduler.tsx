"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Truck, MapPin, User, Zap, Navigation, ShoppingBag,
  Clock, Search, Filter, Printer, Download, Users, X,
  Calendar, RefreshCw, History, ArrowLeftRight, ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

// ── Types ──────────────────────────────────────────────────────────────────
interface Exec {
  id: string; name: string; mobile: string | null; storeName: string | null
  availability: string; isActive: boolean; isLocked: boolean
  vehicleType: string | null; vehicleNumber: string | null
  todaysPickups: number; todaysDeliveries: number
}

interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  storeName: string | null; address: string | null; landmark: string | null; mapsLink: string | null
  lat: number | null; lng: number | null; area: string
  services: string[]; bagCount: number; itemCount: number
  executiveId: string | null; executiveName: string | null; vehicle: string | null
  acceptance: string | null; assignedAt: string | null; acceptedAt: string | null; completedAt: string | null
  bucket: string
}

const EXEC_CAPACITY = 30
const fmtPhone = (s: string | null) => s ? `📞 ${s}` : null
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null
const fmtDateTime = (s: string | null) => s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : null
const availabilityColor = (a: string) =>
  a === "AVAILABLE" ? "text-emerald-600" : a === "BUSY" ? "text-amber-600" : "text-slate-400"

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisWeek", label: "This Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "custom", label: "Custom" },
] as const

const HISTORY_PRESETS = [
  { key: "last7d", label: "7 Days" },
  { key: "last30d", label: "30 Days" },
  { key: "last90d", label: "90 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "custom", label: "Custom" },
] as const

const OPS_TABS = [
  { key: "today", label: "Today" },
  { key: "awaiting", label: "Awaiting" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "completed-today", label: "Completed Today" },
] as const

// ── Sub-components ─────────────────────────────────────────────────────────

function BucketBadge({ bucket }: { bucket: string }) {
  const map: Record<string, string> = {
    awaiting: "border-amber-200 text-amber-700 bg-amber-50",
    assigned: "border-blue-200 text-blue-700 bg-blue-50",
    accepted: "border-indigo-200 text-indigo-700 bg-indigo-50",
    "completed-today": "border-emerald-200 text-emerald-700 bg-emerald-50",
    completed: "border-emerald-200 text-emerald-700 bg-emerald-50",
    missed: "border-rose-200 text-rose-700 bg-rose-50",
    cancelled: "border-slate-200 text-slate-400 bg-slate-50",
  }
  const labels: Record<string, string> = {
    awaiting: "Awaiting", assigned: "Assigned", accepted: "In Progress",
    "completed-today": "Completed", completed: "Completed",
    missed: "Missed", cancelled: "Cancelled",
  }
  return <Badge variant="outline" className={`text-[10px] leading-none shrink-0 ${map[bucket] || map.awaiting}`}>{labels[bucket] || bucket}</Badge>
}

function ExecutiveSelect({ execs, value, onChange }: {
  execs: Exec[]; value: string | null; onChange: (id: string | null) => void
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-6 text-[10px] flex-1 rounded border border-slate-200 px-1 bg-white min-w-0 max-w-[160px]">
      <option value="">—</option>
      {execs.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name} ({ex.todaysPickups + ex.todaysDeliveries}/{EXEC_CAPACITY})
        </option>
      ))}
    </select>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaundryPickupScheduler({ mode = "pickup" }: { mode?: "pickup" | "delivery" }) {
  const isDelivery = mode === "delivery"
  const { currentBusinessId } = useAuthStore()

  // ── State ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"operations" | "history">("operations")
  const [datePreset, setDatePreset] = useState("today")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [historyPreset, setHistoryPreset] = useState("last30d")
  const [histCustomFrom, setHistCustomFrom] = useState("")
  const [histCustomTo, setHistCustomTo] = useState("")

  const [opsJobs, setOpsJobs] = useState<Job[]>([])
  const [histJobs, setHistJobs] = useState<Job[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [execs, setExecs] = useState<Exec[]>([])

  const [loading, setLoading] = useState(true)
  const [opsTab, setOpsTab] = useState("today")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [filterArea, setFilterArea] = useState("")
  const [filterExec, setFilterExec] = useState("")
  const [filterTimeSlot, setFilterTimeSlot] = useState("")

  // ── Load operations ─────────────────────────────────────────────────────
  const loadOps = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, type: mode, scope: "active", datePreset })
      if (datePreset === "custom" && customFrom) params.set("fromDate", customFrom)
      if (datePreset === "custom" && customTo) params.set("toDate", customTo)
      if (opsTab !== "today") params.set("tab", opsTab)
      if (search) params.set("search", search)
      if (filterArea) params.set("area", filterArea)
      if (filterExec) params.set("executiveId", filterExec)
      if (filterTimeSlot) params.set("timeSlot", filterTimeSlot)

      const [s, e] = await Promise.all([
        fetch(`/api/laundry/pickup-scheduler?${params}`).then((r) => r.json()),
        fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      if (s.success) { setOpsJobs(s.data); setCounts(s.counts || {}) }
      if (e.success) setExecs(e.data)
    } catch { /* noop */ }
  }, [currentBusinessId, mode, datePreset, customFrom, customTo, opsTab, search, filterArea, filterExec, filterTimeSlot])

  // ── Load history ────────────────────────────────────────────────────────
  const loadHist = useCallback(async () => {
    if (!currentBusinessId) return
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, type: mode, scope: "history", datePreset: historyPreset })
      if (historyPreset === "custom" && histCustomFrom) params.set("fromDate", histCustomFrom)
      if (historyPreset === "custom" && histCustomTo) params.set("toDate", histCustomTo)
      if (search) params.set("historySearch", search)

      const s = await fetch(`/api/laundry/pickup-scheduler?${params}`).then((r) => r.json())
      if (s.success) setHistJobs(s.data)
    } catch { /* noop */ }
  }, [currentBusinessId, mode, historyPreset, histCustomFrom, histCustomTo, search])

  // ── Initial load + auto-refresh ─────────────────────────────────────────
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  useEffect(() => {
    if (!currentBusinessId) return
    setLoading(true)
    Promise.all([loadOps(), loadHist()]).finally(() => { setLoading(false); setInitialLoadDone(true) })
  }, [currentBusinessId]) // Only on businessId change

  // Reload when params change (not on initial mount)
  useEffect(() => {
    if (!currentBusinessId || !initialLoadDone) return
    loadOps()
  }, [datePreset, customFrom, customTo, opsTab, filterArea, filterExec, filterTimeSlot])

  useEffect(() => {
    if (!currentBusinessId || !initialLoadDone) return
    loadHist()
  }, [historyPreset, histCustomFrom, histCustomTo])

  // Search reloads both
  useEffect(() => {
    if (!currentBusinessId || !initialLoadDone) return
    loadOps()
    loadHist()
  }, [search])

  // ── Auto-refresh every 30s (operations only) ────────────────────────────
  useEffect(() => {
    if (!currentBusinessId || viewMode !== "operations") return
    const interval = setInterval(() => { loadOps() }, 30000)
    return () => clearInterval(interval)
  }, [currentBusinessId, viewMode, loadOps])

  // ── Assignment (single) ─────────────────────────────────────────────────
  const assign = async (job: Job, executiveId: string | null) => {
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: job.id, type: mode, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? "Assigned" : "Cleared")
      setOpsJobs((prev) => prev.filter((p) => p.id !== job.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  // ── Bulk assignment ─────────────────────────────────────────────────────
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
      setOpsJobs((prev) => prev.filter((p) => !selected.has(p.id)))
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  // ── Bulk print ──────────────────────────────────────────────────────────
  const bulkPrint = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      const res = await fetch(`/api/laundry/pickup-scheduler?businessId=${currentBusinessId}&type=${mode}&scope=active&manifest=true&orderIds=${ids.join(",")}`)
      const j = await res.json()
      if (!j.success || !j.data?.length) { toast.error("No data"); return }
      const win = window.open("")
      if (win) {
        win.document.write(`<html><head><title>Route Manifest</title><style>body{font:11px/1.4 sans-serif;padding:16px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:3px 6px;text-align:left;font-size:11px}</style></head><body>`)
        win.document.write(`<h2 style="font-size:14px">Route Manifest — ${new Date().toLocaleDateString("en-IN")}</h2>`)
        win.document.write(`<table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Address</th><th>Time</th><th>Services</th><th>Executive</th></tr></thead><tbody>`)
        j.data.forEach((r: any) => {
          win!.document.write(`<tr><td>${r.orderNumber}</td><td>${r.customerName}</td><td>${r.customerPhone || ""}</td><td>${r.address || ""}</td><td>${r.timeSlot || ""}</td><td>${r.services.join(", ")}</td><td>${r.executiveName || ""}</td></tr>`)
        })
        win.document.write(`</tbody></table></body></html>`)
        win.document.close()
        win.print()
      }
    } catch { toast.error("Failed to generate manifest") }
  }

  // ── Bulk export ─────────────────────────────────────────────────────────
  const bulkExport = () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const sel = opsJobs.filter((j) => ids.includes(j.id))
    const headers = "Order,Customer,Phone,Area,Address,Time Slot,Services,Bags,Executive,Status"
    const rows = sel.map((j) =>
      `"${j.orderNumber}","${j.customerName}","${j.customerPhone || ""}","${j.area}","${(j.address || "").replace(/"/g, '""')}","${j.timeSlot || ""}","${j.services.join("; ")}","${j.bagCount}","${j.executiveName || ""}","${j.bucket}"`)
    const blob = new Blob([`${headers}\n${rows.join("\n")}`], { type: "text/csv" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a")
    a.href = url; a.download = `route-manifest.csv`; a.click(); URL.revokeObjectURL(url)
  }

  // ── Derived state ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (viewMode === "operations") return opsJobs
    return histJobs
  }, [viewMode, opsJobs, histJobs])

  const allSelected = opsJobs.length > 0 && opsJobs.every((j) => selected.has(j.id))
  const toggleAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(opsJobs.map((j) => j.id))) }
  const toggleOne = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const areas = useMemo(() => [...new Set(opsJobs.map((j) => j.area).filter(Boolean))].sort(), [opsJobs])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="px-3 lg:px-4 py-3 space-y-2 max-w-full">
      {/* ── Mode toggle ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => { setViewMode("operations"); setSelected(new Set()) }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "operations" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            🚚 Operations
          </button>
          <button onClick={() => { setViewMode("history"); setSelected(new Set()) }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "history" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            📜 History
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          {viewMode === "operations" && <><RefreshCw className="h-3 w-3" /> Auto-refresh 30s</>}
        </div>
      </div>

      {/* ── OPERATIONS MODE ──────────────────────────────────────────────── */}
      {viewMode === "operations" && (
        <>
          {/* Date preset bar */}
          <div className="flex items-center gap-1 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            {DATE_PRESETS.map((p) => (
              <button key={p.key} onClick={() => setDatePreset(p.key)}
                className={`h-6 px-2 rounded text-[10px] font-medium border transition-colors ${datePreset === p.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {p.label}
              </button>
            ))}
            {datePreset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-6 w-32 text-[10px]" />
                <span className="text-[10px] text-slate-400">→</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-6 w-32 text-[10px]" />
              </div>
            )}
          </div>

          {/* Header + stats */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-blue-600" />
                {isDelivery ? "Delivery Assignments" : "Pickup Assignments"}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span className="text-slate-700 font-semibold">{counts.today || 0}</span> Today
                <span className="w-px h-3 bg-slate-200" />
                <span className="text-amber-600 font-semibold">{counts.awaiting || 0}</span> Awaiting
                <span className="text-blue-600 font-semibold">{counts.assigned || 0}</span> Assigned
                <span className="text-indigo-600 font-semibold">{counts.accepted || 0}</span> Accepted
                <span className="text-emerald-600 font-semibold">{(counts["completed-today"] || 0)}</span> Today
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <Input placeholder="Search order / customer / phone ..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-7 pl-7 text-xs" />
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2"
              onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3 w-3" /> Filters
            </Button>
            {/* Executive summary popup-like */}
            {execs.length > 0 && (
              <div className="hidden md:flex items-center gap-2 text-[9px] text-slate-500 overflow-x-auto max-w-[400px]">
                {execs.filter((e) => e.availability === "AVAILABLE").slice(0, 4).map((ex) => (
                  <span key={ex.id} className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 whitespace-nowrap">
                    <span className="font-medium text-slate-700">{ex.name.split(" ")[0]}</span>
                    <span className="text-emerald-600">{ex.todaysPickups + ex.todaysDeliveries}/{EXEC_CAPACITY}</span>
                  </span>
                ))}
                {execs.filter((e) => e.availability === "AVAILABLE").length > 4 && (
                  <span className="text-slate-400">+{execs.filter((e) => e.availability === "AVAILABLE").length - 4}</span>
                )}
              </div>
            )}
          </div>

          {/* Advanced filters popup */}
          {showFilters && (
            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
              <CardContent className="p-2 flex items-center gap-2 flex-wrap">
                <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)}
                  className="h-7 text-[10px] rounded border border-slate-200 px-1.5 bg-white">
                  <option value="">All Areas</option>
                  {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={filterExec} onChange={(e) => setFilterExec(e.target.value)}
                  className="h-7 text-[10px] rounded border border-slate-200 px-1.5 bg-white">
                  <option value="">All Executives</option>
                  {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                <select value={filterTimeSlot} onChange={(e) => setFilterTimeSlot(e.target.value)}
                  className="h-7 text-[10px] rounded border border-slate-200 px-1.5 bg-white">
                  <option value="">All Time Slots</option>
                  {[...new Set(opsJobs.map((j) => j.timeSlot).filter(Boolean))].map((ts) => <option key={ts} value={ts!}>{ts}</option>)}
                </select>
                {(filterArea || filterExec || filterTimeSlot) && (
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-slate-400 px-1"
                    onClick={() => { setFilterArea(""); setFilterExec(""); setFilterTimeSlot("") }}>
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-1 flex-wrap">
            {OPS_TABS.map((t) => (
              <button key={t.key} onClick={() => { setOpsTab(t.key); setSelected(new Set()) }}
                className={`h-6 px-2.5 rounded text-[10px] font-medium border transition-colors ${opsTab === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {t.label}{counts[t.key] != null ? <span className={`ml-1 text-[9px] ${opsTab === t.key ? "text-blue-100" : "text-slate-400"}`}>{counts[t.key]}</span> : null}
              </button>
            ))}
          </div>

          {/* Bulk toolbar */}
          {selected.size > 0 && (
            <Card className="rounded-lg border-blue-200 bg-blue-50">
              <CardContent className="p-1.5 flex items-center gap-1.5 flex-wrap">
                <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
                <span className="text-[10px] font-medium text-blue-800 min-w-[60px]">{selected.size} Selected</span>
                <select onChange={(e) => { if (e.target.value) { bulkAssign(e.target.value) } }}
                  className="h-6 text-[10px] rounded border border-blue-200 px-1 bg-white" defaultValue="">
                  <option value="" disabled>Assign to...</option>
                  {execs.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.todaysPickups + ex.todaysDeliveries}/{EXEC_CAPACITY})
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={() => bulkAssign(null)}>
                  <X className="h-3 w-3" /> Unassign
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={bulkPrint}>
                  <Printer className="h-3 w-3" /> Print
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5" onClick={bulkExport}>
                  <Download className="h-3 w-3" /> CSV
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
              No {isDelivery ? "deliveries" : "pickups"} for this period.
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {opsJobs.map((job) => (
                <CompactCard key={job.id} job={job} execs={execs}
                  selected={selected.has(job.id)} onToggle={() => toggleOne(job.id)}
                  onAssign={(execId) => assign(job, execId)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── HISTORY MODE ──────────────────────────────────────────────────── */}
      {viewMode === "history" && (
        <>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-500" />
              Assignment History
            </h1>
          </div>

          {/* History date range */}
          <div className="flex items-center gap-1 flex-wrap">
            {HISTORY_PRESETS.map((p) => (
              <button key={p.key} onClick={() => setHistoryPreset(p.key)}
                className={`h-6 px-2 rounded text-[10px] font-medium border transition-colors ${historyPreset === p.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {p.label}
              </button>
            ))}
            {historyPreset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={histCustomFrom} onChange={(e) => setHistCustomFrom(e.target.value)} className="h-6 w-32 text-[10px]" />
                <span className="text-[10px] text-slate-400">→</span>
                <Input type="date" value={histCustomTo} onChange={(e) => setHistCustomTo(e.target.value)} className="h-6 w-32 text-[10px]" />
              </div>
            )}
          </div>

          {/* History search */}
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <Input placeholder="Search order / customer / phone / executive / store / area ..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs" />
          </div>

          {/* History cards */}
          {loading ? (
            <div className="py-10 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
          ) : histJobs.length === 0 ? (
            <Card className="rounded-lg border-slate-200"><CardContent className="py-8 text-center text-slate-400 text-[10px]">
              No history for this period.
            </CardContent></Card>
          ) : (
            <div className="space-y-1">
              {histJobs.map((job) => (
                <HistoryCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Compact operations card ────────────────────────────────────────────────

function CompactCard({ job, execs, selected, onToggle, onAssign }: {
  job: Job; execs: Exec[]; selected: boolean; onToggle: () => void; onAssign: (execId: string | null) => void
}) {
  const ex = execs.find((e) => e.id === job.executiveId)
  return (
    <Card className={`rounded-lg border ${selected ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"} transition-colors`}>
      <CardContent className="p-1.5 flex items-center gap-1.5">
        <Checkbox checked={selected} onCheckedChange={onToggle} className="shrink-0" />
        <div className="flex items-center gap-1.5 text-[10px] min-w-0 flex-1 flex-wrap">
          <span className="font-mono font-bold text-slate-800 shrink-0">{job.orderNumber}</span>
          <span className="text-slate-700 truncate max-w-[140px]">{job.customerName}</span>
          {job.priority === "EXPRESS" && <Zap className="h-3 w-3 text-amber-500 shrink-0" />}
          {job.area && <span className="text-slate-400 hidden sm:inline flex items-center gap-0.5"><MapPin className="h-3 w-3" />{job.area}</span>}
          <span className="text-slate-400 hidden md:inline flex items-center gap-0.5"><ShoppingBag className="h-3 w-3" />{job.bagCount}</span>
          {job.timeSlot && <span className="text-slate-400 hidden lg:inline flex items-center gap-0.5"><Clock className="h-3 w-3" />{job.timeSlot}</span>}
          <BucketBadge bucket={job.bucket} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ExecutiveSelect execs={execs} value={job.executiveId} onChange={onAssign} />
          {ex && (
            <span className={`text-[9px] font-medium ${availabilityColor(ex.availability)} hidden xl:inline`}>
              {ex.availability === "AVAILABLE" ? "Avail" : ex.availability === "BUSY" ? "Busy" : "Off"}
            </span>
          )}
          {(job.mapsLink || (job.lat && job.lng)) && (
            <a href={job.mapsLink || `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
              target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600" title="Navigate">
              <Navigation className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── History card (read-only, grey) ──────────────────────────────────────────

function HistoryCard({ job }: { job: Job }) {
  return (
    <Card className="rounded-lg border-slate-100 bg-slate-50">
      <CardContent className="p-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] min-w-0 flex-1 flex-wrap">
          <span className="font-mono font-bold text-slate-400">{job.orderNumber}</span>
          <span className="text-slate-500 truncate max-w-[160px]">{job.customerName}</span>
          {job.area && <span className="text-slate-400 flex items-center gap-0.5"><MapPin className="h-3 w-3" />{job.area}</span>}
          {job.storeName && <span className="text-slate-400">{job.storeName}</span>}
          <BucketBadge bucket={job.bucket} />
        </div>
        <div className="flex items-center gap-2 text-[9px] text-slate-400 shrink-0">
          {job.executiveName && <span className="flex items-center gap-0.5"><User className="h-3 w-3" />{job.executiveName}</span>}
          {job.completedAt && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{fmtDateTime(job.completedAt)}</span>}
          {!job.completedAt && job.assignedAt && <span>Assigned {fmtDate(job.assignedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
