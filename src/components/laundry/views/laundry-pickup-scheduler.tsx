"use client"

// Pickup Scheduler (Admin) — the master control for field pickups. The
// supervisor sees today's pickups bucketed by status and assigns / reassigns /
// clears an executive. Assignment writes to the existing order + timeline; it
// never creates orders or changes the order lifecycle. The PWA later executes
// these assignments.
import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Truck, MapPin, User, Package, Zap, Navigation } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/stores/auth-store"

interface Exec { id: string; name: string; mobile: string | null; storeName: string | null; availability: string }
interface Job {
  id: string; orderNumber: string; status: string; fieldStatus: string | null; priority: string
  customerName: string; customerPhone: string | null; timeSlot: string | null
  storeName: string | null; address: string | null; landmark: string | null; mapsLink: string | null; lat: number | null; lng: number | null
  services: string[]; bagCount: number; itemCount: number
  executiveId: string | null; executiveName: string | null; vehicle: string | null
  acceptance: string | null; assignedAt: string | null; acceptedAt: string | null; bucket: string
}

const BUCKETS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Awaiting Assignment" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "completed", label: "Completed" },
  { key: "missed", label: "Missed" },
  { key: "cancelled", label: "Cancelled" },
]
const today = () => new Date().toISOString().slice(0, 10)
const fieldLabel = (s: string | null) => s ? s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : null
const fmtTime = (s: string | null) => s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null

export function LaundryPickupScheduler({ mode = "pickup" }: { mode?: "pickup" | "delivery" }) {
  const isDelivery = mode === "delivery"
  const { currentBusinessId } = useAuthStore()
  const [date, setDate] = useState(today())
  const [jobs, setJobs] = useState<Job[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [execs, setExecs] = useState<Exec[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("all")
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const [s, e] = await Promise.all([
        fetch(`/api/laundry/pickup-scheduler?businessId=${currentBusinessId}&date=${date}&type=${mode}`).then((r) => r.json()),
        fetch(`/api/laundry/executives?businessId=${currentBusinessId}`).then((r) => r.json()),
      ])
      if (s.success) { setJobs(s.data); setCounts(s.counts || {}) }
      if (e.success) setExecs(e.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [currentBusinessId, date, mode])
  useEffect(() => { load() }, [load])

  const assign = async (job: Job, executiveId: string | null) => {
    setSavingId(job.id)
    try {
      const res = await fetch("/api/laundry/pickup-scheduler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: currentBusinessId, orderId: job.id, type: mode, executiveId }) })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.error || "Failed")
      toast.success(executiveId ? "Executive assigned" : "Assignment cleared")
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed") } finally { setSavingId(null) }
  }

  const visible = useMemo(() => tab === "all" ? jobs : jobs.filter((j) => j.bucket === tab), [jobs, tab])

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600" /> {isDelivery ? "Delivery Assignments" : "Pickup Assignments"}</h1>
          <p className="text-sm text-slate-500">Assign an active Delivery Executive to each {isDelivery ? "delivery" : "pickup"}. The executive Accepts or Rejects it in their app. Admin stays the master.</p>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-auto" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setTab(b.key)}
            className={`h-8 px-3 rounded-lg text-sm font-medium border transition-colors ${tab === b.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {b.label}{b.key !== "all" && counts[b.key] ? <span className={`ml-1.5 ${tab === b.key ? "text-blue-100" : "text-slate-400"}`}>{counts[b.key]}</span> : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : visible.length === 0 ? (
        <Card className="rounded-xl border-slate-200"><CardContent className="py-16 text-center text-slate-400 text-sm">No {isDelivery ? "deliveries" : "pickups"} {tab === "all" ? "for this date" : `in "${BUCKETS.find((b) => b.key === tab)?.label}"`}.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((job) => (
            <Card key={job.id} className="rounded-xl border-slate-200"><CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800">{job.orderNumber}</span>
                    {job.priority === "EXPRESS" && <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 gap-0.5"><Zap className="h-3 w-3" /> Express</Badge>}
                  </div>
                  <p className="text-sm text-slate-600 flex items-center gap-1 mt-0.5"><User className="h-3.5 w-3.5 text-slate-400" /> {job.customerName}{job.customerPhone && <span className="text-slate-400">· {job.customerPhone}</span>}</p>
                </div>
                <BucketBadge bucket={job.bucket} field={job.fieldStatus} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {job.timeSlot && <span>🕑 {job.timeSlot}</span>}
                {job.storeName && <span>🏪 {job.storeName}</span>}
                <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {job.bagCount} bag{job.bagCount === 1 ? "" : "s"} · {job.services.join(", ") || "—"}</span>
              </div>
              {job.address && (
                <div className="flex items-start justify-between gap-2 text-xs text-slate-500">
                  <span className="flex items-start gap-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {job.address}{job.landmark ? ` (${job.landmark})` : ""}</span>
                  {(job.mapsLink || (job.lat && job.lng)) && (
                    <a href={job.mapsLink || `https://www.google.com/maps/search/?api=1&query=${job.lat},${job.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"><Navigation className="h-3.5 w-3.5" /> Map</a>
                  )}
                </div>
              )}

              {/* Assignment status — acceptance, vehicle, timestamps, live field status */}
              {job.executiveId && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{job.vehicle ? <>🛵 {job.vehicle}</> : "Assigned"}</span>
                    <AcceptanceBadge acceptance={job.acceptance} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-slate-400">
                    {job.assignedAt && <span>Assigned {fmtTime(job.assignedAt)}</span>}
                    {job.acceptedAt && <span>Accepted {fmtTime(job.acceptedAt)}</span>}
                    {job.fieldStatus && job.fieldStatus !== "ASSIGNED" && <span className="text-blue-600">{fieldLabel(job.fieldStatus)}</span>}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                <span className="text-xs text-slate-400 shrink-0">Executive</span>
                <select
                  value={job.executiveId || ""}
                  disabled={savingId === job.id || job.bucket === "completed" || job.bucket === "cancelled"}
                  onChange={(e) => assign(job, e.target.value || null)}
                  className="h-9 flex-1 rounded-md border border-slate-200 px-2 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-400">
                  <option value="">— Awaiting Assignment —</option>
                  {execs.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}{ex.storeName ? ` · ${ex.storeName}` : ""}</option>)}
                </select>
                {savingId === job.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  )
}

function BucketBadge({ bucket, field }: { bucket: string; field: string | null }) {
  const map: Record<string, string> = {
    awaiting: "border-amber-300 text-amber-700 bg-amber-50",
    assigned: "border-blue-300 text-blue-700 bg-blue-50",
    accepted: "border-indigo-300 text-indigo-700 bg-indigo-50",
    completed: "border-emerald-300 text-emerald-700 bg-emerald-50",
    missed: "border-rose-300 text-rose-700 bg-rose-50",
    cancelled: "border-slate-300 text-slate-400 bg-slate-50",
  }
  const labels: Record<string, string> = { awaiting: "Awaiting", assigned: "Assigned", accepted: "In Progress", completed: "Completed", missed: "Missed", cancelled: "Cancelled" }
  const label = bucket === "accepted" && field && field !== "ASSIGNED" ? fieldLabel(field) : labels[bucket] || bucket
  return <Badge variant="outline" className={`text-[10px] shrink-0 ${map[bucket] || map.awaiting}`}>{label}</Badge>
}

function AcceptanceBadge({ acceptance }: { acceptance: string | null }) {
  if (!acceptance || acceptance === "PENDING") return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Awaiting response</Badge>
  if (acceptance === "ACCEPTED") return <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50">Accepted</Badge>
  return <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 bg-rose-50">Rejected</Badge>
}
