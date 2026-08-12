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
  Factory, Clock,
} from "lucide-react"

interface FlowStage { key: string; label: string; page: string; count: number; completed: number; pending: number }
interface WorkRow {
  id: string; orderNumber: string; status: string; customer: string | null
  garments: number; service: string | null; currentStage: string
  due: string | null; dueSlot: string | null; overdue: boolean
}
interface Dash {
  returnToStore: { completed: number; pending: number }
  activity: { received: number; completed: number; returned: number }
  workloadNow: { inTransit: number; awaitingBarcode: number; awaitingProcessing: number; inProgress: number; qcPending: number; readyForDispatch: number }
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
function resolveRange(key: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date; label: string } {
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
      const a = new Date(`${customFrom}T00:00:00`)
      const b = new Date(`${customTo}T00:00:00`)
      const f = Number.isNaN(a.getTime()) ? today : startOfDay(a)
      // `to` is exclusive, so the end day is included by adding one.
      const t = Number.isNaN(b.getTime()) ? addDays(f, 1) : addDays(startOfDay(b), 1)
      const single = dayKey(f) === dayKey(addDays(t, -1))
      return { from: f, to: t, label: single ? longDate(f) : `${longDate(f)} – ${longDate(addDays(t, -1))}` }
    }
    default: return { from: today, to: addDays(today, 1), label: `Today · ${longDate(today)}` }
  }
}

export function ProcessingDashboard() {
  const { currentBusinessId } = useAuthStore()
  const { setLaundryPage } = useAdminStore()
  const [range, setRange] = useState<RangeKey>("TODAY")
  // Custom is a RANGE. The draft is held separately so a half-typed range never
  // refetches, and Apply is the only thing that commits it.
  const [customFrom, setCustomFrom] = useState(dayKey(new Date()))
  const [customTo, setCustomTo] = useState(dayKey(new Date()))
  const [draft, setDraft] = useState({ from: dayKey(new Date()), to: dayKey(new Date()) })
  const [showCustom, setShowCustom] = useState(false)
  const [data, setData] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)

  const win = useMemo(() => resolveRange(range, customFrom, customTo), [range, customFrom, customTo])
  const draftInvalid = draft.from && draft.to ? draft.from > draft.to : true

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

  const act = data?.activity
  const w = data?.workloadNow
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
            <button key={key} onClick={() => { if (key === "CUSTOM") { setDraft({ from: customFrom, to: customTo }); setShowCustom(true) } else { setRange(key); setShowCustom(false) } }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${range === key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
          {range === "CUSTOM" && (
            <span className="text-xs font-medium text-slate-600">{win.label}</span>
          )}
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {showCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCustom(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800">Custom date range</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Start Date</label>
                <input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">End Date</label>
                <input type="date" value={draft.to} min={draft.from || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>
            {/* Both mandatory, and start may not follow end. Apply stays disabled
                rather than accepting a range and quietly correcting it. */}
            {draftInvalid && (
              <p className="mt-2 text-[11px] font-medium text-rose-600">
                {!draft.from || !draft.to ? "Both dates are required." : "The start date cannot be after the end date."}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowCustom(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button disabled={draftInvalid}
                onClick={() => { setCustomFrom(draft.from); setCustomTo(draft.to); setRange("CUSTOM"); setShowCustom(false) }}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Apply</button>
            </div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="py-20 text-center text-slate-400"><Loader2 className="inline h-5 w-5 animate-spin" /></div>
      ) : !data ? (
        <p className="py-20 text-center text-sm text-slate-400">Could not load the dashboard.</p>
      ) : (
        <>
          {/* A — ACTIVITY in the selected window. These are events that happened. */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Activity · {win.label}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Orders Received" value={act!.received} hint="taken in by the centre" icon={PackageCheck} />
              <Kpi label="Orders Completed" value={act!.completed} hint="processing finished" icon={ClipboardCheck} tone="emerald" />
              <Kpi label="Dispatched to Store" value={act!.returned} hint="sent back" icon={Truck} tone="emerald" />
            </div>
          </div>

          {/* B — WORKLOAD NOW. Deliberately NOT date-filtered: an order received
              yesterday and still being washed today belongs here. */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              On the floor now <span className="font-normal normal-case text-slate-400">— current state, any arrival date</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Kpi label="In Transit" value={w!.inTransit} hint="orders arriving" icon={Truck} onClick={() => setLaundryPage("processing-centers")} />
              <Kpi label="Awaiting Barcode" value={w!.awaitingBarcode} hint="orders" icon={Clock} tone="amber" onClick={() => setLaundryPage("audit-barcode")} />
              <Kpi label="Awaiting Processing" value={w!.awaitingProcessing} hint="garments" icon={Clock} tone="amber" onClick={() => setLaundryPage("audit-barcode")} />
              <Kpi label="In Progress" value={w!.inProgress} hint="garments" icon={Factory} onClick={() => setLaundryPage("ws-sorting")} />
              <Kpi label="QC Pending" value={w!.qcPending} hint="garments" icon={ClipboardCheck} tone="amber" onClick={() => setLaundryPage("ws-qc")} />
              <Kpi label="Ready for Dispatch" value={w!.readyForDispatch} hint="orders" icon={Truck} tone="emerald" onClick={() => setLaundryPage("processing-centers")} />
            </div>
          </div>

          <Card className="rounded-xl border-slate-200"><CardContent className="p-4">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">Production Flow</p>
            {/* The real route through the centre. Washing/Dry Cleaning and
                Ironing/Folding are PARALLEL branches — a garment takes one of
                each pair, never both in sequence — so they sit side by side and
                merge, rather than being strung into a single line. */}
            <div className="mx-auto flex max-w-2xl flex-col items-center">
              <Node stage={byKey(data.flow, "RECEIVED")} go={setLaundryPage} />
              <Down />
              <Split />
              <div className="grid w-full grid-cols-2 gap-3">
                <Node stage={byKey(data.flow, "WASH")} go={setLaundryPage} />
                <Node stage={byKey(data.flow, "DRYCLEAN")} go={setLaundryPage} />
              </div>
              <Merge />
              <Node stage={byKey(data.flow, "QC")} go={setLaundryPage} />
              <Down />
              <Node stage={byKey(data.flow, "SORTING")} go={setLaundryPage} />
              <Down />
              <Split />
              <div className="grid w-full grid-cols-2 gap-3">
                <Node stage={byKey(data.flow, "IRON")} go={setLaundryPage} />
                <Node stage={byKey(data.flow, "FOLD")} go={setLaundryPage} />
              </div>
              <Merge />
              {/* Order-level terminal, not a garment stage. */}
              <Node stage={{ key: "RETURN", label: "Return to Store", page: "processing-centers", count: data.returnToStore.completed + data.returnToStore.pending, completed: data.returnToStore.completed, pending: data.returnToStore.pending }} go={setLaundryPage} unit="orders" />
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

/**
 * One box in the flow: stage name over a split completed / pending footer.
 *
 * Two separate figures, never "5 / 7" and never a percentage — at a glance an
 * operator needs to know how much is DONE and how much is still to do, and a
 * ratio makes them do the subtraction.
 */
function Node({ stage, go, unit = "garments" }: { stage: FlowStage; go: (p: never) => void; unit?: string }) {
  return (
    <button onClick={() => go(stage.page as never)}
      className="w-full max-w-[260px] overflow-hidden rounded-xl border border-slate-200 bg-white text-center transition-colors hover:border-blue-400">
      <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{stage.label}</p>
      <div className="grid grid-cols-2">
        <div className="bg-emerald-600 px-2 py-1.5 text-white">
          <p className="text-xl font-bold leading-tight tabular-nums">{stage.completed}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide opacity-90">Completed</p>
        </div>
        <div className="bg-amber-500 px-2 py-1.5 text-white">
          <p className="text-xl font-bold leading-tight tabular-nums">{stage.pending}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide opacity-90">Pending</p>
        </div>
      </div>
      <p className="py-1 text-[9px] text-slate-400">{unit}</p>
    </button>
  )
}
const byKey = (flow: FlowStage[], k: string): FlowStage =>
  flow.find((f) => f.key === k) ?? { key: k, label: k, page: "processing-centers", count: 0, completed: 0, pending: 0 }

/** Connectors. Plain CSS rules — a diagram this small needs no chart library. */
function Down() { return <div className="h-5 w-px bg-slate-300" /> }
function Split() {
  return (
    <div className="w-full max-w-2xl">
      <div className="mx-auto h-3 w-px bg-slate-300" />
      <div className="mx-auto h-px w-1/2 bg-slate-300" />
      <div className="mx-auto flex w-1/2 justify-between"><div className="h-3 w-px bg-slate-300" /><div className="h-3 w-px bg-slate-300" /></div>
    </div>
  )
}
function Merge() {
  return (
    <div className="w-full max-w-2xl">
      <div className="mx-auto flex w-1/2 justify-between"><div className="h-3 w-px bg-slate-300" /><div className="h-3 w-px bg-slate-300" /></div>
      <div className="mx-auto h-px w-1/2 bg-slate-300" />
      <div className="mx-auto h-3 w-px bg-slate-300" />
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
