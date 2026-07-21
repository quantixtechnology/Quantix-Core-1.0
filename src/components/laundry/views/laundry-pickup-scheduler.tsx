"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Loader2, Truck, MapPin, User, Package, Zap, Navigation, Phone, ShoppingBag,
  Clock, ArrowRight, Search, Filter, Printer, Download, Users, CheckSquare,
  X, ChevronDown, ChevronUp,
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
  acceptance: string | null; assignedAt: string | null; acceptedAt: string | null; bucket: string
}

const BUCKETS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Awaiting" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
  { key: "missed", label: "Missed" },
  { key: "cancelled", label: "Cancelled" },
]

const EXEC_CAPACITY = 30
const today = () => new Date().toISOString().slice(0, 10)
const fmtPhone = (s: string | null) => s ? `📞 ${s}` : null
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null
const availabilityColor = (a: string) =>
  a === "AVAILABLE" ? "text-emerald-600" : a === "BUSY" ? "text-amber-600" : "text-slate-400"

// ── Sub-components ─────────────────────────────────────────────────────────

function BucketBadge({ bucket, field }: { bucket: string; field: string | null }) {
  const map: Record<string, string> = {
    awaiting: "border-amber-200 text-amber-700 bg-amber-50",
    assigned: "border-blue-200 text-blue-700 bg-blue-50",
    accepted: "border-indigo-200 text-indigo-700 bg-indigo-50",
    completed: "border-emerald-200 text-emerald-700 bg-emerald-50",
    missed: "border-rose-200 text-rose-700 bg-rose-50",
    cancelled: "border-slate-200 text-slate-400 bg-slate-50",
  }
  const labels: Record<string, string> = {
    awaiting: "Awaiting", assigned: "Assigned", accepted: "In Progress",
    completed: "Completed", missed: "Missed", cancelled: "Cancelled",
  }
  const label = bucket === "accepted" && field && field !== "ASSIGNED"
    ? field.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : labels[bucket] || bucket
  return <Badge variant="outline" className={`text-[10px] leading-none shrink-0 ${map[bucket] || map.awaiting}`}>{label}</Badge>
}

function ExecutiveSelect({ execs, value, onChange, disabled }: {
  execs: Exec[]; value: string | null; onChange: (id: string | null) => void; disabled: boolean
}) {
  const selected = execs.find((e) => e.id === value)
  return (
    <select
      value={value || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-7 text-[11px] flex-1 rounded border border-slate-200 px-1.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 min-w-0">
      <option value="">— Unassigned —</option>
      {execs.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name}{ex.todaysPickups + ex.todaysDeliveries > 0 ? ` (${ex.todaysPickups + ex.todaysDeliveries})` : ""}
        </option>
      ))}
    </select>
  )
}

function AssignmentSummary({ pickupCounts, deliveryCounts, loading }: {
  pickupCounts: Record<string, number>
  deliveryCounts: Record<string, number>
  loading: boolean
}) {
  const stat = (label: string, val: number, color: string) => (
    <div className="flex items-center gap-1.5 text-xs" key={label}>
      <span className="font-semibold text-slate-700">{val}</span>
      <span className="text-slate-400">{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
    </div>
  )
  if (loading) return <div className="h-8" />
  const labels = ["Pickups", "Unassigned", "Assigned", "Accepted", "Completed", "Deliveries"]
  const colors = ["bg-blue-400", "bg-amber-400", "bg-indigo-400", "bg-emerald-400", "bg-slate-300"]
  const vals = [
    pickupCounts.all || 0, pickupCounts.awaiting || 0, pickupCounts.assigned || 0,
    pickupCounts.accepted || 0, pickupCounts.completed || 0, deliveryCounts.all || 0,
  ]
  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      {labels.slice(0, 5).map((l, i) => stat(l, vals[i], colors[i]))}
      <span className="w-px h-4 bg-slate-200 mx-1" />
      {stat("Deliveries", vals[5], "bg-slate-300")}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaundryPickupScheduler({ mode = "pickup" }: { mode?: "pickup" | "delivery" }) {
  const isDelivery = mode === "delivery"
  const { currentBusinessId } = useAuthStore()
  const [date, setDate] = useState(today())
  const [jobs, setJobs] = useState<Job[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [areaCounts, setAreaCounts] = useState<Record<string, number>>({})
  const [execs, setExecs] = useState<Exec[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [groupByArea, setGroupByArea] = useState(true)
  const [search, setSearch] = useState("")
  const [filterArea, setFilterArea] = useState("")
  const [filterExec, setFilterExec] = useState("")
  const [filterTimeSlot, setFilterTimeSlot] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, date, type: mode })
      if (tab !== "all") params.set("tab", tab)
      if (search) params.set("search", search)
      if (filterArea) params.set("area", filterArea)
      if (filterExec) params.set("executiveId", filterExec)
      if (filterTimeSlot) params.set("timeSlot", filterTimeSlot)

      // Use delivery-executives endpoint for richer capacity data
      const [s, e] = await Promise.all([
        fetch(`/api/laundry/pickup-scheduler?${params}`).then((r) => r.json()),
        fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      if (s.success) {
        setJobs(s.data)
        setCounts(s.counts || {})
        setAreaCounts(s.areaCounts || {})
      }
      if (e.success) setExecs(e.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, date, mode, tab, search, filterArea, filterExec, filterTimeSlot])

  useEffect(() => { load() }, [load])

  // ── Assignment (single) ───────────────────────────────────────────────────
  const assign = async (job: Job, executiveId: string | null) => {
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: job.id, type: mode, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? "Assigned" : "Cleared")
      // Live update: remove the card immediately
      setJobs((prev) => prev.filter((p) => p.id !== job.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  // ── Bulk assignment ───────────────────────────────────────────────────────
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
      // Live update: remove selected cards
      setJobs((prev) => prev.filter((p) => !selected.has(p.id)))
      setSelected(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    }
  }

  // ── Bulk print manifest ───────────────────────────────────────────────────
  const bulkPrint = async () => {
    const ids = [...selected]
    if (ids.length === 0) return
    try {
      const res = await fetch(`/api/laundry/pickup-scheduler?businessId=${currentBusinessId}&date=${date}&type=${mode}&manifest=true&orderIds=${ids.join(",")}`)
      const j = await res.json()
      if (!j.success || !j.data?.length) { toast.error("No data"); return }

      const rows = j.data.map((r: any) =>
        `${r.orderNumber}\t${r.customerName}\t${fmtPhone(r.customerPhone)}\t${r.address || ""}\t${r.timeSlot || ""}\t${r.services.join(", ")}\t${r.executiveName || ""}`)
      const csv = `Order\tCustomer\tPhone\tAddress\tTime Slot\tServices\tExecutive\n${rows.join("\n")}`
      const win = window.open("")
      if (win) {
        win.document.write(`<html><head><title>Route Manifest</title><style>body{font:12px/1.4 monospace;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}</style></head><body>`)
        win.document.write(`<h2>Route Manifest — ${new Date().toLocaleDateString("en-IN")}</h2>`)
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

  // ── Bulk export CSV ───────────────────────────────────────────────────────
  const bulkExport = () => {
    const ids = [...selected]
    if (ids.length === 0) return
    const selectedJobs = jobs.filter((j) => ids.includes(j.id))
    const headers = "Order,Customer,Phone,Area,Address,Time Slot,Services,Bags,Executive,Status"
    const rows = selectedJobs.map((j) =>
      `"${j.orderNumber}","${j.customerName}","${j.customerPhone || ""}","${j.area}","${(j.address || "").replace(/"/g, '""')}","${j.timeSlot || ""}","${j.services.join("; ")}","${j.bagCount}","${j.executiveName || ""}","${j.bucket}"`
    )
    const blob = new Blob([`${headers}\n${rows.join("\n")}`], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `route-manifest-${date}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let f = jobs
    // Tab filter (all excludes completed)
    if (tab !== "all") f = f.filter((j) => j.bucket === tab)
    // Client-side search (already server-filtered, but keep for responsiveness)
    if (search) {
      const q = search.toLowerCase()
      f = f.filter((j) =>
        j.orderNumber.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        (j.customerPhone && j.customerPhone.includes(q)) ||
        (j.address && j.address.toLowerCase().includes(q)) ||
        (j.executiveName && j.executiveName.toLowerCase().includes(q))
      )
    }
    return f
  }, [jobs, tab, search])

  const allSelected = filtered.length > 0 && filtered.every((j) => selected.has(j.id))
  const toggleAll = () => { if (allSelected) setSelected(new Set()); else setSelected(new Set(filtered.map((j) => j.id))) }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Area grouping ─────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!groupByArea || filtered.length === 0) return null
    const groups = new Map<string, Job[]>()
    for (const j of filtered) {
      const area = j.area || "Other"
      if (!groups.has(area)) groups.set(area, [])
      groups.get(area)!.push(j)
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupByArea])

  // ── Virtual scrolling (flat list) ─────────────────────────────────────────
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  // ── Executive picker for bulk assignment ──────────────────────────────────
  const [bulkExecPicker, setBulkExecPicker] = useState(false)

  // ── Available areas / time slots / services for filters ───────────────────
  const areas = useMemo(() => [...new Set(jobs.map((j) => j.area).filter(Boolean))].sort(), [jobs])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="px-3 lg:px-4 py-4 space-y-3 max-w-full">
      {/* ── Header + Summary ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base font-bold tracking-tight text-slate-800 flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-blue-600" />
            {isDelivery ? "Delivery Assignments" : "Pickup Assignments"}
          </h1>
          <AssignmentSummary
            pickupCounts={counts}
            deliveryCounts={{}}
            loading={loading}
          />
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-7 w-36 text-xs" />
        </div>
      </div>

      {/* ── Bucket tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => { setTab(b.key); setSelected(new Set()) }}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium border transition-colors ${
              tab === b.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>
            {b.label}{counts[b.key] != null ? <span className={`ml-1 text-[10px] ${tab === b.key ? "text-blue-100" : "text-slate-400"}`}>{counts[b.key]}</span> : null}
          </button>
        ))}
      </div>

      {/* ── Search + Filter bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search order / customer / phone / address / executive..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-3 w-3" /> Filters <ChevronDown className={`h-3 w-3 transition ${showFilters ? "rotate-180" : ""}`} />
        </Button>
        <Button variant="outline" size="sm" className={`h-7 text-xs gap-1 ${groupByArea ? "bg-blue-50 border-blue-200" : ""}`} onClick={() => setGroupByArea(!groupByArea)}>
          <Users className="h-3 w-3" /> Group by Area
        </Button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-2 flex-wrap bg-slate-50 rounded-lg p-2 border border-slate-100">
          <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)}
            className="h-7 text-xs rounded border border-slate-200 px-1.5 bg-white">
            <option value="">All Areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterExec} onChange={(e) => setFilterExec(e.target.value)}
            className="h-7 text-xs rounded border border-slate-200 px-1.5 bg-white">
            <option value="">All Executives</option>
            {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <select value={filterTimeSlot} onChange={(e) => setFilterTimeSlot(e.target.value)}
            className="h-7 text-xs rounded border border-slate-200 px-1.5 bg-white">
            <option value="">All Time Slots</option>
            {[...new Set(jobs.map((j) => j.timeSlot).filter(Boolean))].map((ts) => <option key={ts} value={ts!}>{ts}</option>)}
          </select>
          {(filterArea || filterExec || filterTimeSlot) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400"
              onClick={() => { setFilterArea(""); setFilterExec(""); setFilterTimeSlot("") }}>
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Bulk action toolbar ────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <Card className="rounded-lg border-blue-200 bg-blue-50">
          <CardContent className="p-2 flex items-center gap-2 flex-wrap">
            <Checkbox checked={allSelected} onCheckedChange={() => toggleAll()} />
            <span className="text-xs font-medium text-blue-800 min-w-[80px]">{selected.size} Selected</span>

            {!bulkExecPicker ? (
              <Button size="sm" className="h-7 text-xs" onClick={() => setBulkExecPicker(true)}>
                <User className="h-3 w-3" /> Assign
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-blue-600">Assign to:</span>
                <select
                  onChange={(e) => { if (e.target.value) { bulkAssign(e.target.value); setBulkExecPicker(false) } }}
                  className="h-7 text-xs rounded border border-blue-200 px-1.5 bg-white"
                  defaultValue="">
                  <option value="" disabled>Choose...</option>
                  {execs.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.todaysPickups + ex.todaysDeliveries}/{EXEC_CAPACITY})
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBulkExecPicker(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkAssign(null)}>
              <X className="h-3 w-3" /> Unassign
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkPrint}>
              <Printer className="h-3 w-3" /> Print Route
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkExport}>
              <Download className="h-3 w-3" /> Export
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto text-slate-500"
              onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Job list ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-xl border-slate-200"><CardContent className="py-10 text-center text-slate-400 text-xs">
          No {isDelivery ? "deliveries" : "pickups"} for this filter.
        </CardContent></Card>
      ) : grouped && groupByArea ? (
        /* ── Area-grouped view ──────────────────────────────────────────── */
        <div className="space-y-3">
          {grouped.map(([area, areaJobs]) => (
            <div key={area}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-700">{area}</span>
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{areaJobs.length} {areaJobs.length === 1 ? "job" : "jobs"}</span>
                <span className="flex-1 border-t border-slate-100" />
                <Checkbox
                  checked={areaJobs.every((j) => selected.has(j.id))}
                  onCheckedChange={() => {
                    const all = areaJobs.every((j) => selected.has(j.id))
                    setSelected((prev) => {
                      const next = new Set(prev)
                      for (const j of areaJobs) { if (all) next.delete(j.id); else next.add(j.id) }
                      return next
                    })
                  }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {areaJobs.map((job) => (
                  <CompactCard key={job.id} job={job} execs={execs}
                    selected={selected.has(job.id)}
                    onToggle={() => toggleOne(job.id)}
                    onAssign={(execId) => assign(job, execId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Virtual-scrolled flat list ──────────────────────────────────── */
        <div ref={parentRef} className="overflow-auto max-h-[calc(100vh-320px)]">
          <div className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const job = filtered[vItem.index]
              return (
                <div key={job.id} className="absolute top-0 left-0 w-full px-0.5"
                  style={{ height: `${vItem.size}px`, transform: `translateY(${vItem.start}px)` }}>
                  <CompactCard job={job} execs={execs}
                    selected={selected.has(job.id)}
                    onToggle={() => toggleOne(job.id)}
                    onAssign={(execId) => assign(job, execId)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compact card ────────────────────────────────────────────────────────────

function CompactCard({ job, execs, selected, onToggle, onAssign }: {
  job: Job; execs: Exec[]; selected: boolean; onToggle: () => void; onAssign: (execId: string | null) => void
}) {
  const isClosed = job.bucket === "completed" || job.bucket === "cancelled"
  const ex = execs.find((e) => e.id === job.executiveId)
  const disableActions = isClosed

  return (
    <Card className={`rounded-lg border ${isClosed ? "border-slate-100 bg-slate-50" : selected ? "border-blue-300 bg-blue-50/30" : "border-slate-200 bg-white"} transition-colors`}>
      <CardContent className="p-2 flex items-start gap-2">
        {/* Checkbox */}
        <div className="pt-1">
          <Checkbox checked={selected} onCheckedChange={onToggle} disabled={disableActions}
            className={disableActions ? "opacity-30" : ""} />
        </div>

        {/* Main content - compact single line layout */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: Order number + Customer name + Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-mono text-[11px] font-bold ${isClosed ? "text-slate-400" : "text-slate-800"}`}>{job.orderNumber}</span>
            <span className={`text-xs ${isClosed ? "text-slate-400" : "text-slate-700"}`}>{job.customerName}</span>
            {job.priority === "EXPRESS" && <Zap className="h-3 w-3 text-amber-500" />}
            <div className="ml-auto flex items-center gap-1">
              {!isClosed && <BucketBadge bucket={job.bucket} field={job.fieldStatus} />}
            </div>
          </div>

          {/* Row 2: Info icons - compact */}
          <div className={`flex items-center gap-2 text-[10px] flex-wrap ${isClosed ? "text-slate-400" : "text-slate-500"}`}>
            {job.area && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{job.area}</span>}
            <span className="flex items-center gap-0.5"><ShoppingBag className="h-3 w-3" />{job.bagCount} bag{job.bagCount === 1 ? "" : "s"}</span>
            {job.services.length > 0 && <span className="flex items-center gap-0.5 text-slate-400">{job.services.slice(0, 2).join(", ")}{job.services.length > 2 ? "..." : ""}</span>}
            {job.timeSlot && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{job.timeSlot}</span>}
            {fmtPhone(job.customerPhone) && <span className="hidden sm:inline-flex items-center">{fmtPhone(job.customerPhone)}</span>}
          </div>

          {/* Row 3: Executive selector + quick actions */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {disableActions ? (
              <span className="text-[10px] text-slate-400 italic">
                {ex ? ex.name : "—"}
              </span>
            ) : (
              <>
                <ExecutiveSelect execs={execs} value={job.executiveId} onChange={onAssign} disabled={false} />
                {ex && (
                  <span className={`text-[10px] font-medium ${availabilityColor(ex.availability)}`}>
                    {ex.availability === "AVAILABLE" ? "Available" : ex.availability === "BUSY" ? "Busy" : "Offline"}
                  </span>
                )}
                {ex && (
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">
                    {ex.todaysPickups + ex.todaysDeliveries}/{EXEC_CAPACITY}
                  </span>
                )}
              </>
            )}
            {(job.mapsLink || (job.lat && job.lng)) && (
              <a href={job.mapsLink || `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`}
                target="_blank" rel="noreferrer"
                className="text-blue-500 hover:text-blue-700 shrink-0" title="Navigate">
                <Navigation className="h-3 w-3" />
              </a>
            )}
            {!isClosed && job.bucket === "assigned" && job.acceptance === "PENDING" && job.executiveId && (
              <Button variant="ghost" size="sm" className="h-5 text-[10px] text-amber-600 px-1"
                onClick={() => assign(job, null)}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


