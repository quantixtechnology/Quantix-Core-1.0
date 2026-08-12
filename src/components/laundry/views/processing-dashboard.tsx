"use client"

// Processing Center dashboard — what a supervisor needs to run the floor today.
//
// Every number comes from /api/laundry/processing/dashboard, which counts the
// SAME tables the operational queues read. A KPI can therefore never disagree
// with the screen it links to, and there is no second source of truth.
//
// Nothing is decorative: each stage tile is a door to the screen that clears it,
// and the workload table is ordered by what is DUE, not by what was created.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuthStore } from "@/stores/auth-store"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2, RefreshCw, AlertTriangle, PackageCheck, Truck, ClipboardCheck,
  Factory, ArrowRight, Clock,
} from "lucide-react"

interface FlowStage { key: string; label: string; page: string; count: number }
interface WorkRow {
  id: string; orderNumber: string; status: string; customer: string | null
  garments: number; service: string | null; currentStage: string
  due: string | null; dueSlot: string | null; overdue: boolean
}
interface Dash {
  kpis: { ordersReceived: number; awaitingProcessing: number; inProgress: number; qcPending: number; readyForDispatch: number; completed: number; inTransit: number }
  flow: FlowStage[]
  workload: WorkRow[]
  attention: { overdue: number; qcPending: number; awaitingProcessing: number; readyForDispatch: number }
}

type RangeKey = "TODAY" | "YESTERDAY" | "TOMORROW" | "WEEK" | "CUSTOM"

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const longDate = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—")

/** The window the operator picked, in THEIR timezone — not the server's. */
function resolveRange(key: RangeKey, custom: string): { from: Date; to: Date; label: string } {
  const today = startOfDay(new Date())
  switch (key) {
    case "YESTERDAY": { const f = addDays(today, -1); return { from: f, to: today, label: longDate(f) } }
    case "TOMORROW": { const f = addDays(today, 1); return { from: f, to: addDays(f, 1), label: longDate(f) } }
    case "WEEK": {
      // Week starting Monday.
      const dow = (today.getDay() + 6) % 7
      const f = addDays(today, -dow)
      return { from: f, to: addDays(f, 7), label: `${longDate(f)} – ${longDate(addDays(f, 6))}` }
    }
    case "CUSTOM": {
      const d = custom ? new Date(`${custom}T00:00:00`) : today
      const f = Number.isNaN(d.getTime()) ? today : startOfDay(d)
      return { from: f, to: addDays(f, 1), label: longDate(f) }
    }
    default: return { from: today, to: addDays(today, 1), label: `Today · ${longDate(today)}` }
  }
}

export function ProcessingDashboard() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const [range, setRange] = useState<RangeKey>("TODAY")
  const [custom, setCustom] = useState(dayKey(new Date()))
  const [data, setData] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)

  const win = useMemo(() => resolveRange(range, custom), [range, custom])

  const load = useCallback(() => {
    if (!currentBusinessId) return
    setLoading(true)
    const p = new URLSearchParams({ businessId: currentBusinessId, from: win.from.toISOString(), to: win.to.toISOString() })
    fetch(`/api/laundry/processing/dashboard?${p}`)
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentBusinessId, win.from, win.to])
  useEffect(() => { load() }, [load])

  const k = data?.kpis
  const a = data?.attention

  return (
    <div className="px-4 lg:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800">
            <Factory className="h-5 w-5 text-blue-600" /> Processing Center
          </h1>
          {/* The selected window is stated in words — a dashboard that does not
              say which day it is describing is a trap. */}
          <p className="text-sm text-slate-500">{win.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {([["TODAY", "Today"], ["YESTERDAY", "Yesterday"], ["TOMORROW", "Tomorrow"], ["WEEK", "This Week"], ["CUSTOM", "Custom"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setRange(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${range === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
          {range === "CUSTOM" && (
            <input type="date" value={custom} onChange={(e) => setCustom(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" />
          )}
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-20 text-center text-slate-400"><Loader2 className="inline h-5 w-5 animate-spin" /></div>
      ) : !data ? (
        <p className="py-20 text-center text-sm text-slate-400">Could not load the dashboard.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {/* Received and Completed are windowed; the rest are live floor
                state, which is what a supervisor acts on right now. */}
            <Kpi label="Orders Received" value={k!.ordersReceived} hint="in this period" icon={PackageCheck} onClick={() => setLaundryPage("processing-centers")} />
            <Kpi label="Awaiting Processing" value={k!.awaitingProcessing} hint="garments" icon={Clock} tone="amber" onClick={() => setLaundryPage("audit-barcode")} />
            <Kpi label="In Progress" value={k!.inProgress} hint="garments on the floor" icon={Factory} onClick={() => setLaundryPage("ws-sorting")} />
            <Kpi label="QC Pending" value={k!.qcPending} hint="garments" icon={ClipboardCheck} tone="amber" onClick={() => setLaundryPage("ws-qc")} />
            <Kpi label="Ready for Dispatch" value={k!.readyForDispatch} hint="orders" icon={Truck} tone="emerald" onClick={() => setLaundryPage("processing-centers")} />
            <Kpi label="Completed" value={k!.completed} hint="in this period" icon={PackageCheck} tone="emerald" />
          </div>

          <Card className="rounded-xl border-slate-200"><CardContent className="p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Production Flow</p>
            {/* Garment counts per stage, straight from the workstation queues.
                Each one opens the screen that clears it. */}
            <div className="flex flex-wrap items-stretch gap-2">
              {data.flow.map((f, i) => (
                <div key={f.key} className="flex items-center gap-2">
                  <button onClick={() => setLaundryPage(f.page as never)}
                    className="min-w-[116px] rounded-lg border border-slate-200 p-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/50">
                    <p className="text-[11px] text-slate-500">{f.label}</p>
                    <p className={`text-lg font-semibold tabular-nums ${f.count > 0 ? "text-slate-800" : "text-slate-300"}`}>{f.count}</p>
                  </button>
                  {i < data.flow.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                </div>
              ))}
            </div>
          </CardContent></Card>

          {(a!.overdue > 0 || a!.qcPending > 0 || a!.awaitingProcessing > 0 || a!.readyForDispatch > 0) && (
            <Card className="rounded-xl border-amber-200 bg-amber-50/50"><CardContent className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Needs Attention
              </p>
              {/* Only conditions the data actually supports. Anything at zero is
                  omitted rather than shown as a reassuring green nothing. */}
              <div className="flex flex-wrap gap-2">
                {a!.overdue > 0 && <Attn n={a!.overdue} label="past their promised delivery" onClick={() => setLaundryPage("orders")} />}
                {a!.awaitingProcessing > 0 && <Attn n={a!.awaitingProcessing} label="garments waiting to start" onClick={() => setLaundryPage("audit-barcode")} />}
                {a!.qcPending > 0 && <Attn n={a!.qcPending} label="garments at Quality Check" onClick={() => setLaundryPage("ws-qc")} />}
                {a!.readyForDispatch > 0 && <Attn n={a!.readyForDispatch} label="orders ready to dispatch" onClick={() => setLaundryPage("processing-centers")} />}
              </div>
            </CardContent></Card>
          )}

          <Card className="rounded-xl border-slate-200"><CardContent className="p-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Workload · {data.workload.length} order{data.workload.length === 1 ? "" : "s"} on the floor
            </p>
            {data.workload.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nothing in the Processing Center right now.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Order</TableHead><TableHead>Customer</TableHead>
                    <TableHead className="text-center">Garments</TableHead><TableHead>Service</TableHead>
                    <TableHead>Stage</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {/* Ordered by promised due time — the queue a supervisor
                        actually works, not creation order. */}
                    {data.workload.map((o) => (
                      <TableRow key={o.id} className={o.overdue ? "bg-rose-50/40" : ""}>
                        <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                        <TableCell className="text-sm">{o.customer || "—"}</TableCell>
                        <TableCell className="text-center tabular-nums">{o.garments}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs text-slate-500">{o.service || "—"}</TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">{o.currentStage}</TableCell>
                        <TableCell className="text-xs">
                          <span className={o.overdue ? "font-semibold text-rose-700" : "text-slate-600"}>{timeOf(o.due)}</span>
                          {o.dueSlot && <span className="block text-slate-400">{o.dueSlot}</span>}
                        </TableCell>
                        <TableCell className="text-[11px] text-slate-500">{o.status.replace(/_/g, " ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent></Card>

          <div className="flex flex-wrap gap-2">
            {([["processing-centers", "Console & Receive"], ["audit-barcode", "Barcode Generation"], ["ws-sorting", "Sorting"], ["ws-qc", "Dry & Quality Check"], ["orders", "View Orders"], ["reports", "Reports"]] as const).map(([page, label]) => (
              <Button key={page} variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLaundryPage(page as never)}>{label}</Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, hint, icon: Icon, tone, onClick }: {
  label: string; value: number; hint?: string; icon: typeof Factory; tone?: "amber" | "emerald"; onClick?: () => void
}) {
  const colour = tone === "amber" ? "text-amber-600" : tone === "emerald" ? "text-emerald-600" : "text-blue-600"
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors ${onClick ? "hover:border-blue-400 hover:bg-blue-50/40" : "cursor-default"}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Icon className={`h-3.5 w-3.5 ${colour}`} /> {label}</div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </button>
  )
}

function Attn({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-900 hover:bg-amber-50">
      <span className="font-semibold tabular-nums">{n}</span> {label}
    </button>
  )
}
