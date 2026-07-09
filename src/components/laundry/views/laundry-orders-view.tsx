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
import { Search, RefreshCw, Loader2, ShoppingBag, ClipboardCheck, CreditCard, Truck, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { statusLabel } from "@/lib/laundry-workflow"

interface OrderRow {
  id: string; orderNumber: string; status: string; grandTotal: number; paymentStatus: string
  createdAt: string; expectedDeliveryDate: string | null; itemCount: number
  store?: { storeName: string } | null
  customer?: { name: string; phone: string | null; customerCode: string | null } | null
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
const FILTERS = ["ALL", "PENDING_STORE_AUDIT", "PAYMENT_PENDING", "READY_FOR_PROCESSING", "PACKED", "IN_TRANSIT_TO_PROCESSING", "PROCESSING", "RETURN_IN_TRANSIT", "READY_FOR_DELIVERY", "DELIVERED"]
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
  const { setLaundryPage, setSelectedOrderId } = useAdminStore()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("ALL")
  const [page, setPage] = useState(0)

  const load = useCallback(async () => {
    if (!currentBusinessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId: currentBusinessId, limit: String(PAGE), offset: String(page * PAGE) })
      if (status !== "ALL") params.set("status", status)
      if (search.trim()) params.set("search", search.trim())
      const json = await fetch(`/api/laundry/orders?${params}`).then((r) => r.json())
      setRows(json.success ? json.data : []); setTotal(json.total || 0)
    } catch { setRows([]) } finally { setLoading(false) }
  }, [currentBusinessId, page, status, search])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [status])

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const summary = useMemo(() => ({ shown: rows.length }), [rows])

  return (
    <div className="px-4 lg:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-blue-600" /> Orders</h1>
          <p className="text-sm text-slate-500">{total} order{total === 1 ? "" : "s"} · all workflow stages</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={load} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
          <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLaundryPage("new-order")}>New Order</Button>
        </div>
      </div>

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input placeholder="Search order number…" className="pl-9 h-9 bg-slate-50 border-slate-200" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} /></div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-56 bg-slate-50 border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>{FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Stages" : statusLabel(s)}</SelectItem>)}</SelectContent>
          </Select>
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
                <TableHead>Payment</TableHead><TableHead>Stage</TableHead><TableHead>Created</TableHead>
                <TableHead>Delivery</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((o) => {
                  const act = STAGE_ACTION[o.status]
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-medium text-sm">{o.orderNumber}</TableCell>
                      <TableCell><div className="text-sm font-medium text-slate-700">{o.customer?.name || "—"}</div><div className="text-[11px] text-slate-400">{o.customer?.phone || ""}</div></TableCell>
                      <TableCell className="text-sm text-slate-600">{o.store?.storeName || "—"}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{o.itemCount}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{inr(o.grandTotal)}</TableCell>
                      <TableCell><Badge variant="outline" className={PAY_STYLE[o.paymentStatus] || "border-slate-200 text-slate-500"}>{o.paymentStatus || "—"}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_STYLE[o.status] || "border-slate-200"}>{statusLabel(o.status)}</Badge></TableCell>
                      <TableCell className="text-xs text-slate-500">{fmt(o.createdAt)}</TableCell>
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
