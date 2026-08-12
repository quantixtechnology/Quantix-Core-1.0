"use client"

// Stage history — the "what already went through here" half of an operational
// queue. A queue shows what is waiting; without this, an order vanishes the
// moment it is handled and staff have to go hunting in Orders to answer "did we
// receive that?".
//
// Two shapes, one component, because they answer the same question from
// different tables:
//   TRANSPORT — the handover log (dispatch / receive legs), from the existing
//               /api/laundry/transport/history.
//   ORDERS    — orders that have reached a status, from the existing
//               /api/laundry/orders.
//
// No new endpoint and no new history store.

import { useCallback, useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Search } from "lucide-react"

const fmt = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"
const day = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"

interface TransportRow {
  id: string; orderNumber: string; customer: string | null; itemCount: number
  transport: { code: string | null; kind: string } | null; at: string | null; storeName?: string | null
  actorName?: string | null
}

/** Handover history: Store Receive, Processing Receive, either dispatch leg. */
export function TransportStageHistory({ businessId, stage, timeLabel }: { businessId: string | null; stage: string; timeLabel: string }) {
  const [rows, setRows] = useState<TransportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    const p = new URLSearchParams({ businessId, stage })
    if (q.trim()) p.set("search", q.trim())
    fetch(`/api/laundry/transport/history?${p}`)
      .then((r) => r.json()).then((j) => setRows(j.success ? j.data : []))
      .catch(() => setRows([])).finally(() => setLoading(false))
  }, [businessId, stage, q])
  // Debounced so typing an order number does not fire a request per keystroke.
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order / bag / customer…" className="h-9 pl-8 text-sm" />
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty q={q} /> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Order</TableHead><TableHead>Bag / Packet</TableHead><TableHead>Customer</TableHead>
              <TableHead className="text-center">Garments</TableHead><TableHead>{timeLabel}</TableHead><TableHead>By</TableHead>
            </TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.orderNumber}</TableCell>
                <TableCell className="font-mono text-xs">{r.transport?.code || "—"}</TableCell>
                <TableCell className="text-sm">{r.customer || "—"}</TableCell>
                <TableCell className="text-center">{r.itemCount}</TableCell>
                <TableCell className="text-xs text-slate-500">{fmt(r.at)}</TableCell>
                <TableCell className="text-xs text-slate-500">{r.actorName || "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface OrderHistRow {
  id: string; orderNumber: string; status: string
  customer?: { name: string | null } | null
  promisedDeliveryDate?: string | null; promisedDeliveryTimeSlot?: string | null
  deliveryDate?: string | null; deliveryTimeSlot?: string | null
  deliveryExecutiveName?: string | null; deliveredAt?: string | null
  pickupAddress?: string | null
}

/**
 * Delivery history: orders that have left this stage. Reads the orders API with
 * a status filter — Dispatch Center remains the assignment screen, this is only
 * the record of what happened.
 */
export function DeliveryStageHistory({ businessId, statuses }: { businessId: string | null; statuses: string[] }) {
  const [rows, setRows] = useState<OrderHistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

  const load = useCallback(() => {
    if (!businessId) return
    setLoading(true)
    Promise.all(statuses.map((st) => {
      const p = new URLSearchParams({ businessId, status: st, limit: "50" })
      if (q.trim()) p.set("search", q.trim())
      return fetch(`/api/laundry/orders?${p}`).then((r) => r.json()).then((j) => (j.success ? j.data : [])).catch(() => [])
    }))
      .then((lists) => {
        const all = (lists.flat() as OrderHistRow[])
        // Most recently delivered first — a log reads newest-down.
        all.sort((a, b) => new Date(b.deliveredAt || 0).getTime() - new Date(a.deliveredAt || 0).getTime())
        setRows(all)
      })
      .finally(() => setLoading(false))
  }, [businessId, statuses, q])
  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])

  return (
    <div className="space-y-2">
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order / customer…" className="h-9 pl-8 text-sm" />
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty q={q} /> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Address</TableHead>
              <TableHead>Promised</TableHead><TableHead>Executive</TableHead><TableHead>Delivered</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.orderNumber}</TableCell>
                <TableCell className="text-sm">{r.customer?.name || "—"}</TableCell>
                <TableCell className="max-w-[220px] truncate text-xs text-slate-500">{(r.pickupAddress || "—").split("\n").slice(-1)[0]}</TableCell>
                {/* The promise as the customer was given it, not the operational date. */}
                <TableCell className="text-xs text-slate-600">
                  {day(r.promisedDeliveryDate || r.deliveryDate)}
                  <span className="block text-slate-400">{r.promisedDeliveryTimeSlot || r.deliveryTimeSlot || "—"}</span>
                </TableCell>
                <TableCell className="text-xs text-slate-600">{r.deliveryExecutiveName || "—"}</TableCell>
                <TableCell className="text-xs text-slate-500">{fmt(r.deliveredAt)}</TableCell>
                <TableCell className="text-[11px] font-medium text-slate-600">{r.status.replace(/_/g, " ")}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/** Active | History switch — the same control both stages use. */
export function HistoryToggle({ value, onChange }: { value: boolean; onChange: (history: boolean) => void }) {
  return (
    <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-200 text-[11px] font-medium">
      <button onClick={() => onChange(false)} className={`px-2.5 py-1 ${!value ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>Current</button>
      <button onClick={() => onChange(true)} className={`px-2.5 py-1 ${value ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>History</button>
    </div>
  )
}

function Spinner() { return <div className="py-6 text-center text-slate-400"><Loader2 className="inline h-4 w-4 animate-spin" /></div> }
function Empty({ q }: { q: string }) { return <p className="py-6 text-center text-sm text-slate-400">{q ? "Nothing matches that." : "No history yet."}</p> }
