"use client"

// ── Dispatch Center ─────────────────────────────────────────────────────────
// ONE operational board over ALL of today's field work — pickups and deliveries
// together. Answers the 9 AM question ("assign, reassign, monitor, complete
// 200 jobs fast") with work-type + status filters, per-executive focus, and bulk
// operations. It owns NO data: every row is a LaundryOrder, every action calls
// the existing pickup-scheduler endpoint, which updates the Order directly.
// Pickup and Delivery are lenses on the same board, not separate modules.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Truck, PackageCheck, Navigation, ShoppingBag, Clock, Search, RefreshCw, Users, X } from "lucide-react"
import { toast } from "sonner"

type Kind = "pickup" | "delivery"

interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  amountDue: number
  address: string | null; mapsLink: string | null; lat: number | null; lng: number | null
  bagCount: number
  executiveId: string | null; executiveName: string | null
  acceptance: string | null; scheduledDate: string | null
  bucket: string
}
interface DispatchJob extends Job { kind: Kind }
interface Exec { id: string; name: string; todaysPickups?: number; todaysDeliveries?: number }

const WORK_TYPES = [
  { key: "all", label: "All Work" },
  { key: "pickup", label: "Pickups" },
  { key: "delivery", label: "Deliveries" },
] as const
const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Unassigned" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "pending_receipt", label: "Pending Receipt" },
  { key: "completed", label: "Completed" },
] as const

// Date presets for the board. "Today" is the default landing view and preserves
// the legacy behavior exactly; the rest let supervisors review previous + future
// field work (the API filters pending jobs by scheduled date, completed by time).
const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7d", label: "Last 7 Days" },
  { key: "upcoming", label: "Upcoming" },
  { key: "custom", label: "Custom…" },
] as const

const BUCKET_STYLES: Record<string, string> = {
  awaiting: "border-amber-200 text-amber-700 bg-amber-50",
  assigned: "border-blue-200 text-blue-700 bg-blue-50",
  accepted: "border-indigo-200 text-indigo-700 bg-indigo-50",
  pending_receipt: "border-orange-200 text-orange-700 bg-orange-50",
  completed: "border-emerald-200 text-emerald-700 bg-emerald-50",
  cancelled: "border-slate-200 text-slate-400 bg-slate-50",
  rejected: "border-rose-200 text-rose-600 bg-rose-50",
  failed: "border-orange-200 text-orange-600 bg-orange-50",
}
const BUCKET_LABELS: Record<string, string> = {
  awaiting: "Unassigned", assigned: "Assigned", accepted: "In Progress", pending_receipt: "In Transit · Awaiting Receipt", completed: "Done",
  cancelled: "Cancelled", rejected: "Rejected", failed: "Failed",
}

const fmtDay = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : null)
const inr = (n: number) => `₹${(n || 0).toFixed(0)}`
const isOverdue = (j: DispatchJob) => {
  if (j.bucket === "completed" || j.bucket === "cancelled" || !j.scheduledDate) return false
  const end = new Date(j.scheduledDate); end.setHours(23, 59, 59, 999)
  return new Date() > end
}
const RANGE_SUBTITLE: Record<string, string> = {
  today: "All of today's pickups & deliveries — assign, reassign, monitor, complete",
  yesterday: "Yesterday's pickups & deliveries — review completed work, manage pending",
  last7d: "Pickups & deliveries from the last 7 days",
  upcoming: "Upcoming pickups & deliveries not yet done",
  custom: "Pickups & deliveries in the selected date range",
}

export function LaundryDispatchCenter() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage, setSelectedOrderId } = useAdminStore()

  const [jobs, setJobs] = useState<DispatchJob[]>([])
  const [execs, setExecs] = useState<Exec[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [workType, setWorkType] = useState<"all" | Kind>("all")
  const [status, setStatus] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [execFilter, setExecFilter] = useState<string>("") // "", exec id, or "__unassigned__"
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [datePreset, setDatePreset] = useState<string>("today")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const initial = useRef(true)

  // ── Load — fetch BOTH work types + executives; filter entirely client-side so
  // switching lens/status/executive is instant for a full morning of jobs. The
  // selected date range is sent to the API (default = today → legacy behavior). ──
  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setRefreshing(true)
    try {
      const q = (t: Kind) => {
        const p = new URLSearchParams({ businessId: currentBusinessId, type: t, scope: "active", datePreset })
        if (datePreset === "custom" && fromDate && toDate) { p.set("fromDate", fromDate); p.set("toDate", toDate) }
        return `/api/laundry/pickup-scheduler?${p.toString()}`
      }
      const [pu, dv, ex] = await Promise.all([
        fetch(q("pickup")).then((r) => r.json()),
        fetch(q("delivery")).then((r) => r.json()),
        fetch(`/api/laundry/delivery-executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      const merged: DispatchJob[] = [
        ...(pu.success ? pu.data.map((j: Job) => ({ ...j, kind: "pickup" as const })) : []),
        ...(dv.success ? dv.data.map((j: Job) => ({ ...j, kind: "delivery" as const })) : []),
      ]
      setJobs(merged)
      if (ex.success) setExecs(ex.data)
    } catch (err) { console.error("[dispatch-center] load", err) } finally { setRefreshing(false) }
  }, [currentBusinessId, datePreset, fromDate, toDate])

  useEffect(() => {
    if (!currentBusinessId) return
    load().finally(() => { if (initial.current) { initial.current = false; setLoading(false) } })
  }, [currentBusinessId, load])

  useEffect(() => {
    if (!currentBusinessId) return
    const t = setInterval(() => load(), 30000)
    return () => clearInterval(t)
  }, [currentBusinessId, load])

  // ── Derived views ─────────────────────────────────────────────────────────
  const byWorkType = useMemo(() => jobs.filter((j) => workType === "all" || j.kind === workType), [jobs, workType])

  // KPIs reflect the current work-type lens (across all statuses).
  const kpis = useMemo(() => {
    const c = { awaiting: 0, assigned: 0, accepted: 0, pending_receipt: 0, completed: 0 } as Record<string, number>
    for (const j of byWorkType) if (c[j.bucket] != null) c[j.bucket]++
    return c
  }, [byWorkType])
  const splitOf = (bucket: string) => ({
    pickup: byWorkType.filter((j) => j.kind === "pickup" && j.bucket === bucket).length,
    delivery: byWorkType.filter((j) => j.kind === "delivery" && j.bucket === bucket).length,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return byWorkType.filter((j) => {
      if (status !== "all" && j.bucket !== status) return false
      if (execFilter === "__unassigned__" && j.executiveId) return false
      if (execFilter && execFilter !== "__unassigned__" && j.executiveId !== execFilter) return false
      if (q && !(j.orderNumber.toLowerCase().includes(q) || j.customerName.toLowerCase().includes(q) || (j.customerPhone || "").includes(q))) return false
      return true
    })
  }, [byWorkType, status, execFilter, search])

  // ── Assignment (row-level) — uses the job's OWN kind ──────────────────────
  const assign = async (job: DispatchJob, executiveId: string | null) => {
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: currentBusinessId, orderId: job.id, type: job.kind, executiveId }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? "Assigned" : "Cleared")
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed") }
  }

  // ── Bulk — selection may mix pickups + deliveries; group by kind and issue one
  // call per type (each hits the same endpoint, updating the Orders directly). ──
  const bulkAssign = async (executiveId: string | null) => {
    const chosen = filtered.filter((j) => selected.has(j.id))
    if (chosen.length === 0) return
    if (!executiveId && !confirm(`Clear assignment for ${chosen.length} selected job(s)?`)) return
    const groups: Record<Kind, string[]> = { pickup: [], delivery: [] }
    for (const j of chosen) groups[j.kind].push(j.id)
    try {
      await Promise.all((["pickup", "delivery"] as Kind[]).filter((k) => groups[k].length).map((k) =>
        fetch("/api/laundry/pickup-scheduler", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId: currentBusinessId, orderIds: groups[k], type: k, executiveId }),
        }).then(async (r) => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.error || "Failed") })
      ))
      toast.success(executiveId ? `Assigned ${chosen.length} job(s)` : `Cleared ${chosen.length} assignment(s)`)
      setSelected(new Set())
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed") }
  }

  const visibleIds = filtered.map((j) => j.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds))
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const open = (id: string) => { setSelectedOrderId(id); setLaundryPage("order-detail") }

  if (loading) return <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading dispatch board…</div>

  return (
    <div className="px-2 lg:px-4 py-2 space-y-2 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center"><Truck className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 leading-tight">Dispatch Center</h2>
            <p className="text-[10px] text-slate-400 leading-tight">{RANGE_SUBTITLE[datePreset] || RANGE_SUBTITLE.today}</p>
          </div>
        </div>
        <button onClick={() => load()} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing" : "Auto 30s"}
        </button>
      </div>

      {/* KPI strip — reflects the current work-type lens. "Pending Receipt" = picked
          up by the executive but NOT yet scanned in by the store (pickup only). */}
      <div className="grid grid-cols-6 gap-1.5">
        {[
          { key: "awaiting", label: "Unassigned", color: "text-amber-600 bg-amber-50 border-amber-200" },
          { key: "assigned", label: "Assigned", color: "text-blue-600 bg-blue-50 border-blue-200" },
          { key: "accepted", label: "Accepted", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
          { key: "pending_receipt", label: "Pending Receipt", color: "text-orange-600 bg-orange-50 border-orange-200" },
          { key: "completed", label: "Completed", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { key: "total", label: "Total", color: "text-slate-700 bg-slate-50 border-slate-200" },
        ].map((s) => {
          const val = s.key === "total" ? byWorkType.length : (kpis[s.key] || 0)
          const sp = s.key === "total" ? { pickup: byWorkType.filter((j) => j.kind === "pickup").length, delivery: byWorkType.filter((j) => j.kind === "delivery").length } : splitOf(s.key)
          const clickable = s.key !== "total"
          return (
            <button key={s.key} disabled={!clickable} onClick={() => clickable && setStatus(status === s.key ? "all" : s.key)}
              className={`rounded-lg border ${s.color} px-2 py-1.5 text-center transition-shadow ${clickable ? "hover:shadow-sm cursor-pointer" : ""} ${status === s.key ? "ring-2 ring-offset-1 ring-current" : ""}`}>
              <p className="text-lg font-bold tabular-nums leading-none">{val}</p>
              <p className="text-[9px] mt-0.5">{s.label}</p>
              <p className="text-[8px] mt-0.5 opacity-70">{sp.pickup}P · {sp.delivery}D</p>
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date range */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {DATE_PRESETS.map((d) => (
            <button key={d.key} onClick={() => { setDatePreset(d.key); setSelected(new Set()) }}
              className={`px-2 h-7 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${datePreset === d.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
              {d.label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="flex items-center gap-1">
            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setSelected(new Set()) }}
              className="h-7 text-[11px] rounded border border-slate-200 px-1 bg-white" />
            <span className="text-slate-400 text-[10px]">→</span>
            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setSelected(new Set()) }}
              className="h-7 text-[11px] rounded border border-slate-200 px-1 bg-white" />
          </div>
        )}
        {/* Work type */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {WORK_TYPES.map((w) => (
            <button key={w.key} onClick={() => { setWorkType(w.key as "all" | Kind); setSelected(new Set()) }}
              className={`px-2.5 h-7 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${workType === w.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
              {w.key === "pickup" && <Truck className="h-3 w-3 text-amber-500" />}
              {w.key === "delivery" && <PackageCheck className="h-3 w-3 text-violet-500" />}
              {w.label}
            </button>
          ))}
        </div>
        {/* Status */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => setStatus(t.key)}
              className={`px-2 h-7 rounded-md text-[11px] font-medium whitespace-nowrap border transition-colors ${status === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Executive focus */}
        <div className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <select value={execFilter} onChange={(e) => setExecFilter(e.target.value)}
            className="h-7 text-[11px] rounded border border-slate-200 px-1 bg-white max-w-[150px]">
            <option value="">All executives</option>
            <option value="__unassigned__">Unassigned only</option>
            {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input placeholder="Order / customer / phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 pl-7 text-xs" />
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-blue-800">{selected.size} selected</span>
          <select defaultValue="" onChange={(e) => { if (e.target.value) { bulkAssign(e.target.value); e.target.value = "" } }}
            className="h-7 text-[11px] rounded border border-blue-200 px-1 bg-white">
            <option value="" disabled>Assign to…</option>
            {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 border-blue-200 text-blue-700" onClick={() => bulkAssign(null)}>Unassign</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-slate-500" onClick={() => setSelected(new Set())}><X className="h-3 w-3 mr-0.5" />Clear</Button>
        </div>
      )}

      {/* Select-all */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          <span className="text-[10px] text-slate-400">{filtered.length} job{filtered.length !== 1 ? "s" : ""}{selected.size > 0 ? ` · ${selected.size} selected` : ""}</span>
        </div>
      )}

      {/* Rows */}
      {filtered.length === 0 ? (
        <Card className="rounded-lg border-slate-200"><CardContent className="py-10 text-center text-slate-400 text-xs">No jobs match these filters.</CardContent></Card>
      ) : (
        <div className="space-y-1">
          {filtered.map((job) => {
            const isDel = job.kind === "delivery"
            return (
              <Card key={job.id} className={`rounded-lg border ${selected.has(job.id) ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"} cursor-pointer hover:border-slate-300`} onClick={() => open(job.id)}>
                <CardContent className="p-1.5 flex items-center gap-1.5">
                  <Checkbox checked={selected.has(job.id)} onCheckedChange={() => toggleOne(job.id)} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                  {/* Kind chip */}
                  <Badge variant="outline" className={`text-[9px] leading-none px-1 h-4 shrink-0 gap-0.5 ${isDel ? "border-violet-200 text-violet-700 bg-violet-50" : "border-amber-200 text-amber-700 bg-amber-50"}`}>
                    {isDel ? <PackageCheck className="h-2.5 w-2.5" /> : <Truck className="h-2.5 w-2.5" />}{isDel ? "DEL" : "PICK"}
                  </Badge>
                  <div className="flex items-center gap-1 text-[10px] min-w-0 flex-1 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 shrink-0">{job.orderNumber}</span>
                    <span className="text-slate-700 truncate max-w-[100px] lg:max-w-[140px]">{job.customerName}</span>
                    {job.customerPhone && <span className="text-slate-400 shrink-0 hidden xs:inline">{job.customerPhone}</span>}
                    {/* Core dispatch fields — always visible so the dispatcher never opens the Order to assign. */}
                    {fmtDay(job.scheduledDate) && <span className="text-slate-500 shrink-0">{fmtDay(job.scheduledDate)}</span>}
                    {job.timeSlot && <span className="text-slate-400 shrink-0 hidden sm:flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{job.timeSlot}</span>}
                    {isDel
                      ? (job.amountDue > 0 ? <span className="shrink-0 font-semibold text-rose-600">{inr(job.amountDue)} due</span> : <span className="shrink-0 text-emerald-600">Paid</span>)
                      : (job.address && <span className="text-slate-400 truncate max-w-[90px] sm:max-w-[130px] lg:max-w-[180px] hidden sm:inline">{job.address}</span>)}
                    {isOverdue(job) && <Badge variant="outline" className="text-[9px] leading-none px-1 h-4 shrink-0 border-red-300 text-red-600 bg-red-50">OVERDUE</Badge>}
                    {job.bagCount > 0 && <span className="text-slate-400 shrink-0 hidden lg:inline flex items-center gap-0.5"><ShoppingBag className="h-2.5 w-2.5" />{job.bagCount}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select value={job.executiveId || ""} onChange={(e) => assign(job, e.target.value || null)} onClick={(e) => e.stopPropagation()}
                      className="h-6 text-[10px] w-20 lg:w-28 rounded border border-slate-200 px-1 bg-white">
                      <option value="">—</option>
                      {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                    </select>
                    <Badge variant="outline" className={`text-[9px] leading-none px-1 h-4 shrink-0 ${BUCKET_STYLES[job.bucket] || "border-slate-200 text-slate-400"}`}>
                      {BUCKET_LABELS[job.bucket] || job.bucket}
                    </Badge>
                    {!isDel && (job.mapsLink || (job.lat && job.lng)) && (
                      <a href={job.mapsLink || `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`} target="_blank" rel="noreferrer"
                        className="text-blue-400 hover:text-blue-600 shrink-0" title="Navigate" onClick={(e) => e.stopPropagation()}><Navigation className="h-3 w-3" /></a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
