"use client"

// Laundry Subscriptions management — customer plans, allowances and dues.
// Distinct from Services & Pricing (which configures plan definitions); this
// manages actual CustomerSubscriptions. All figures are tenant-scoped real data.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdminStore } from "@/stores/admin-store"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Repeat, Search, Users, Clock, AlertTriangle, IndianRupee } from "lucide-react"
import { inr } from "./pricing/pricing-shared"

interface Row { id: string; type: string; customerName: string; customerPhone: string | null; customerEmail: string | null; planName: string; status: string; clothesUsed: number; allowance: number; ordersUsed: number; maxOrders: number | null; cycleStart: string | null; cycleEnd: string | null; amountDue: number; expiring: boolean }
interface Data { summary: { active: number; pendingPayment: number; expiringSoon: number; outstandingDue: number }; rows: Row[] }

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"
const statusBadge = (s: string) => s === "ACTIVE" ? "border-emerald-300 text-emerald-700 bg-emerald-50"
  : s === "PAYMENT_PENDING" ? "border-amber-300 text-amber-700 bg-amber-50"
  : s === "EXPIRED" ? "border-slate-300 text-slate-500 bg-slate-50" : "border-rose-300 text-rose-700 bg-rose-50"
const FILTERS = ["All", "Active", "Payment Pending", "Expiring Soon", "Expired", "Cancelled"]

export function LaundrySubscriptionsView() {
  const { currentBusinessId } = useAdminStore()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState("All")

  const load = useCallback(() => {
    if (!currentBusinessId) return
    setLoading(true)
    fetch(`/api/laundry/subscriptions?businessId=${currentBusinessId}`).then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data) }).catch(() => {}).finally(() => setLoading(false))
  }, [currentBusinessId])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    let r = data?.rows || []
    if (filter === "Active") r = r.filter((x) => x.status === "ACTIVE")
    else if (filter === "Payment Pending") r = r.filter((x) => x.status === "PAYMENT_PENDING")
    else if (filter === "Expiring Soon") r = r.filter((x) => x.expiring)
    else if (filter === "Expired") r = r.filter((x) => x.status === "EXPIRED")
    else if (filter === "Cancelled") r = r.filter((x) => x.status === "CANCELLED")
    const s = q.trim().toLowerCase()
    if (s) r = r.filter((x) => [x.customerName, x.customerPhone, x.customerEmail, x.planName].some((v) => (v || "").toLowerCase().includes(s)))
    return r
  }, [data, filter, q])

  const cards = [
    { label: "Active Subscriptions", value: data?.summary.active ?? 0, icon: Users, color: "text-emerald-600" },
    { label: "Pending Payment", value: data?.summary.pendingPayment ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Expiring Soon", value: data?.summary.expiringSoon ?? 0, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Outstanding Due", value: inr(data?.summary.outstandingDue ?? 0), icon: IndianRupee, color: "text-rose-600" },
  ]

  return (
    <div className="space-y-4 p-1">
      <div>
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2"><Repeat className="h-5 w-5 text-blue-600" /> Subscriptions</h2>
        <p className="text-sm text-muted-foreground">Manage customer plans, allowances and subscription dues.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{c.label}</p><c.icon className={`h-4 w-4 ${c.color}`} /></div>
            <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search customer, mobile, email, plan…" className="pl-9 h-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 h-9 text-xs font-medium border ${filter === f ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{f}</button>)}
        </div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16"><Repeat className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm font-medium">No subscriptions</p><p className="text-xs text-muted-foreground mt-1">Customer subscriptions appear here once purchased.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Clothes Used</TableHead><TableHead>Orders Used</TableHead><TableHead>Cycle</TableHead><TableHead className="text-right">Amount Due</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><div className="font-medium">{r.customerName}</div><div className="text-xs text-muted-foreground">{r.customerPhone || r.customerEmail || ""}</div></TableCell>
                    <TableCell>{r.planName}</TableCell>
                    <TableCell><Badge variant="outline" className={statusBadge(r.status)}>{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="tabular-nums">{r.status === "PAYMENT_PENDING" ? "—" : `${r.clothesUsed} / ${r.allowance}`}</TableCell>
                    <TableCell className="tabular-nums">{r.status === "PAYMENT_PENDING" ? "—" : `${r.ordersUsed} / ${r.maxOrders ?? "∞"}`}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.cycleStart ? `${fmtDate(r.cycleStart)} – ${fmtDate(r.cycleEnd)}` : "Not Started"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{r.amountDue > 0 ? <span className="text-rose-600">{inr(r.amountDue)}</span> : <span className="text-emerald-600">₹0</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}
